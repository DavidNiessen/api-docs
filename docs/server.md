# Self-hosted server operations

The optional Fastify server uses PostgreSQL for projects, permissions, opaque sessions, hashed access tokens, publication pointers, and audit history. Static exports continue to work without it.

## Required configuration

| Variable                        | Purpose                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | PostgreSQL connection string; configure verified TLS for remote production databases  |
| `ROOT_TOKEN`                    | Random operator bearer token with at least 32 characters; generate and store securely |
| `PUBLIC_URL`                    | External HTTPS origin used for cookies, OIDC callbacks and CSRF checks                |
| `ARTIFACT_ROOT`                 | Durable immutable artifact storage directory; default `/data/artifacts`               |
| `HOST`, `PORT`                  | Listening interface and port; defaults `0.0.0.0:8080`                                 |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID` | Optional identity provider discovery issuer and client id                             |
| `OIDC_CLIENT_SECRET`            | Optional confidential-client credential, supplied through a secret store              |
| `OIDC_ALLOWED_HOSTS`            | Additional operator-approved hostnames for OIDC endpoints                             |
| `INSECURE_DEVELOPMENT`          | Explicitly allow HTTP on loopback for local testing; never use in production          |

Run `npm run build` followed by `npm run server` with these variables supplied by your deployment system. Do not put production secrets in committed environment files. A template deployment and container distribution will accompany the release hardening work.

## Authentication and authorization

Operator requests use the root bearer token. Per-project tokens are created through `POST /api/projects/<id>/tokens` with a label, role, and expiry in days (1–90). The token is returned once and stored as a SHA-256 hash. Administrators can revoke it immediately.

OIDC login uses `/auth/login` and the registered callback `/auth/callback`. State, nonce, PKCE, issuer, audience and signature are checked. Reader identity is the immutable issuer + subject pair, never an email address. Bind that subject to a project role through `PUT /api/projects/<id>/roles`. Viewer, editor, publisher, and admin roles are ordered; public documentation grants anonymous reading, while all mutations require credentials.

Session cookies are opaque, HttpOnly, Secure on HTTPS, SameSite=Lax, and backed by expiring database records. Cookie-authenticated mutations require the exact configured origin. Logout deletes the session. Role revocation is checked on subsequent requests, including direct requests for search indexes, JSON data, specs and JavaScript assets.

## Deployment boundary

Terminate TLS at a trusted reverse proxy. The server does not blindly trust forwarded client addresses. Rate limits use the directly connected address; configure the proxy's limits as well. Keep the management API private when practical and grant publishers only access to the projects they maintain.

Artifacts are trusted executable web content and must be produced by reviewed builds. Operators control staging directories and keep them immutable. Do not grant untrusted authors write access to published artifacts or execute their plugins/MDX in a privileged process. Custom reader code has page-origin privileges; isolate documentation and administrative origins when supporting untrusted publishers.

## Health, backup, and recovery

`/health/live` reports process liveness. `/health/ready` checks database connectivity and returns 503 when unavailable. Use both for orchestration and monitoring.

Back up PostgreSQL and all referenced immutable artifact directories as one recovery set. Retain metadata and artifacts through the rollback window. Restore into a fresh environment, verify artifact checksums, then reconnect the metadata database before exposing traffic. A prior container alone cannot roll back a database schema migration.

The initial migration uses a transaction and advisory lock. Production deployments should separate migration ownership from a least-privileged runtime database role. Never delete referenced artifacts during backup or publication. Multi-replica shared storage, isolated build queues, and a rehearsed automated backup/restore command remain release gates.

## Integration validation

`TEST_DATABASE_URL` must point at a disposable PostgreSQL database. Run `npm run build && npm run test:integration`. Tests use a real database and a local signed OIDC provider, including private artifact access, token revocation, CSRF, state/nonce/PKCE, concurrent publication and audit records. Missing database configuration fails the suite rather than skipping it.
