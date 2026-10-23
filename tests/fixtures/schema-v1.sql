-- Historical schema captured before queue migration (ff2c87f).
CREATE TABLE IF NOT EXISTS docs_schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
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
        INSERT INTO docs_schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
