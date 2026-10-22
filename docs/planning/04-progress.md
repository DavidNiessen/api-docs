# Implementation progress

Updated: 2026-10-22. **Approximately 76% complete; pre-release.** This is an engineering estimate of implemented scope and remaining launch work, not measured test coverage. A working feature does not complete its production acceptance gate. The binding scope and release checklist remain in the [delivery plan](03-delivery-and-launch.md).

## Current milestone status

| Milestone                | Implemented                                                                                                                                                                                                                                                                                                                        | Remaining before acceptance                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Foundation          | Workspace, strict TypeScript, formatting/lint, community policies and feature/PR/default-branch workflows                                                                                                                                                                                                                          | Verify remote checks and repository protections; finalize contribution certification and release ownership                                                                    |
| M1 — Reader              | Responsive React reader, static export, search, explorer, themes, subpath hosting and browser journeys                                                                                                                                                                                                                             | Final design, keyboard and independent accessibility review                                                                                                                   |
| M2 — Compiler            | OpenAPI 3.0/3.1 YAML/JSON, bounded local references, recursive/composed schemas, examples, Markdown/MDX, incremental builds and immutable manifests                                                                                                                                                                                | Complete advertised standards fixtures and supported-keyword review; remote-source importing remains unimplemented                                                            |
| M3 — Consumer experience | Authored examples/media selection, five executable snippet generators, local search, branding, flat parameter styles, content parameters, OAuth PKCE and nested object/array-body field editing/redaction and form-urlencoded reader/SDK inputs and multipart reader/SDK uploads, five-language snippets and schema-aware previews | Composed form controls, multipart style codecs/custom part headers, remaining serialization boundaries, shared safe authentication state, navigation and internationalization |
| M4 — Extensibility       | Bounded graph-transform plugins with conformance checks; Node, Java and Spring adapters with portable manifest verification, optional digest pins and installed baseline-JAR consumers and documented Spring IDE configuration                                                                                                     | Source/snippet/theme hooks and examples; complete external integration journeys                                                                                               |
| M5 — Self hosting        | PostgreSQL publication, role-based access, sessions/OIDC, publish tokens, audit, Studio, containers and tested restore/rollback procedures                                                                                                                                                                                         | Harden isolated build execution, implement the explicitly configured relay, complete outage/fault/upgrade and supported-topology rehearsals                                   |
| M6 — Release engineering | Doctor, conservative contract diff, offline static artifacts, npm/Java candidate packaging, installed consumers, npm/Java candidate SBOM, lifecycle policies, a static deprecation center unified distribution-version audits and semantic release planning/preparation and a manual prepared-version CI rehearsal                 | Signed npm/Maven/container publication and provenance verification                                                                                                            |
| M7 — Launch              | Local automated validation and documented performance experiments                                                                                                                                                                                                                                                                  | Independent pilots, security/accessibility review, complete license/distribution audit, protected release approval and registry installation verification                     |

## Latest completed increment

**Spring MVC/WebFlux can now serve verified documentation at the application root.** `api-docs.path: /` normalizes to an empty mount suffix, so standalone and context-prefixed roots use the correct compiled public base path, resource mappings and redirects. Installed consumer journeys verify authentication, both slash variants, allowed assets/pages, rejected unlisted files and preserved host-owned routes. Fixture-only system properties have a separate namespace, and the result reader requires all named root/subpath scenarios. A related regression now supplies conflicting inactive-stack prefixes: context selection follows the active MVC/WebFlux stack, fixing WebFlux startup when a servlet prefix is also configured. The estimate stays at approximately 76%; remaining product and launch gates still apply.

Validation for this increment:

- Formatting/lint, type checking, 73 tooling tests and all 380 compiler/component tests pass.
- The same inspected baseline JARs pass all 12 installed consumers across JDK 17/21/25 × Boot 3.5.16/4.1.1 × MVC/WebFlux: 48 current tests without skips and 12 fresh offline compilations.
- All six source Java combinations pass 60 manifest/host tests without skips. Runtime/source/Javadoc archives, IDE metadata and the bound baseline SBOM remain validated by the candidate gate.

See [Spring integration configuration](../integrations.md#spring-boot) and [Java validation](../java-validation.md). Candidates remain unsigned and unpublished; hosted CI remains blocked by account billing.

## Previous Java distribution increment

**Java candidates now include source/Javadoc archives, a bound dependency SBOM and Spring IDE configuration metadata.** Both modules attach documented sources/API archives with canonical license/notice resources. The starter generates descriptions/defaults for its five supported configuration properties without adding the annotation processor to application runtimes. A pinned CycloneDX generator records the baseline dependency graph; validation rejects stale coordinates, inconsistent package URLs, broken/detached references and test dependencies, and binds project components to the inspected parent POM/runtime JAR hashes. Regular and prepared-version CI jobs retain all candidate archives and the inventory. This implemented distribution and IDE-support scope raises the estimate to approximately 76%; signed registry publication and external launch acceptance remain pending.

Validation for this increment:

- Formatting/lint, type checking, 73 tooling tests and all 380 compiler/component tests pass; actionlint accepts both changed workflows.
- All six runtime/source/Javadoc archives pass content, legal-resource and metadata inspections; all five Spring configuration properties have verified descriptions, types and defaults. The baseline SBOM records 20 dependency components and 21 graph nodes.
- The same baseline runtime JARs pass 12 isolated installed consumers across JDK 17/21/25 × Boot 3.5.16/4.1.1 × MVC/WebFlux: 24 current tests, no skips, and fresh offline compilation for every consumer.
- The source Java matrix passes all six combinations: 60 current manifest/host tests, no skips.
- A fresh clone at `f75e9ef` passed the exact preparation action, production build and complete distribution gate with canonical `0.2.0` metadata, plus both Java 21 / Boot 4.1.1 consumers and offline compilations. Evidence was retained, the clone removed, and nothing tagged or published.

See [Java runtime, distribution and installed-consumer validation](../java-validation.md). Local candidates record source/dirty state and remain unsigned, unpublished development artifacts. Maven namespace ownership and the release-wide license/distribution review remain unverified. GitHub-hosted execution remains blocked by account billing and has not been verified.

## Previous reader increment

**Root and nested JSON objects/arrays now have bounded field controls in the request playground.** Referenced and recursive object schemas expand into editable fields. Arrays support adding/removing primitive, object and nested-array items, including root-array bodies for batch APIs and vendor JSON media types, with a per-container Fields/JSON switch and inherited write-only string masking. Updates retain precise numeric tokens, unknown values, read-only properties and unrelated siblings. Structural array edits discard incomplete drafts before reindexing and restore keyboard focus to a usable control. Invalid drafts block sending until fixed or discarded. Complex schemas and containers beyond the shared 100-control/eight-level budget retain local JSON editors; each expanded array has a 50-item limit. The Scalar-style URL bar and response-only Monaco modal remain covered by browser journeys. This implemented array-editing scope raises the engineering estimate to approximately 75%; composed controls and production launch acceptance remain pending.

Validation for this increment:

- Formatting/lint, type checking, 65 tooling tests and all 380 compiler/component tests pass.
- All 32 reader browser journeys pass, including real root/nested object/array requests, exact numeric tokens, draft/error cleanup, focus restoration, both themes, automated accessibility checks and mobile containment.
- All 12 installed npm components pass archive, public API, CLI, adapter and dependency checks outside the workspace, including an offline lockfile reinstall.

The sensitive-label follow-up conceals enum options, unknown current enum values and constants beneath write-only/password schemas. The browser regression verifies the concealed labels while selecting and submitting the real value. Source checks, all 378 compiler/component tests and all 31 reader browser journeys pass for this fix; the percentage does not increase for this correction.

## Previous release-preparation increment

Release preparation passed a full prepared-version rehearsal, and a matching manual CI workflow is configured. A temporary clone installed from the existing npm cache, applied a saved plan from `0.1.0` to `0.2.0`, and passed the relevant checks while the main checkout remained unchanged. The saved-plan round-trip and package-formatting issues found during rehearsal were fixed and tested. A shared CI action handles read-only/application modes; the manual workflow requires `master`, reuses the quality workflow's Java matrix, checks prepared source/server/Studio/Java candidates, and retains unpublished evidence without tags, commits or publication. See [release rehearsals](../releases.md#local-prepared-version-rehearsal).

- The prepared `0.2.0` clone passed release-mode metadata alignment, formatting/lint, 63 tooling tests and all 364 compiler/component tests.
- It also passed all 27 reader browser journeys, 60 executable snippets, nine PostgreSQL integration tests, the Studio publishing journey and all 12 installed npm components.
- Java passed all six JDK 17/21/25 × Spring Boot 3.5.16/4.1.1 combinations: 60 current tests with no skips.
- The workflow's exact preparation shell action ran locally in read-only and apply modes against a separate clean clone, and its canonical Java-matrix output and actionlint checks passed. New boolean/baseline/input-boundary cases brought the root tooling suite to 65 passing tests.
- GitHub-hosted execution remains unverified because of the account billing restriction. Prepared artifacts are rehearsal evidence, not approved stable releases or proof of registry ownership/signatures.

These local results apply to the stated candidate/source. Independent security/accessibility review, signed provenance, published-registry installation, pilots and production launch acceptance remain separate gates.

## External launch dependencies

GitHub Actions has been unable to start because of the repository account's billing or spending limit. Local checks pass, but remote CI has not been verified. Maintainers must resolve that account setting before its checks can serve as release evidence.

Package scope ownership, Maven namespace/signing, registry publication, final product naming and protected repository/environment settings still require owner-controlled setup. No public packages or stable release have been published. External pilots and independent security/accessibility reviews remain required.

Progress updates should state the approximate percentage, the completed increment, its validation and material remaining work. Keep this record current after each completed implementation step; do not raise the estimate solely because additional tests were added.
