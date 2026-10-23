# Publication policy and review plans

The manual **Review publication plan** workflow verifies an existing successful release candidate and prepares a reviewable plan. It has read-only repository, Actions and attestation permissions. It uses no registry/signing credentials and publishes nothing. Registry transports are being implemented separately; the workflow does not yet invoke them.

Dispatch `.github/workflows/release-publish.yml` from the same canonical tag used by **Verified release candidate**, supplying its exact run ID and attempt. The source guard requires a clean, release-aligned upstream commit on `master`. The planner checks the actual candidate workflow identity, event, successful completion, source repository/commit and latest attempt; another successful workflow or a fork cannot substitute. It also checks the current remote tag, including annotated tags.

The planner downloads only the candidate's named npm/Java/container bundles. Shared verification checks their complete file sets, byte counts, hashes and source/run bindings, then invokes GitHub's verifier for every file with the producer workflow, exact source tag/commit and GitHub-hosted runner constraints. Unit tests of command invocation are not cryptographic acceptance; the actual clean-tag workflow must pass.

## Reviewed source policy

`release-policy.json` contains public coordinates and explicit decisions. It never contains credentials. Unknown fields, truthy strings, mismatched npm/Maven coordinates and invalid signing identities fail instead of silently changing destinations.

| Field                         | Purpose                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `publicationEnabled`          | Maintainer-controlled publication switch; defaults to false.                                 |
| `npm.scope`                   | Must match every public package in the source. The current `@api-docs` scope is provisional. |
| `maven.groupId`               | Must match the Java source; `dev.niessen` is the selected group.                             |
| `container.repository`        | Fully qualified GHCR repository; the current proposal is `ghcr.io/davidniessen/api-docs`.    |
| `ownershipVerified`           | Separate explicit decision for each namespace. The current defaults are false.               |
| `maven.signingKeyFingerprint` | Reviewed public OpenPGP fingerprint, never private key material; currently unset.            |
| `reviews`                     | Separate security, isolation, accessibility, license and pilot decisions; currently pending. |
| `environment`                 | The protected publishing environment is named `release`.                                     |

The output lists every pending decision. `policyApproved` describes only the source policy; `publicationApproved` remains false. A policy file does not establish actual reviewer approval, registry authorization or publication. Version prereleases select npm's `next` tag; stable versions select `latest`. Selected workspace dependencies have a deterministic publication order, with duplicate/cyclic sets rejected.

The additional approval-check mode verifies actual GitHub environment metadata before a publishing job can be queued: a nonempty required-reviewer rule and exactly the `v*` tag policy. It does not treat a policy boolean as evidence that the environment exists. Observed during implementation: current access can list environments but cannot inspect classic branch protection (`403 Resource not accessible by integration`); no `release` environment is configured. Protected repository/tag settings remain owner-controlled launch work.

## Retained evidence

The plan records the exact candidate run/attempt, source/tag/version, proposed registry destinations and channels, verified subject digests, source-policy blockers and the separate planning run identity. Signature-verification results accompany it for 14 days. Credential values are never included.

Do not edit a generated plan to bypass checks. Policy, naming or coordinate changes belong in reviewed source and require a new matching candidate. Before stable publication, complete namespace/signing setup, required reviews and protected environment/tag configuration, then approve the exact tested subject digests through the publishing gate.

## npm transport and fresh consumers

`scripts/publish-npm.mjs` is intended only for the future protected publishing job. It requires a matching approved source policy, same-run plan and verified release environment. It rechecks the complete accepted npm bundle and workspace dependency order, then preflights every immutable public version before the first write. Existing versions must have native npm provenance and matching integrity, size and downloaded SHA-256. A conflicting version fails instead of being overwritten.

New publications use the original tested archives with scripts disabled, public access and native npm provenance. Prereleases use `next`; stable versions use `latest`. Trusted publishing uses the protected job's OIDC identity; initial namespace/package bootstrap may instead require `NPM_TOKEN` as a step-scoped environment secret. Its value never enters command arguments, files or retained receipts. A temporary owner-only npm configuration contains only the literal environment-variable reference and is removed on success or failure. Partial receipts make completed immutable versions visible for a retry. This is not an atomic transaction across packages or registries.

`scripts/verify-published-npm.mjs` belongs on a separate fresh read-only runner without signing, registry-write or OIDC credentials. It checks public registry archives against the accepted bundle, installs exact package names/versions into an external consumer using an empty cache, rejects workspace links, runs npm signature/provenance verification and the dependency audit, reinstalls offline from its new lockfile, and executes the installed CLI, public-type and authenticated Express/Fastify journeys. It retains its lockfile, SBOM and bounded verification output.

Transport command/security tests and a real read-only public registry request pass locally. They do not establish that this project's packages are published or that a fresh public install passes. Those gates remain pending until ownership, protected workflow integration and explicit publication approval are in place.

## Maven Central transport and fresh consumers

`scripts/publish-maven.mjs` promotes the accepted parent POM, two module POMs, binaries, sources and Javadocs. Public coordinates are checked before uploading: every existing file must match the accepted SHA-256, and a partially propagated version stops for inspection. The publisher never rebuilds a JAR, rewrites a POM, overwrites public versions or drops a deployment automatically.

The protected publishing step needs `MAVEN_CENTRAL_TOKEN` (Central's base64 username/password user token), `MAVEN_SIGNING_KEY` (armored secret key) and, when applicable, `MAVEN_SIGNING_PASSPHRASE`. The reviewed primary fingerprint belongs in the public policy. Commit its armored public key as `release-signing-key.asc` and distribute that public key as required by Central before enabling publication. Private keys and passphrases go only to GitHub's protected environment secrets, never repository files or cloud setup drafts.

Signing imports the key into a temporary owner-only GnuPG home and passes sensitive input over stdin. Every detached signature is verified against the configured key before bundling. Central's legacy MD5/SHA-1 sidecars are emitted for interoperability alongside SHA-256/SHA-512; release acceptance uses SHA-256 and OpenPGP. The upload uses `USER_MANAGED`: validation must reach `VALIDATED` before the explicit publish request, followed by `PUBLISHED`. A retained receipt records the bundle hash, public signing identity, deployment ID and states, excluding credentials and raw remote diagnostics.

If validation fails or publication times out, inspect the retained deployment ID in Central before another upload. Wait for an in-progress deployment or resolve/drop a failed staging deployment manually before retrying. A later run reuses an already public exact version. Publication across npm, Maven and GHCR is not atomic.

`scripts/verify-published-maven.mjs` runs separately without signing/publishing credentials. It checks every public Maven file against the accepted bytes, verifies public detached signatures with the reviewed source-controlled public key, then starts MVC and WebFlux consumers with an empty Maven repository. It builds only documentation fixtures and consumer tests; it never builds or installs the project's Java modules. Both hosts must execute their required scenarios and compile offline afterward. The consumer's temporary Maven repository must be outside the checkout, as enforced by the installed-JAR origin checks; the hosted job uses the runner's normal temporary directory.

Local cryptographic tests use a disposable test key and verify all nine signed files and the complete checksum ZIP, including tamper rejection. The three shared documentation fixtures also compile with matching manifest digests. Mock Central tests verify validation/publish ordering and failed-deployment recovery receipts. These results do not claim real Central publication or a public install of this project's Java coordinates.

## Container transport and anonymous consumers

`scripts/publish-container.mjs` loads the accepted Docker archive and publishes only its already-tested Linux/amd64 config ID under an immutable version tag. It preflights the registry manifest, rejects conflicting existing image IDs and verifies the actual manifest digest and config ID after push. The step needs `GHCR_TOKEN` and `GITHUB_ACTOR`; its temporary Docker configuration is removed afterward without changing inherited configuration. Endpoint selectors cannot redirect commands away from the local managed daemon. Proxies and CA settings remain inherited.

The publisher writes a promotion predicate binding the source/tag, candidate run/attempt, original producer workflow, accepted archive SHA-256, tested config ID and registry manifest digest. The protected workflow must sign that predicate with the generic `actions/attest` action and attach it to the OCI subject. This describes promotion of previously built bytes; it does not claim the publishing job built the image.

`scripts/verify-published-container.mjs` uses an anonymous pull token and an empty Docker client configuration to prove public availability, then pulls by manifest digest and compares the resulting config ID. It verifies the keyless promotion attestation against the exact publishing workflow/tag/commit and hosted-runner identity. An unprivileged, read-only, offline runtime probe checks UID and tool version and removes its exact owned container even on validation failure. The fresh runner receives no registry-write, signing or OIDC credentials; a read-only GitHub token is used only for attestation reads.

New GHCR packages may start private. Set public package visibility before claiming anonymous installation; an authenticated owner pull cannot substitute for this acceptance. No mutable `latest` container alias is published by this transport. Local transport tests cover conflict/reuse, archive/config mismatches, credential removal and failed-probe cleanup. A real anonymous manifest read against a public runner image and a restricted probe against a retained local development image pass; neither is acceptance of a freshly published project image. Workflow integration and actual end-to-end publication remain pending.
