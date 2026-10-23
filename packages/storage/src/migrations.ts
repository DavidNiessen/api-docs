/** Append-only migration registry. Published migration SQL must not be edited. */
export const databaseSchemaVersion = 2;
export const schemaBootstrap = `CREATE TABLE IF NOT EXISTS docs_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());`;
export const migrations: readonly { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `        CREATE TABLE IF NOT EXISTS docs_projects (id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, visibility text NOT NULL CHECK (visibility IN ('public','private')), active_publication_id uuid);
        CREATE TABLE IF NOT EXISTS docs_roles (project_id uuid NOT NULL REFERENCES docs_projects(id) ON DELETE CASCADE, subject text NOT NULL, role text NOT NULL CHECK (role IN ('viewer','editor','publisher','admin')), PRIMARY KEY(project_id,subject));
        CREATE TABLE IF NOT EXISTS docs_artifacts (project_id uuid NOT NULL REFERENCES docs_projects(id), artifact_id text NOT NULL, PRIMARY KEY(project_id,artifact_id));
        CREATE TABLE IF NOT EXISTS docs_publications (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), artifact_id text NOT NULL, subject text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), idempotency_key text NOT NULL, UNIQUE(project_id,idempotency_key), FOREIGN KEY(project_id,artifact_id) REFERENCES docs_artifacts(project_id,artifact_id));
        CREATE TABLE IF NOT EXISTS docs_audit (id bigserial PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), actor text NOT NULL, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
        CREATE TABLE IF NOT EXISTS docs_tokens (id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id), token_hash text UNIQUE NOT NULL, label text NOT NULL, role text NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false);
        CREATE TABLE IF NOT EXISTS docs_sessions (token_hash text PRIMARY KEY, subject text NOT NULL, expires_at timestamptz NOT NULL);
        CREATE TABLE IF NOT EXISTS docs_oidc (state_hash text PRIMARY KEY, nonce text NOT NULL, verifier text NOT NULL, expires_at timestamptz NOT NULL);
        CREATE INDEX IF NOT EXISTS docs_sessions_expiry ON docs_sessions(expires_at);
        CREATE INDEX IF NOT EXISTS docs_publications_project ON docs_publications(project_id,created_at DESC);`,
  },
  {
    version: 2,
    sql: `CREATE TABLE docs_build_sources (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id) ON DELETE CASCADE,
 label varchar(120) NOT NULL, revision varchar(200), snapshot jsonb NOT NULL, policy jsonb NOT NULL,
 approved_by varchar(4096) NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz,
 key_hash char(64) NOT NULL, request_hash char(64) NOT NULL,
 UNIQUE(project_id,id), UNIQUE(project_id,key_hash),
 CHECK (jsonb_typeof(snapshot)='object' AND snapshot ?& ARRAY['digestVersion','digest','bytes','files'] AND snapshot->>'digestVersion'='2'),
 CHECK (jsonb_typeof(policy)='object' AND policy->>'schemaVersion'='1'),
 CHECK (octet_length(snapshot::text)<=1024 AND octet_length(policy::text)<=16384)
);
CREATE TABLE docs_build_jobs (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES docs_projects(id) ON DELETE CASCADE, source_id uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('queued','running','succeeded','failed','cancelled')), requested_by varchar(4096) NOT NULL,
 key_hash char(64) NOT NULL, request_hash char(64) NOT NULL,
 attempts integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
 worker_id varchar(64), lease_token_hash char(64), settled_lease_hash char(64),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(), started_at timestamptz, finished_at timestamptz,
 lease_expires_at timestamptz, deadline_at timestamptz, artifact_id text, error_code text, result jsonb,
 UNIQUE(project_id,key_hash), FOREIGN KEY(project_id,source_id) REFERENCES docs_build_sources(project_id,id),
 FOREIGN KEY(project_id,artifact_id) REFERENCES docs_artifacts(project_id,artifact_id),
 CHECK(max_attempts BETWEEN 1 AND 3 AND attempts BETWEEN 0 AND max_attempts),
 CHECK((state='running')=(lease_token_hash IS NOT NULL)), CHECK((state='running')=(lease_expires_at IS NOT NULL)),
 CHECK(state<>'running' OR (worker_id IS NOT NULL AND deadline_at IS NOT NULL AND started_at IS NOT NULL AND attempts>0)),
 CHECK((state='succeeded')=(artifact_id IS NOT NULL)), CHECK((state='succeeded')=(result IS NOT NULL)),
 CHECK((state IN ('succeeded','failed','cancelled'))=(finished_at IS NOT NULL)),
 CHECK(state NOT IN ('running','succeeded') OR error_code IS NULL),
 CHECK(state<>'failed' OR error_code IS NOT NULL),
 CHECK(error_code IS NULL OR error_code IN ('build_failed','worker_lost','source_changed','deadline_exceeded','source_revoked','cancelled')),
 CHECK(result IS NULL OR octet_length(result::text)<=4096)
);
CREATE INDEX docs_build_sources_project ON docs_build_sources(project_id,created_at DESC,id DESC);
CREATE INDEX docs_build_sources_active ON docs_build_sources(project_id) WHERE revoked_at IS NULL;
CREATE INDEX docs_build_jobs_project ON docs_build_jobs(project_id,created_at DESC,id DESC);
CREATE INDEX docs_build_jobs_pending ON docs_build_jobs(available_at,created_at,id) WHERE state='queued';
CREATE INDEX docs_build_jobs_running ON docs_build_jobs(lease_expires_at) WHERE state='running';
CREATE INDEX docs_build_jobs_capacity ON docs_build_jobs(project_id,state) WHERE state IN ('queued','running');`,
  },
];
