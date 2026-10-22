# Performance verification

Performance numbers describe measured fixtures, not a universal service guarantee. Run `node --max-old-space-size=1536 scripts/benchmark.mjs 10000` after `npm run build`. The script builds real static pages, verifies output, checks 100 local search queries, records peak process RSS, and fails when its declared budgets are exceeded. Generated fixtures and reports stay under ignored `.api-docs` paths.

## Recorded baseline

A cloud Linux run on 22 October 2026 used Node 24.19.0 with four reported available CPUs, a 1536 MiB V8 old-space limit, and an OpenAPI 3.1 fixture with 10,000 operations and 50,000 schema nodes.

| Measurement                            | Observed  | Budget              |
| -------------------------------------- | --------- | ------------------- |
| Complete static build and verification | 91.80 s   | 120 s               |
| Peak process RSS                       | 750.6 MiB | 2048 MiB            |
| Warm search query p95, 100 samples     | 10.78 ms  | 100 ms              |
| Representative endpoint HTML           | 92.3 KiB  | Reported separately |

This baseline uses route-specific content and bounded navigation. Reader JavaScript was approximately 79 KiB gzip before the dedicated search worker was added. Vite reports current bundle sizes in every production build. Cold search index transfer, browser rendering, and server request latency are separate measurements and must not be inferred from a warm Node search benchmark.

## Implementation controls

Pages embed only their active guide/operation and reachable schemas. Navigation includes bounded groups and always includes the active endpoint; large sites offer search for the full corpus. Page transitions fetch the corresponding `page-data.json`. Search data is partitioned into 500-record shards, fetched with bounded concurrency on demand, and queried in a Web Worker. A synchronous fallback preserves search if workers are unavailable.

Static pages remain readable without JavaScript. Assets are served with revalidation rather than an unsafe immutable cache policy on stable filenames. Publication manifests verify every generated file before activation.

## Remaining performance gates

The initial full-build/search budgets pass on the recorded fixture. Incremental guide rebuild timing, controlled browser LCP/CLS/interaction runs, and the documented server concurrency/latency scenario still require dedicated evidence before a production release claim. Avoid extrapolating these results to different hardware, content sizes, plugin behavior, or private-network APIs.
