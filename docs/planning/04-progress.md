# Implementation progress

Updated: 2026-10-22. **Approximately 71% complete; pre-release.** This is an engineering estimate of implemented scope and remaining launch work, not measured test coverage. A working feature does not complete its production acceptance gate. The binding scope and release checklist remain in the [delivery plan](03-delivery-and-launch.md).

## Current milestone status

| Milestone                | Implemented                                                                                                                                                                                                                        | Remaining before acceptance                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Foundation          | Workspace, strict TypeScript, formatting/lint, community policies and feature/PR/default-branch workflows                                                                                                                          | Verify remote checks and repository protections; finalize contribution certification and release ownership                                                |
| M1 — Reader              | Responsive React reader, static export, search, explorer, themes, subpath hosting and browser journeys                                                                                                                             | Final design, keyboard and independent accessibility review                                                                                               |
| M2 — Compiler            | OpenAPI 3.0/3.1 YAML/JSON, bounded local references, recursive/composed schemas, examples, Markdown/MDX, incremental builds and immutable manifests                                                                                | Complete advertised standards fixtures and supported-keyword review; remote-source importing remains unimplemented                                        |
| M3 — Consumer experience | Authored examples/media selection, five executable snippet generators, local search, branding, flat parameter styles, content parameters, OAuth PKCE and object-body field editing/redaction and form-urlencoded reader/SDK inputs | Recursive/composed form controls, multipart bodies, remaining serialization boundaries, shared safe authentication state, navigation/i18n lifecycle work  |
| M4 — Extensibility       | Bounded graph-transform plugins with conformance checks; Node, Java and Spring adapters with portable manifest verification and optional digest pins                                                                               | Source/snippet/theme hooks and examples; validate installed-JAR consumers and external integration journeys                                               |
| M5 — Self hosting        | PostgreSQL publication, role-based access, sessions/OIDC, publish tokens, audit, Studio, containers and tested restore/rollback procedures                                                                                         | Harden isolated build execution, implement the explicitly configured relay, complete outage/fault/upgrade and supported-topology rehearsals               |
| M6 — Release engineering | Doctor, conservative contract diff, offline static artifacts, npm candidate packaging, installed consumers, candidate SBOM and lifecycle metadata/CLI policies                                                                     | Reader deprecation center, semantic version/changelog tooling, signed npm/Maven/container publication and provenance verification                         |
| M7 — Launch              | Local automated validation and documented performance experiments                                                                                                                                                                  | Independent pilots, security/accessibility review, complete license/distribution audit, protected release approval and registry installation verification |

## Latest completed increment

Lifecycle metadata now supports real calendar dates, cross-version replacement targets and migration guides. The new `lifecycle` CLI inventories deprecated and planned retirements at an explicit date, supports deadline gates, and separately checks unresolved replacements or missing migration guidance. Source normalization and plugins share validation; doctor checks local migration routes/anchors, and contract diff flags accelerated retirement dates for review. See the [lifecycle contract and CLI](../lifecycle.md). The reader center remains pending.

Validation for this increment:

- The full local check passed: formatting, ESLint, Markdown lint, TypeScript and 320 unit/component tests.
- All 16 browser journeys passed, including live requests and accessibility checks on the existing reader.
- All 12 packed components installed outside the workspace; the installed CLI and plugin SDK preserved lifecycle metadata and produced the expected inventory.
- Lifecycle coverage includes YAML/JSON parity, invalid dates and URLs, missing/ambiguous/self replacements, guide anchors, date boundaries and positive/negative CLI policies.

These results apply to the tested local candidate. They do not establish a complete platform matrix, independent review or installation from published registries.

## External launch dependencies

GitHub Actions has been unable to start because of the repository account's billing or spending limit. Local checks pass, but remote CI has not been verified. Maintainers must resolve that account setting before its checks can serve as release evidence.

Package scope ownership, Maven namespace/signing, registry publication, final product naming and protected repository/environment settings still require owner-controlled setup. No public packages or stable release have been published. External pilots and independent security/accessibility reviews remain required.

Progress updates should state the approximate percentage, the completed increment, its validation and material remaining work. Keep this record current after each completed implementation step; do not raise the estimate solely because additional tests were added.
