# API lifecycle inventory

The CLI inventories deprecated operations, announced retirement dates, replacement operations and migration guides across API versions. The reader's full deprecation-center screen is a pending increment; this foundation provides validated metadata and reproducible CI reports.

Standard `deprecated: true` operations appear even without extra metadata. Add the reserved `x-api-docs-lifecycle` extension when dates or migration details are available:

```yaml
deprecated: true
x-api-docs-lifecycle:
  deprecatedOn: '2026-01-01'
  sunsetOn: '2027-06-01'
  message: Version 1 is being retired.
  migrationUrl: /guides/migration/#heading-update-your-client
  replacement:
    version: v2
    operationId: listWidgets
```

Fields are optional, but an extension must declare at least one. Dates must be real `YYYY-MM-DD` calendar dates, and sunset cannot precede the declared deprecation date. `message` is single-line plain text of at most 2,000 characters. Migration URLs use HTTP(S) without embedded credentials or a project-relative route starting with `/`; omit the configured deployment base path. Fragments must use the generated heading IDs. Links are never fetched by the inventory.

Replacement targets default to the same API id, API version and operation kind. Set `apiId`, `version` or `kind` to select another published target. Endpoint identifiers normally use OpenAPI `operationId`; the JSON inventory exposes the normalized identifiers for generated/incoming-event operations. Missing, ambiguous or self-referencing replacements are reported without inventing a link. A migration guide can cover a transition that has no single replacement operation.

Future dates can be announced without setting the standard deprecated flag yet. Standard deprecation or a reached `deprecatedOn` produces a deprecated status. A reached sunset takes precedence; otherwise sunsets within the chosen window appear as soon, and other announced entries remain planned. Date-only deadlines start at 00:00 UTC on the stated date. The tool reports declarations; it does not remove API endpoints or verify a server's actual shutdown.

## CLI and CI

```sh
node packages/cli/dist/main.js lifecycle examples/lifecycle --as-of 2027-05-15 --json
node packages/cli/dist/main.js lifecycle my-docs --api catalog --api-version v1 --as-of 2027-05-15 --fail-within 30 --check-replacements --require-migration
```

`--as-of` defaults to today's UTC date. Supply it explicitly for repeatable reports. `--api` and `--api-version` narrow the inventory; a filter matching no API fails rather than producing a misleading successful gate. The default status window is 30 days.

- `--fail-within N` returns a nonzero exit when any selected sunset has been reached or falls within N days. Valid windows are 0–36,500 days. Past deadlines count too.
- `--check-replacements` fails when a declared replacement cannot be resolved.
- `--require-migration` fails when an entry has neither a migration URL nor a resolved replacement.
- `--json` emits the as-of date, window, status counts and entries with source pointers, site-relative routes and optional days-until-sunset values. Negative day counts mean the deadline is past.

Inventory alone exits successfully for valid input; the policy flags opt into a failing CI gate. Archived versions remain in an unfiltered inventory, so scope deadline gates to the versions your policy covers. Reviewed plugins or MDX require their usual explicit trust flags. The reporter makes no API requests.

Builds store only the declared metadata and do not use today's date, preserving deterministic artifacts. The public `lifecycleReport(site, { asOf, windowDays, apiId, apiVersion })` helper requires an explicit date. Source loading and plugin validation share the same metadata contract.

## Doctor and contract review

Doctor checks internal migration routes/anchors under the deployment base path and emits `lifecycle-replacement` for unresolved declared replacements. The normal rule-severity and justified-suppression settings apply. These structural checks do not depend on the current date. Explicit deadline gates belong in the lifecycle command.

Contract diff requests review when a sunset is introduced or a known retirement/deprecation date is brought forward. Other lifecycle guidance changes are informational. This metadata classification does not prove runtime compatibility; see [contract review](contract-diff.md).
