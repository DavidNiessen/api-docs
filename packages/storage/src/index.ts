import pg from 'pg';
import { randomUUID } from 'node:crypto';
import type {
  OidcTransaction,
  Project,
  Publication,
  Repository,
  Role,
} from '@api-docs/domain';
import { ConflictError } from '@api-docs/domain';
const projectColumns =
  'id, slug, name, visibility, active_publication_id AS "activePublicationId"';
const publicationColumns =
  'id, project_id AS "projectId", artifact_id AS "artifactId", subject, created_at::text AS "createdAt", idempotency_key AS "idempotencyKey"';
export class PostgresRepository implements Repository {
  private readonly pool: pg.Pool;
  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30_000,
    });
    this.pool.on('error', () => {
      /* Health checks expose availability without logging connection credentials. */
    });
  }
  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(193271)');
      await client.query(`CREATE TABLE IF NOT EXISTS docs_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS docs_projects (id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, visibility text NOT NULL CHECK (visibility IN ('public','private')), active_publication_id uuid);
        CREATE TABLE IF NOT EXISTS docs_roles (project_id uuid NOT NULL REFERENCES docs_projects(id) ON DELETE CASCADE, subject text NOT NULL, role text NOT NULL CHECK (role IN ('viewer','editor','publisher','admin')), PRIMARY KEY(project_id,subject));
        CREATE TABLE IF NOT EXISTS docs_artifacts (project_id uuid NOT NULL REFERENCES docs_projects(id), artifact_id text NOT NULL, PRIMARY KEY(project_id,artifact_id));
        CREATE TABLE IF NOT EXISTS docs_publications (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), artifact_id text NOT NULL, subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL, UNIQUE(project_id,idempotency_key), FOREIGN KEY(project_id,artifact_id) REFERENCES docs_artifacts(project_id,artifact_id));
        CREATE TABLE IF NOT EXISTS docs_audit (id bigserial PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), actor text NOT NULL, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS docs_tokens (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), token_hash text UNIQUE NOT NULL, label text NOT NULL, role text NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false);
        CREATE TABLE IF NOT EXISTS docs_sessions (token_hash text PRIMARY KEY, subject text NOT NULL, expires_at timestamptz NOT NULL);
        CREATE TABLE IF NOT EXISTS docs_oidc (state_hash text PRIMARY KEY, nonce text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL);
        CREATE INDEX IF NOT EXISTS docs_sessions_expiry ON docs_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS docs_publications_project ON docs_publications(project_id,created_at DESC);
        INSERT INTO docs_schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
  async healthy() {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
  async projects(): Promise<Project[]> {
    return (
      await this.pool.query<Project>(
        `SELECT ${projectColumns} FROM docs_projects ORDER BY slug`,
      )
    ).rows;
  }
  async project(idOrSlug: string): Promise<Project | undefined> {
    return (
      await this.pool.query<Project>(
        `SELECT ${projectColumns} FROM docs_projects WHERE id::text=$1 OR slug=$1`,
        [idOrSlug],
      )
    ).rows[0];
  }
  async createProject(input: {
    slug: string;
    name: string;
    visibility: 'public' | 'private';
    subject: string;
  }): Promise<Project> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const id = randomUUID();
      const project = (
        await client.query<Project>(
          `INSERT INTO docs_projects(id,slug,name,visibility) VALUES($1,$2,$3,$4) RETURNING ${projectColumns}`,
          [id, input.slug, input.name, input.visibility],
        )
      ).rows[0]!;
      await client.query(
        'INSERT INTO docs_roles(project_id,subject,role) VALUES($1,$2,$3)',
        [id, input.subject, 'admin'],
      );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action) VALUES($1,$2,$3)',
        [id, input.subject, 'project.created'],
      );
      await client.query('COMMIT');
      return project;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505')
        throw new ConflictError('Project slug already exists');
      throw error;
    } finally {
      client.release();
    }
  }
  async role(projectId: string, subject: string): Promise<Role | undefined> {
    return (
      await this.pool.query<{ role: Role }>(
        'SELECT role FROM docs_roles WHERE project_id=$1 AND subject=$2',
        [projectId, subject],
      )
    ).rows[0]?.role;
  }
  async setRole(
    projectId: string,
    subject: string,
    role: Role | null,
    actor: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (role)
        await client.query(
          'INSERT INTO docs_roles(project_id,subject,role) VALUES($1,$2,$3) ON CONFLICT(project_id,subject) DO UPDATE SET role=excluded.role',
          [projectId, subject, role],
        );
      else
        await client.query(
          'DELETE FROM docs_roles WHERE project_id=$1 AND subject=$2',
          [projectId, subject],
        );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action,metadata) VALUES($1,$2,$3,$4)',
        [
          projectId,
          actor,
          role ? 'role.granted' : 'role.revoked',
          JSON.stringify({ subject, role }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async registerArtifact(
    projectId: string,
    artifactId: string,
    subject: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO docs_artifacts(project_id,artifact_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [projectId, artifactId],
      );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action,metadata) VALUES($1,$2,$3,$4)',
        [
          projectId,
          subject,
          'artifact.registered',
          JSON.stringify({ artifactId }),
        ],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async publish(
    projectId: string,
    artifactId: string,
    expected: string | null,
    key: string,
    subject: string,
  ): Promise<Publication> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const project = (
        await client.query<{ active: string | null }>(
          'SELECT active_publication_id AS active FROM docs_projects WHERE id=$1 FOR UPDATE',
          [projectId],
        )
      ).rows[0];
      if (!project) throw new Error('Project not found');
      const existing = (
        await client.query<Publication>(
          `SELECT ${publicationColumns} FROM docs_publications WHERE project_id=$1 AND idempotency_key=$2`,
          [projectId, key],
        )
      ).rows[0];
      if (existing) {
        if (existing.artifactId !== artifactId)
          throw new ConflictError(
            'Idempotency key was already used for another artifact',
          );
        await client.query('COMMIT');
        return existing;
      }
      if (project.active !== expected)
        throw new ConflictError(
          'Publication changed; refresh before publishing',
        );
      const publication = (
        await client.query<Publication>(
          `INSERT INTO docs_publications(id,project_id,artifact_id,subject,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING ${publicationColumns}`,
          [randomUUID(), projectId, artifactId, subject, key],
        )
      ).rows[0]!;
      await client.query(
        'UPDATE docs_projects SET active_publication_id=$1 WHERE id=$2',
        [publication.id, projectId],
      );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action,metadata) VALUES($1,$2,$3,$4)',
        [
          projectId,
          subject,
          'publication.activated',
          JSON.stringify({
            publicationId: publication.id,
            artifactId,
            previousPublicationId: expected,
          }),
        ],
      );
      await client.query('COMMIT');
      return publication;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23503')
        throw new ConflictError(
          'Register a verified artifact before publishing',
        );
      throw error;
    } finally {
      client.release();
    }
  }
  async publications(projectId: string): Promise<Publication[]> {
    return (
      await this.pool.query<Publication>(
        `SELECT ${publicationColumns} FROM docs_publications WHERE project_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [projectId],
      )
    ).rows;
  }
  async audit(projectId: string): Promise<Record<string, unknown>[]> {
    return (
      await this.pool.query(
        'SELECT id::text,actor,action,metadata,created_at::text FROM docs_audit WHERE project_id=$1 ORDER BY id DESC LIMIT 100',
        [projectId],
      )
    ).rows as Record<string, unknown>[];
  }
  async createToken(
    projectId: string,
    hash: string,
    label: string,
    role: Role,
    expiresAt: Date,
    actor: string,
  ): Promise<string> {
    const id = randomUUID();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO docs_tokens(id,project_id,token_hash,label,role,expires_at) VALUES($1,$2,$3,$4,$5,$6)',
        [id, projectId, hash, label, role, expiresAt],
      );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action,metadata) VALUES($1,$2,$3,$4)',
        [
          projectId,
          actor,
          'token.created',
          JSON.stringify({ tokenId: id, role, label }),
        ],
      );
      await client.query('COMMIT');
      return id;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async token(
    hash: string,
  ): Promise<{ subject: string; projectId: string; role: Role } | undefined> {
    const token = (
      await this.pool.query<{ id: string; projectId: string; role: Role }>(
        'SELECT id,project_id AS "projectId",role FROM docs_tokens WHERE token_hash=$1 AND revoked=false AND expires_at>now()',
        [hash],
      )
    ).rows[0];
    return token
      ? {
          subject: `token:${token.id}`,
          projectId: token.projectId,
          role: token.role,
        }
      : undefined;
  }
  async revokeToken(
    projectId: string,
    tokenId: string,
    actor: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE docs_tokens SET revoked=true WHERE id=$1 AND project_id=$2',
        [tokenId, projectId],
      );
      await client.query(
        'INSERT INTO docs_audit(project_id,actor,action,metadata) VALUES($1,$2,$3,$4)',
        [projectId, actor, 'token.revoked', JSON.stringify({ tokenId })],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async createSession(
    hash: string,
    subject: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pool.query('DELETE FROM docs_sessions WHERE expires_at<now()');
    await this.pool.query(
      'INSERT INTO docs_sessions(token_hash,subject,expires_at) VALUES($1,$2,$3)',
      [hash, subject, expiresAt],
    );
  }
  async session(hash: string): Promise<string | undefined> {
    return (
      await this.pool.query<{ subject: string }>(
        'SELECT subject FROM docs_sessions WHERE token_hash=$1 AND expires_at>now()',
        [hash],
      )
    ).rows[0]?.subject;
  }
  async deleteSession(hash: string): Promise<void> {
    await this.pool.query('DELETE FROM docs_sessions WHERE token_hash=$1', [
      hash,
    ]);
  }
  async saveOidc(transaction: OidcTransaction): Promise<void> {
    await this.pool.query('DELETE FROM docs_oidc WHERE expires_at<now()');
    await this.pool.query(
      'INSERT INTO docs_oidc(state_hash,nonce,verifier,expires_at) VALUES($1,$2,$3,$4)',
      [
        transaction.stateHash,
        transaction.nonce,
        transaction.verifier,
        transaction.expiresAt,
      ],
    );
  }
  async consumeOidc(hash: string): Promise<OidcTransaction | undefined> {
    return (
      await this.pool.query<OidcTransaction>(
        'DELETE FROM docs_oidc WHERE state_hash=$1 AND expires_at>now() RETURNING state_hash AS "stateHash",nonce,verifier,expires_at AS "expiresAt"',
        [hash],
      )
    ).rows[0];
  }
}
