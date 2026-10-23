# Durable build queue foundation

The PostgreSQL adapter exposes a typed `buildJobs` repository for approved source metadata and durable build jobs. This increment provides persistence and concurrency controls. The management HTTP API, separate worker executable and Studio build controls are still pending; installing the server does not start queued source builds. Use the existing operator-only [isolated build runner](isolated-builds.md) for executable builds.

## Approved sources

`approveSource(projectId, input, idempotencyKey, actor)` records a label, optional revision, version 2 source snapshot identity and an explicit build policy. Generate snapshot metadata with `inspectIsolatedSource` or `api-docs source-info`; prepare and retain the matching secret-free source directory on a trusted build host. Database approval does not read, download or verify a local directory. It stores no source paths, checkout credentials or source contents.

`readBuildPolicy` from `@api-docs/contracts` validates an immutable builder image, a visible project-relative configuration path, plugin/content trust decisions and resource limits. Trust flags default to false. A mutable image tag, hidden/traversing config path, unknown option or invalid limit is rejected. Limits are the same data contract used by the isolated runner:

| Resource       | Default   | Accepted range |
| -------------- | --------- | -------------- |
| Build deadline | 180000 ms | 1000–900000 ms |
| Memory         | 2048 MiB  | 512–4096 MiB   |
| CPU count      | 2         | 1–4, integer   |
| Process count  | 128       | 32–512         |
| Source size    | 128 MiB   | 1–1024 MiB     |
| Output size    | 256 MiB   | 32–1024 MiB    |

Approval requires a nonempty snapshot within its source-size budget. At most 1000 source approvals can be active per project. Revocation releases this inventory capacity, cancels queued/running jobs for that source and invalidates their leases. Finished job history remains available. The source directory must be retained separately if future retries need it; the ordinary artifact/database backup does not contain build sources.

Source approvals and enqueues use project-scoped idempotency keys of 1–100 characters. Retrying the same normalized request and actor returns its original record. Reusing that key for another request conflicts. Only hashes of keys and request fingerprints are persisted, and public records omit them. Keep the original key when retrying an uncertain database commit.

## Job lifecycle and ownership

Jobs move from `queued` to `running`, then to `succeeded`, `failed` or `cancelled`. A worker claims only explicitly allowed source IDs. FIFO claims use database row locks, `SKIP LOCKED` and an advisory capacity gate; concurrent workers cannot own the same job or exceed configured limits. The PostgreSQL adapter shares its existing bounded metadata pool with the queue.

An optional `buildQueue` value in `PostgresRepositoryOptions` lowers these limits:

| Limit                                  | Default and maximum |
| -------------------------------------- | ------------------- |
| Queued plus running jobs, all projects | 1000                |
| Queued plus running jobs, one project  | 20                  |
| Running jobs, all projects             | 16                  |
| Running jobs, one project              | 2                   |

Values must be positive integers with consistent global/project bounds. Lowering a global limit also clamps omitted related defaults. All processes sharing a queue must use the same configured limits. These admission limits do not allocate CPU/memory or substitute for the worker's own host concurrency budget.

`claim` returns a random lease token once; only its hash is stored. Public job/source views and audit metadata omit it. Leases last 10–120 seconds, defaulting to 60. `heartbeat` renews current ownership only, with an absolute deadline of the approved build timeout plus two minutes for orchestration. It cannot revive an expired or cancelled lease. Workers must abort their isolated runner if renewal fails or ownership is lost.

`recoverExpired` processes up to 32 expired jobs per call. `claim` also performs recovery. A lost worker can be retried up to three attempts; retry eligibility waits until the prior attempt's absolute deadline, so a new attempt does not start inside its old execution budget. Final exhaustion fails the job. This persistence rule requires the separate runner's watchdog and bounded execution to terminate abandoned workloads; database cancellation alone does not stop containers.

`cancel` is terminal and invalidates ownership. A worker-reported failure is terminal; automatically repeating arbitrary failed source code is unsupported. Safe fixed error codes describe failures without persisting logs or exception text. Repeated successful completion/failure with the same settled token and identical metadata is idempotent; a stale lease cannot settle a newer attempt or change an already settled outcome.

## Artifact and authorization boundary

`complete` checks aggregate source identity, the approved image, current tool version and duration, then atomically registers the artifact and records success/audit. It does not publish the artifact or change the project's active publication. Activation still requires the existing publication authorization and expected-pointer flow.

The repository is an internal trusted port. It does not authenticate actors, authorize project membership, execute Docker, verify filesystem artifacts or prove a worker's receipt. Its caller must enforce those boundaries. The future worker must use `expectedSourceDigest` before any plugin/MDX execution, verify and stage the immutable artifact, and only then call completion. Keep the Docker socket and worker credentials away from the request server and source workload.

`sources(projectId, { after, activeOnly })` and `jobs(projectId, after)` return at most 100 entries plus `nextCursor`. Continue with that cursor for complete history. Ordering is creation time and UUID descending; cursor lookups remain within the project. Job/source reads contain only their documented fields, ISO UTC dates and bounded result metadata.

## Schema upgrades and acceptance

This adapter requires database schema version **2**. Run the matching schema-owner migration before starting its runtime. A fresh database receives migrations 1 and 2; an existing version 1 installation upgrades atomically while retaining projects, roles, publications and audit. Incomplete/future migration histories fail closed. Failed migration transactions leave no partial queue tables. Run `DB_RUNTIME_ROLE` grants through the migration executable for the new tables; migration history stays read-only and audit stays append-only for the runtime role.

Keep the application image matched to the database schema. An older version 1 runtime will refuse a version 2 database; restore a compatible recovery set for a schema rollback. No automatic down-migration is provided. See the [deployment and recovery runbook](deployment.md).

Acceptance tests use actual PostgreSQL concurrent claims, lock interleavings, expirations, capacity limits, cancellation, revocation, idempotency, pagination and upgrade rollback. `TEST_DATABASE_URL` must refer to a disposable schema-owner fixture. The runtime-grant acceptance case additionally needs `CREATEROLE` or a test superuser to create/drop its isolated runtime identity; production migration roles do not require that test-only permission. Queue workflow acceptance with the HTTP API, real worker and Docker remains pending.
