# Container deployment and recovery

This is the tested single-host, filesystem-storage deployment for the prerelease. It does not yet provide a production support commitment. Use an external TLS reverse proxy, encrypted disks and off-host backups. Keep source builds and plugins outside the reader container.

## Start a fresh installation

Requirements: Docker Engine with Compose v2, Node.js 24 for the operator scripts, and a clone of this repository. Ports bind to loopback. PostgreSQL is on an internal network and has no published port.

```sh
node scripts/init-deployment.mjs
export PUBLIC_URL=https://docs.example.com
export COMPOSE_PROJECT_NAME=api-docs
# Builds from the committed lockfile; the base images are pinned by digest.
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml up -d --wait
```

The setup script refuses to replace existing secrets. The containing directory is private (0700); files inside it are read-only and readable by the different container users through Docker secret bind mounts. Do not relax the parent directory permissions. Configure your secret manager in place of these files on a managed platform. Store an encrypted copy separately from the application backups. Database password changes require PostgreSQL role rotation as well as updating the matching connection secret; replacing a file alone does not change a database password.

Only for local evaluation, use `PUBLIC_URL=http://127.0.0.1:8080 INSECURE_DEVELOPMENT=true`. Production requires the actual HTTPS origin. Visit `/admin/` and supply the operator token from your secret store through its secure input. The token is exchanged for an opaque session. Do not pass tokens as command line arguments or paste them into issue reports.

The `migrate` job owns the schema, applies migrations under a transaction/advisory lock, and grants the runtime role access. The application role cannot create schema objects, mutate migration history, or update/delete audit rows. The application starts only after migration succeeds. Remote PostgreSQL deployments must use verified TLS and equivalent owner/runtime grants. For a source checkout, run `node apps/server/dist/migrate.js` with the migration connection before `npm run server` with the runtime connection; set `DB_RUNTIME_ROLE` during migration to apply the grants.

The reader runs as UID 1000, drops capabilities, uses a read-only root filesystem, and mounts artifacts read-only. Only a separate trusted publisher should mount the artifact volume writable. Build a project with `basePath: /docs/<project-slug>`, stage its verified output into that volume using the CLI image, then activate it through Studio or `api-docs publish`. See [CLI publishing](cli.md). A publication stores a digest and changes a database pointer atomically; changing an artifact in place is unsupported.

`deploy/Caddyfile` is a reverse-proxy configuration template. Set its `DOCS_HOST` and put Caddy on the application's frontend network (or change the upstream to the host's loopback port). Retain `/auth/callback`, `/admin/`, `/api/` and `/docs/` paths. Configure edge request limits; the application does not trust arbitrary forwarded client addresses. Anonymous static readers do not consume the management authentication rate-limit quota.

The cloud proxy's optional build CA is supported through `deploy/compose.cloud.yaml` and a BuildKit secret; it is not copied into the runtime image. Ordinary deployments should use the primary Compose file. Never disable certificate verification to build an image.

## Backup

Pause publication and artifact staging writers for the operation. Readers can remain online. Do not run artifact cleanup concurrently. The database dump is taken first, followed by the immutable artifact tree. Recovery sets include private documentation, scoped token hashes and audit history; encrypt and restrict them as sensitive data. Browser sessions and pending OIDC exchanges are intentionally excluded.

```sh
# Keep PUBLIC_URL and the source deployment's secret configuration set.
export COMPOSE_PROJECT_NAME=api-docs
node scripts/recovery.mjs backup /secure-backups/api-docs-2026-10-22 --writers-paused
```

The destination must not exist. A successful set contains `database.dump`, `artifacts.tar` and `recovery.json` with SHA-256 checksums. An `.incomplete` marker means the backup failed. Move completed sets to encrypted off-host storage, retain the matching application image and deployment configuration, and test recovery regularly. Checksums detect corruption; they do not authenticate a backup from an untrusted source. Treat recovery sets as privileged deployable content.

## Restore rehearsal and disaster recovery

Restore into a **new Compose project with fresh volumes**, never over the live deployment. Use the same compatible application image and PostgreSQL major version. Generate a separate secret directory for the new database roles; retain the old root token only if your incident policy permits it. A new root token invalidates old operator sessions. Scoped tokens retain their existing hashes and revocations.

```sh
node scripts/init-deployment.mjs deploy/.secrets/recovery
export COMPOSE_PROJECT_NAME=api-docs-recovery
export DOCS_SECRETS_DIR=.secrets/recovery
export PUBLIC_URL=http://127.0.0.1:8087
export DOCS_PORT=8087
export INSECURE_DEVELOPMENT=true
node scripts/recovery.mjs restore /secure-backups/api-docs-2026-10-22 --writers-paused
docker compose -f deploy/compose.yaml up -d --no-build --wait
```

The script checks backup hashes, refuses a database with existing public tables or a nonempty artifact volume, verifies every restored publication, restores the schema as its owner in one database transaction, and reapplies runtime grants. The writable artifact override is used only for the temporary recovery helper. If recovery fails, keep the failed environment for diagnosis and retry into another fresh project; the script does not erase or repair existing volumes.

Verify readiness, public pages, private page/search denial, authenticated access, publication history and audit records before exposing traffic. Apply a production HTTPS origin and TLS proxy before switching DNS. Measure and record your own recovery time and recovery point objectives. Application rollback can activate a retained previous artifact; database schema rollback requires a compatible recovery set and cannot be achieved by merely starting an older container.

## Kubernetes template

`deploy/kubernetes.yaml` is a starting template, not a turnkey managed cluster installer. Supply a `ConfigMap` named `api-docs` with `public-url`, a `Secret` named `api-docs` with `database-url` (runtime role) and `root-token`, and a PVC named `api-docs-artifacts`. Provision PostgreSQL and run the migration job separately with the owner connection and `DB_RUNTIME_ROLE`. Replace `api-docs:local` with your reviewed registry image digest. Configure a TLS Ingress, encrypted storage, backup jobs and network policies according to the cluster's provider. The current template uses one replica and a Recreate rollout; shared multi-replica storage and cluster recovery remain unvalidated release gates.
