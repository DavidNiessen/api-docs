# Implementation progress

Updated: 2026-10-22. **Approximately 67% complete; pre-release.** This is an engineering estimate of implemented scope and remaining launch work, not measured test coverage. A working feature does not complete its production acceptance gate. The binding scope and release checklist remain in the [delivery plan](03-delivery-and-launch.md).

## Current milestone status

| Milestone                | Implemented                                                                                                                                                                                  | Remaining before acceptance                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Foundation          | Workspace, strict TypeScript, formatting/lint, community policies and feature/PR/default-branch workflows                                                                                    | Verify remote checks and repository protections; finalize contribution certification and release ownership                                                    |
| M1 — Reader              | Responsive React reader, static export, search, explorer, themes, subpath hosting and browser journeys                                                                                       | Final design, keyboard and independent accessibility review                                                                                                   |
| M2 — Compiler            | OpenAPI 3.0/3.1 YAML/JSON, bounded local references, recursive/composed schemas, examples, Markdown/MDX, incremental builds and immutable manifests                                          | Complete advertised standards fixtures and supported-keyword review; remote-source importing remains unimplemented                                            |
| M3 — Consumer experience | Authored examples/media selection, five executable snippet generators, local search, branding, flat parameter styles, content parameters, OAuth PKCE and object-body field editing/redaction | Recursive/composed form controls, multipart/form bodies, remaining serialization boundaries, shared safe authentication state, navigation/i18n lifecycle work |
| M4 — Extensibility       | Bounded graph-transform plugins with conformance checks; Node, Java and Spring adapters                                                                                                      | Source/snippet/theme hooks and examples; finish the packaged runtime matrix and external integration journeys                                                 |
| M5 — Self hosting        | PostgreSQL publication, role-based access, sessions/OIDC, publish tokens, audit, Studio, containers and tested restore/rollback procedures                                                   | Harden isolated build execution, implement the explicitly configured relay, complete outage/fault/upgrade and supported-topology rehearsals                   |
| M6 — Release engineering | Doctor, conservative contract diff, offline static artifacts, npm candidate packaging, installed consumers and candidate SBOM                                                                | Deprecation center, semantic version/changelog tooling, signed npm/Maven/container publication and provenance verification                                    |
| M7 — Launch              | Local automated validation and documented performance experiments                                                                                                                            | Independent pilots, security/accessibility review, complete license/distribution audit, protected release approval and registry installation verification     |

## Latest completed increment

JSON request bodies now offer schema-aware object-field editing alongside the raw editor. The editor retains exact numeric tokens and unknown properties, supports enums/booleans/nulls and blocks requests while field drafts are incomplete. JSON snippets redact password/write-only fields and decoded known credentials, including nested and referenced values. Redaction failures omit the body from the example while preserving the actual editable request. See [body editing and limits](../explorer-bodies.md).

Validation for this increment:

- Formatting, ESLint, Markdown lint, strict typechecking and production builds passed.
- 258 unit tests and all 15 browser tests passed. Browser coverage includes exact request bytes, invalid-draft recovery, light/dark accessibility checks and mobile width.
- Twelve npm components were packed and installed in a separate consumer. The consumer exercised the new JSON helpers/redactor in addition to public types, CLI, plugin/MDX workers, strict doctor, artifact verification and authenticated Express/Fastify paths. Cache-only lockfile reinstall and dependency audit also passed.

These results apply to the tested local candidate. They do not establish a complete platform matrix, independent review or installation from published registries.

## External launch dependencies

GitHub Actions has been unable to start because of the repository account's billing or spending limit. Local checks pass, but remote CI has not been verified. Maintainers must resolve that account setting before its checks can serve as release evidence.

Package scope ownership, Maven namespace/signing, registry publication, final product naming and protected repository/environment settings still require owner-controlled setup. No public packages or stable release have been published. External pilots and independent security/accessibility reviews remain required.

Progress updates should state the approximate percentage, the completed increment, its validation and material remaining work. Keep this record current after each completed implementation step; do not raise the estimate solely because additional tests were added.
