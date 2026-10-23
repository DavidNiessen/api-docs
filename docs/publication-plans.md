# Publication policy and review plans

The manual **Review publication plan** workflow verifies an existing successful release candidate and prepares a reviewable plan. It has read-only repository, Actions and attestation permissions. It uses no registry/signing credentials and publishes nothing. Registry transports and published-install verification are separate release implementation work.

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
