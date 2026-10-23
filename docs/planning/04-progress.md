# Implementation progress

Updated: 2026-10-23. **Approximately 82% complete; pre-release.** This is an engineering estimate of implemented scope and remaining launch work, not measured test coverage. A working feature does not complete its production acceptance gate. The binding scope and release checklist remain in the [delivery plan](03-delivery-and-launch.md).

## Current milestone status

| Milestone                | Implemented                                                                                                                                                                                                                                                                                                                                                                   | Remaining before acceptance                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Foundation          | Workspace, strict TypeScript, formatting/lint, community policies and feature/PR/default-branch workflows                                                                                                                                                                                                                                                                     | Verify remote checks and repository protections; finalize contribution certification and release ownership                                                |
| M1 — Reader              | Responsive React reader, static export, search, explorer, themes, subpath hosting and browser journeys                                                                                                                                                                                                                                                                        | Final design, keyboard and independent accessibility review                                                                                               |
| M2 — Compiler            | OpenAPI 3.0/3.1 YAML/JSON, bounded local references, recursive/composed schemas, examples, Markdown/MDX, incremental builds, immutable manifests and explicit bounded remote spec snapshots                                                                                                                                                                                   | Complete advertised standards fixtures and supported-keyword review; controlled remote-reference vendoring remains unimplemented                          |
| M3 — Consumer experience | Authored examples/media selection, five executable snippet generators, local search, branding, flat parameter styles, content parameters, OAuth PKCE, opt-in destination-bound credential reuse and nested object/array-body field editing/redaction and form-urlencoded reader/SDK inputs and multipart reader/SDK uploads, five-language snippets and schema-aware previews | Remaining composed form controls, multipart style codecs/custom part headers, remaining serialization boundaries, navigation and internationalization     |
| M4 — Extensibility       | Bounded spec-source, graph-transform, theme-token and build-time snippet plugins with complete-pipeline conformance checks and first-party examples; Node, Java and Spring adapters with portable manifest verification, optional digest pins and installed baseline-JAR consumers and documented Spring IDE configuration                                                    | Dynamic browser extension hooks; complete external integration journeys                                                                                   |
| M5 — Self hosting        | PostgreSQL publication, role-based access, sessions/OIDC, publish tokens, audit, Studio, verified CLI static serving/reloads, containers and tested restore/rollback procedures                                                                                                                                                                                               | Harden isolated build execution, implement the explicitly configured relay, complete outage/fault/upgrade and supported-topology rehearsals               |
| M6 — Release engineering | Doctor, conservative contract diff, offline static artifacts, npm/Java candidate packaging, installed consumers, npm/Java candidate SBOM, lifecycle policies, a static deprecation center unified distribution-version audits and semantic release planning/preparation and a manual prepared-version CI rehearsal                                                            | Signed npm/Maven/container publication and provenance verification                                                                                        |
| M7 — Launch              | Local automated validation and documented performance experiments                                                                                                                                                                                                                                                                                                             | Independent pilots, security/accessibility review, complete license/distribution audit, protected release approval and registry installation verification |

## Latest completed increment

**Build plugins can add validated static code examples to operations.** The typed `generateSnippets` hook runs after all graph transforms, receives immutable shared API metadata and a separate operation snapshot, and returns bounded namespaced samples. The reader labels these as build-time examples, keeps live playground serialization separate and offers a visible full-copy action for both kinds of request example. Generated text is escaped rather than executed. A first-party Go plugin uses the public explorer serializer and sensitive-field redaction; its helper and output participate in artifact identity. Source and prepared-release workflows run the Go fixture harness; source CI also runs each first-party hook's CLI conformance check. This implemented extensibility scope raises the estimate to approximately 82%; dynamic browser hooks, external integration acceptance and launch gates remain open.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 495 compiler/component tests pass. Twelve snippet cases cover final-graph ordering, snapshot isolation, explicit capabilities, namespaced output, invalid/duplicate/excessive output, UTF-8 and aggregate byte limits, timeouts, helper fingerprints and redaction.
- Nine generated Go programs pass real loopback checks with Go 1.27.3 and module/toolchain downloads disabled, including precise serialized bytes, Unicode, headers, empty/error responses, redirect refusal and actual public-plugin output.
- All 38 reader browser journeys pass. The new journey verifies selection, complete copying, HTML/script text escaping, static/live distinctions, both themes, automated accessibility and mobile containment. The Scalar-style bar and response-only Monaco behavior remain covered.
- All 12 installed npm components pass outside the workspace, including published snippet types, combined source/theme/transform/snippet execution, offline reinstall, dependency audit and candidate SBOM. Actionlint accepts both changed workflows.

See [build-time code examples](../plugins.md#build-time-code-examples) and [snippet verification](../snippets.md). Go is an optional first-party build example; the five built-in languages still reflect live reader input. Hosted CI remains blocked by account billing/spending settings; these are local results, with independent review and protected publication still pending.

## Previous source-plugin increment

**Plugins can adapt spec sources before OpenAPI validation.** A typed, explicitly declared `loadSpec` hook processes bounded YAML/JSON text in configuration order. Its output uses the ordinary parser, structural validation, confined local references and normalization. Source identity/base paths remain fixed, and changed spec files or declared plugin inputs between stages fail the build. Source and graph hooks run in separate fresh workers with no shared module state. The CLI conformance command now checks the complete pipeline twice, including sources that need an adapter before they become valid OpenAPI. A first-party deployment plugin replaces server lists using the public lossless JSON tree and a fingerprinted configuration file. This implemented source-integration scope raises the estimate to approximately 81%; snippet extensions and launch acceptance remain open.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 483 compiler/component tests pass. Fifteen source cases cover capability declarations, ordering and isolation, wrapped JSON/YAML, normal validation/reference confinement, changed inputs, nondeterminism, invalid/oversized output, timeouts and preservation of previous publications.
- The first-party deployment source plugin passes CLI complete-project conformance and builds successfully with explicit trust.
- All 12 installed npm components pass outside the workspace, including the published source types, combined source/theme/transform execution, offline reinstall, dependency audit and candidate SBOM.

See [source plugin instructions](../plugins.md#spec-sources). Reader runtime behavior is unchanged; the preceding 37 browser journeys and dated performance results remain the latest reader evidence. Hosted CI, independent review and release gates remain open.

## Previous theme-plugin increment

**Plugins can now customize themes through a typed token hook.** Theme-only plugins explicitly declare their capability and return partial tokens; per-mode palette merging preserves existing tokens, preset selection supplies the matching default accent, and a combined plugin's transform sees its updated theme. Hooks share the existing bounded fresh-process lifecycle, diagnostics and declared-input verification. Full configuration, contrast and path validation still happen before replacing any publication. A runnable first-party plugin reads a fingerprinted brand file; public SDK types and worker execution are exercised through physical installed packages. This implemented extensibility scope raises the estimate to approximately 80%; source/snippet hooks and launch acceptance remain open.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 468 compiler/component tests pass. New plugin cases cover hook ordering, palette preservation, caller isolation, capability declarations, malformed output, input hash changes, timeouts and preservation of the previous publication after invalid theme output.
- The first-party brand plugin passes the CLI's two-fresh-worker conformance check, and the complete plugin example builds successfully with explicit trust.
- All 12 installed npm components pass outside the workspace, including typed theme exports, actual combined theme/transform execution, generated configuration, offline reinstall, dependency audit and candidate SBOM.

See [theme plugin instructions](../plugins.md#theme-tokens). No reader runtime code changed in this increment; the preceding 37 browser journeys and dated performance results remain the latest reader evidence. Hosted CI remains blocked by account billing/spending settings, and independent reviews and release gates remain required.

## Previous credential-reuse increment

**Credential reuse is available as an explicit, bounded reader option.** Default modal/navigation behavior still clears authentication. Users can remember entries for a fixed 30-minute window in one reader instance, scoped to API id/version, complete server URL, authentication policy, public OAuth client settings and required OAuth scopes. Provider expiry is retained while the modal is closed; timers and fresh request-time reads prevent expired entries being reused. No credentials or consent enter Web Storage, cookies, boot data or server artifacts. Root-private stores, pagehide/teardown clearing and a route-data base-path guard keep contexts separate. Global/individual clearing removes saved entries; global clearing also cancels pending OAuth/API requests and clears captured responses, with guards against late callbacks and restored keyboard focus. Operators can hide reuse through `explorer.credentialReuse: false`. This implemented consumer workflow raises the scope estimate to approximately 79%; launch acceptance remains open.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 459 compiler/component tests pass. Fifteen credential-policy/configuration cases cover consent, scope/destination/policy separation, copies, expiry, clearing, prototype names and retention limits.
- All 37 reader browser journeys pass. Five new journeys cover real authenticated requests after SPA navigation, server and OAuth-scope separation, storage/boot-data checks, provider expiry while closed, reload, namespace fallback, pending-request/popup cancellation, response clearing and keyboard focus. Both themes, mobile containment and automated accessibility checks pass; the Scalar-style bar and response-only Monaco behavior remain covered.
- All 12 installed npm components pass outside the workspace, including public types, CLI/worker execution, verified hosting, offline reinstall, dependency audit and candidate SBOM.
- A clean `6e2857f` rerun of the controlled mobile benchmark passed all current budgets: guide/endpoint LCP p95 868/856 ms, CLS 0, search-open p95 107.3/89.7 ms and 104.6 KiB calculated initial gzip JavaScript. See the [dated evidence and limitations](../performance.md#reader-feature-follow-up-23-october-2026).

See [authentication and credential memory](../explorer-auth.md). This is local automated evidence; hosted CI remains blocked by account billing/spending settings, and independent security/accessibility review and release gates remain required.

## Previous remote-import increment

**Controlled remote OpenAPI snapshot importing is implemented.** The CLI and public spec SDK download a self-contained YAML/JSON source only from explicitly allowed origins. Public-network HTTPS is the default; cleartext and private networks need separate opt-ins. Every DNS answer is checked, and the selected address is pinned through direct/proxy connections while retaining Host, SNI and certificate verification. Redirects and external schema references are rejected. Download/DNS/isolated validation share a deadline and byte/memory limits. Optional bearer credentials come from an environment variable, and source-byte SHA-256 pins are supported. Validated original bytes are installed atomically; failed imports retain the previous spec, and detected concurrent edits are preserved. Ordinary builds remain offline. This completed snapshot workflow raises the scope estimate to approximately 78%; remote-reference vendoring and the other milestone/release gates remain pending.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 444 compiler/component tests pass. The 38 new import checks include public/private/reserved address policy, mixed DNS answers, proxy tunneling, DNS pinning, original TLS identity, untrusted-certificate rejection and trusted-certificate success, credential handling, byte/time/encoding limits, recursive refs, invalid inputs and atomic file behavior.
- All 12 installed npm components pass outside the workspace, including both programmatic downloading and the real import CLI with isolated validation from packaged worker files. Offline reinstall, dependency audit and candidate SBOM pass.
- A live public HTTPS rehearsal imported a 17,106-byte/19-operation Petstore source through the session proxy with the default public-address policy and TLS verification. Local compilation and two deterministic static builds passed; verified routes/assets were served and unlisted metadata rejected. Evidence is retained at `.api-docs/import-rehearsals/3620f38f207c-1792715323023/`, including source SHA-256, source/dirty state and publication digest. The temporary project was removed; nothing was published.

See [remote imports, policy and integration recipes](../remote-import.md). Browser/Java behavior was not changed by this increment; their earlier recorded validation remains scoped to those sources. Hosted CI still needs the owner-controlled account restriction resolved.

## Previous CLI hosting increment

**CLI static serving now verifies publications and restricts responses to listed files.** The CLI and Node adapters share one manifest path filter for files and page-directory aliases. Startup rejects corrupt artifacts, missing listed configuration/root pages and mismatched mounts. Programmatic `reloadPublication()` rechecks replacement bytes before updating the file set; failures make documentation/readiness return 503 until repair and a successful reload, while liveness remains available. Base-path changes require a restart. Full development rebuilds reload membership; incremental guide edits keep the same paths and avoid another full checksum pass. This added verified hosting/reload workflow, together with compatible `allOf` body controls, raises the scope estimate to approximately 77%. It does not complete production launch acceptance.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 406 compiler/component tests pass.
- Root and subpath CLI fixtures reject unlisted files, symlinks, metadata and encoded-path bypasses for GET/HEAD, preserve listed assets and query-bearing redirects, and exercise corrupt reloads, repair/recovery, changed base paths and safe error pages. A real spawned `dev` process serves a new guide after a full rebuild and a later incremental edit.
- All 32 reader browser journeys pass with the restricted CLI server, including local search, lazy Monaco assets, folding/highlighting/full-response copying, the Scalar-style URL bar, composed body controls, both themes, mobile layouts and automated accessibility checks.
- All 12 installed npm components pass outside the workspace, including CLI reload/readiness, CLI/Express/Fastify GET/HEAD rejection of unlisted files, offline reinstall, dependency audit and candidate SBOM.

See [CLI verification and reload behavior](../cli.md). The product remains pre-release; remote CI, remaining milestone scope and external launch gates still apply.

## Previous Node adapter increment

**Express and Fastify adapters now serve only manifest-listed publication files.** Startup verification supplies a private membership set used for static requests and page-directory aliases. Authentication still runs before files and rejected requests. Unknown files/directories, unlisted symlinks and the manifest itself are not public; malformed and noncanonical paths cannot bypass membership checks. Configuration must be listed in the manifest, and an unlisted custom error page uses a plain response. Keep the publication immutable while serving it; this gate does not rehash content per request. The CLI server has its own verification/reload gate, described above. The engineering estimate stays at approximately 76% for this fix.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 399 compiler/component tests pass.
- Both adapters pass real root/subpath hosting checks for authentication, GET/HEAD rejection, encoded paths, unlisted symlinks, directory redirects with query strings, preserved host routes and safe missing-error-page handling.
- All 12 installed npm components pass the external consumer gate, including authenticated GET/HEAD rejection of physically present unlisted files in both adapters, offline reinstall, dependency audit and candidate SBOM.

See [framework integrations](../integrations.md). Hosted CI and the remaining product/release gates still apply.

## Previous composed-body increment

**Compatible `allOf` objects now have request-body field controls.** A bounded projection combines disjoint properties and required names across local references and OpenAPI 3.1 reference siblings. Read-only fields stay out of controls, write-only annotations retain masking, and edits preserve the lossless body tree. Root objects, nested objects and array items share the existing field controls. Overlapping properties, additional composition constraints, unresolved references and non-object branches retain JSON editing; expansion stops after 32 schema nodes or eight composition levels per container. This completes the compatible-object portion of composed controls; unions and conflicting definitions remain open. The engineering estimate stays at approximately 76%.

Validation for this increment:

- Formatting/lint, type checking, all 73 tooling tests and all 393 compiler/component tests pass.
- All 32 reader browser journeys pass with real composed root/nested/array-item fixtures, required labels, masked secrets, exact request numbers, JSON/fields switches, both themes and accessibility checks. The Scalar-style URL bar and response-only Monaco modal remain covered.
- All 12 installed npm components pass archive, public API, CLI, adapter and dependency checks outside the workspace, including the offline lockfile reinstall and candidate SBOM.

See [JSON body editing](../explorer-bodies.md). The estimate remains pre-release; signed publication, independent reviews and other milestone gates still apply.

## Previous Spring hosting increment

**Spring MVC/WebFlux can now serve verified documentation at the application root.** `api-docs.path: /` normalizes to an empty mount suffix, so standalone and context-prefixed roots use the correct compiled public base path, resource mappings and redirects. Installed consumer journeys verify authentication, both slash variants, allowed assets/pages, rejected unlisted files and preserved host-owned routes. Fixture-only system properties have a separate namespace, and the result reader requires all named root/subpath scenarios. A related regression now supplies conflicting inactive-stack prefixes: context selection follows the active MVC/WebFlux stack, fixing WebFlux startup when a servlet prefix is also configured. The estimate stays at approximately 76%; remaining product and launch gates still apply.

Validation for this increment:

- Formatting/lint, type checking, 73 tooling tests and all 380 compiler/component tests pass.
- The same inspected baseline JARs pass all 12 installed consumers across JDK 17/21/25 × Boot 3.5.16/4.1.1 × MVC/WebFlux: 48 current tests without skips and 12 fresh offline compilations.
- All six source Java combinations pass 60 manifest/host tests without skips. Runtime/source/Javadoc archives, IDE metadata and the bound baseline SBOM remain validated by the candidate gate.
- A clean `e6fb837` clone passed the exact preparation action and production build with canonical `0.2.0` metadata, all distribution checks, eight installed Java 21 / Boot 4.1.1 tests and two offline compilations. All three publication digest pins were verified; the clone was removed without tagging or publishing.

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
