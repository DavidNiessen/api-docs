# Implementation progress

Updated: 2026-10-22. **Approximately 72% complete; pre-release.** This is an engineering estimate of implemented scope and remaining launch work, not measured test coverage. A working feature does not complete its production acceptance gate. The binding scope and release checklist remain in the [delivery plan](03-delivery-and-launch.md).

## Current milestone status

| Milestone                | Implemented                                                                                                                                                                                                                        | Remaining before acceptance                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Foundation          | Workspace, strict TypeScript, formatting/lint, community policies and feature/PR/default-branch workflows                                                                                                                          | Verify remote checks and repository protections; finalize contribution certification and release ownership                                                    |
| M1 — Reader              | Responsive React reader, static export, search, explorer, themes, subpath hosting and browser journeys                                                                                                                             | Final design, keyboard and independent accessibility review                                                                                                   |
| M2 — Compiler            | OpenAPI 3.0/3.1 YAML/JSON, bounded local references, recursive/composed schemas, examples, Markdown/MDX, incremental builds and immutable manifests                                                                                | Complete advertised standards fixtures and supported-keyword review; remote-source importing remains unimplemented                                            |
| M3 — Consumer experience | Authored examples/media selection, five executable snippet generators, local search, branding, flat parameter styles, content parameters, OAuth PKCE and object-body field editing/redaction and form-urlencoded reader/SDK inputs | Recursive/composed form controls, multipart bodies, remaining serialization boundaries, shared safe authentication state, navigation and internationalization |
| M4 — Extensibility       | Bounded graph-transform plugins with conformance checks; Node, Java and Spring adapters with portable manifest verification and optional digest pins                                                                               | Source/snippet/theme hooks and examples; validate installed-JAR consumers and external integration journeys                                                   |
| M5 — Self hosting        | PostgreSQL publication, role-based access, sessions/OIDC, publish tokens, audit, Studio, containers and tested restore/rollback procedures                                                                                         | Harden isolated build execution, implement the explicitly configured relay, complete outage/fault/upgrade and supported-topology rehearsals                   |
| M6 — Release engineering | Doctor, conservative contract diff, offline static artifacts, npm candidate packaging, installed consumers, candidate SBOM, lifecycle policies and a static deprecation center                                                     | Semantic version/changelog tooling, signed npm/Maven/container publication and provenance verification                                                        |
| M7 — Launch              | Local automated validation and documented performance experiments                                                                                                                                                                  | Independent pilots, security/accessibility review, complete license/distribution audit, protected release approval and registry installation verification     |

## Latest completed increment

The reader now includes a static deprecation center with 50-operation pages, complete API/version filters and migration/replacement links. Operation notices show declared dates and guidance. Filters and pagination work without JavaScript and under a deployment base path. Browser status uses the visitor's UTC date; generated artifacts retain only declarations, preserving deterministic output. The center participates in manifest verification, sitemaps, doctor route checks and existing private-host authentication. See the [lifecycle reference](../lifecycle.md).

Validation for this increment:

- Formatting, ESLint, Markdown lint, TypeScript and all 324 unit/component tests passed.
- All 18 browser journeys passed; after the final mobile navigation adjustment, the 6 reader/lifecycle journeys passed again. New coverage exercises both themes, automated accessibility, narrow layouts, static pagination, cross-version links and no-JavaScript navigation.
- All 9 PostgreSQL integration tests passed, including unauthorized center access, authenticated access without shared caching, and access denial after viewer-token revocation.
- All 12 packed components installed outside the workspace. The installed Express and Fastify adapters authenticated both center HTML and page data.
- A 10,000-entry fixture verifies complete inventory pagination while ordinary guide payloads remain below 30,000 serialized characters and a catalog page below 70,000 for that fixture. This is a functional payload check, not a new hardware performance benchmark.

These results apply to the tested local candidate. They do not establish a complete platform matrix, independent review or installation from published registries.

## External launch dependencies

GitHub Actions has been unable to start because of the repository account's billing or spending limit. Local checks pass, but remote CI has not been verified. Maintainers must resolve that account setting before its checks can serve as release evidence.

Package scope ownership, Maven namespace/signing, registry publication, final product naming and protected repository/environment settings still require owner-controlled setup. No public packages or stable release have been published. External pilots and independent security/accessibility reviews remain required.

Progress updates should state the approximate percentage, the completed increment, its validation and material remaining work. Keep this record current after each completed implementation step; do not raise the estimate solely because additional tests were added.
