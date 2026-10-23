# Self-hosted server operations

The optional Fastify server uses PostgreSQL for projects, permissions, opaque sessions, hashed access tokens, publication pointers, and audit history. Static exports continue to work without it.

An operator can explicitly enable the [authenticated API relay](api-relay.md) with `RELAY_CONFIG_FILE`. It requires assigned project membership, destination/header policy and bounded audited requests. It is disabled by default; public documentation does not grant anonymous relay access.

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
| `SHUTDOWN_TIMEOUT_MS`           | Graceful shutdown deadline, default 30000 ms; integer from 1000 to 300000             |
| `INSECURE_DEVELOPMENT`          | Explicitly allow HTTP on loopback for local testing; never use in production          |

Run `npm run build`, execute `node apps/server/dist/migrate.js` with the schema-owner connection, then run `npm run server` with the runtime connection. `DATABASE_URL_FILE` and `ROOT_TOKEN_FILE` support read-only secret files instead of environment values. Do not put production secrets in committed environment files. See the [container deployment and recovery runbook](deployment.md).

## Authentication and authorization

Operator requests use the root bearer token. Per-project tokens are created through `POST /api/projects/<id>/tokens` with a label, role, and expiry in days (1–90). The token is returned once and stored as a SHA-256 hash. Administrators can revoke it immediately.

OIDC login uses `/auth/login` and the registered callback `/auth/callback`. State, nonce, PKCE, issuer, audience and signature are checked. Reader identity is the immutable issuer + subject pair, never an email address. Bind that subject to a project role through `PUT /api/projects/<id>/roles`. Viewer, editor, publisher, and admin roles are ordered; public documentation grants anonymous reading, while all mutations require credentials.

Session cookies are opaque, HttpOnly, Secure on HTTPS, SameSite=Lax, and backed by expiring database records. Studio exchanges a supplied operator/project token through `POST /auth/token` for a session; raw credentials are cleared from the form. Token-backed sessions recheck revocation on every request, and rotating the operator token invalidates its existing sessions. Cookie-authenticated mutations require the exact configured origin. Logout deletes the session. Role revocation is checked on subsequent requests, including direct requests for search indexes, JSON data, specs and JavaScript assets.

## Deployment boundary

Terminate TLS at a trusted reverse proxy. The server does not blindly trust forwarded client addresses. Rate limits use the directly connected address; configure the proxy's limits as well. Management/authentication traffic has a separate 300-request/minute bucket; credential-bearing reader traffic has a 12,000-request/minute bucket. Anonymous static traffic does not consume those buckets. Keep the management API private when practical and grant publishers only access to the projects they maintain.

Artifacts are trusted executable web content and must be produced by reviewed builds. Operators control staging directories and keep them immutable. Do not grant untrusted authors write access to published artifacts or execute their plugins/MDX in a privileged process. Custom reader code has page-origin privileges; isolate documentation and administrative origins when supporting untrusted publishers.

## Health, backup, and recovery

`/health/live` reports process liveness. `/health/ready` checks database connectivity and returns 503 when unavailable. Use both for orchestration and monitoring.

Back up PostgreSQL and all referenced immutable artifact directories as one recovery set. Retain metadata and artifacts through the rollback window. Restore into a fresh environment, verify artifact checksums, then reconnect the metadata database before exposing traffic. A prior container alone cannot roll back a database schema migration.

The initial migration uses a transaction and advisory lock. The Compose deployment separates migration ownership from the runtime role and enforces an append-only audit log for that role. Never delete referenced artifacts during backup or publication. The recovery command restores only into a fresh deployment and verifies artifact checksums. Multi-replica shared storage and isolated build queues remain release gates.

## Process shutdown

The executable owns a single shutdown path for SIGINT and SIGTERM, including repeated or mixed signals. It stops accepting requests, lets active HTTP responses finish, closes newly idle keep-alive sockets, then ends both PostgreSQL pools. A response whose headers are sent during draining carries `Connection: close`; a stream already in progress can finish before its socket closes. Programmatic `createServer()` callers keep ownership of their repository and process signal handlers; call `app.close()` before `repository.close()`.

A signal during startup marks it cancelled: resource acquisition settles before cleanup, and the executable checks cancellation before listening. Startup failures, including schema initialization and port binding, use the same cleanup path. Error logs contain a generic operational message rather than raw exceptions or connection credentials.

`SHUTDOWN_TIMEOUT_MS` starts when shutdown is requested, defaults to 30000, and accepts integer milliseconds from 1000 to 300000. If startup or cleanup does not settle within that budget, or cleanup fails, the executable exits with status 1. A successful signal shutdown exits normally; startup failure remains nonzero even when cleanup succeeds. A forced exit can interrupt requests. For an uncertain publication result, inspect publication history and retry with the original idempotency key and expected publication pointer.

Configure the supervisor's termination grace period above this deadline. The supplied Compose and Kubernetes templates allow 45 seconds for the default 30-second application budget. Increase both values together in deployment overrides. These process checks do not establish Kubernetes/multi-replica or database outage acceptance.

## Integration validation

`TEST_DATABASE_URL` must point at a disposable PostgreSQL database. Run `npm run build && npm run test:integration`. Tests use a real database and a local signed OIDC provider, including private artifact access, token revocation, CSRF, state/nonce/PKCE, concurrent publication and audit records. Spawned production executables connect to that database, then encounter either a nonexistent schema search path or an occupied listener port; both must release their pools with a nonzero exit. A five-second hard test timeout distinguishes cleanup from the pool idle timeout. The regular source suite additionally sends actual OS signals to isolated child servers and verifies live HTTP/stream draining, repeated signals, startup cancellation and forced shutdown deadlines. Missing database configuration fails the suite rather than skipping it.

## Immutable metadata cache

The reader caches only manifest file allowlists, with bounded LRU storage and coalesced loads. Permissions and active publication pointers remain fresh database reads. Changing a publication or revoking a token/role takes effect on the next request. Root-token rotation deletes stale operator sessions rather than turning their internal markers into ordinary user identities. Fault-injection tests verify readiness returns 503 and cached private content stays unavailable when repository reads fail. See the [server delivery measurements](performance.md).
