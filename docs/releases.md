# Development candidates and release gates

The project is in development. There is no approved stable release, registry ownership is not verified, and these commands do not publish anything. The current `@api-docs` scope and Maven coordinates remain provisional. Never install or execute artifacts from an untrusted pull request.

## Review a release plan

Use a full clone with fetched release tags. The planner checks distribution metadata before reading local Git history. It never edits versions, writes a changelog, creates tags, fetches, pushes or publishes. With no merged release tags, select the initial release explicitly:

```sh
npm run --silent release:plan -- --initial --date 2026-10-22 > /tmp/api-docs-release-plan.json
npm run --silent release:plan -- --initial --date 2026-10-22 --notes
```

After a release, omit `--initial` to use the highest merged canonical `v<version>` tag. `--since <local-ancestor-ref>` selects an explicit baseline; a canonical release tag also supplies its version. `--version <canonical-semver>` records an explicit maintainer-selected target, which cannot precede the checkout's declared version. The default date is the current UTC date; supplying it makes repeated plans reproducible. `--help` lists options. npm's `--silent` keeps the redirected JSON free of npm script headers.

The schema-versioned JSON reports the source commit, dirty state, baseline, declared npm/Java versions, proposed bump/target, classified commits, unclassified messages and Markdown notes. Dirty plans are development evidence. Unclassified messages require manual review; they do not silently become features or breaking changes. Notes group breaking changes, features, fixes/reverts, performance and documentation, and escape commit-supplied Markdown/HTML. GitHub links are included only for a recognized origin, with URL credentials removed.

Features suggest a minor increment; fixes, reverts and performance changes suggest a patch. Breaking changes suggest a major increment on stable versions and a minor increment below 1.0. Existing prereleases advance their prerelease number instead of promoting to stable automatically. Documentation/maintenance changes alone do not infer a bump. Initial releases retain the declared version for review. Metadata already advanced beyond the baseline's proposed increment is retained; the planner never downgrades it. An explicit override remains a maintainer decision, not proof that the version is semantically correct.

Shallow repositories, invalid/unrelated baselines, invalid dates, conflicting target tags, inconsistent versions and oversized histories/messages fail. Plans are bounded to 5,000 non-merge commits, 64 KiB per commit body and an 8 MiB Git output buffer and a 16 MiB JSON plan; narrow a large range with `--since`. A passing plan is not release authorization or signature/provenance verification. Review the complete range, upgrade notes, supported matrix and all gates below before preparing publication artifacts.

## Prepare the reviewed metadata

Generate the plan from a clean full checkout, keep it outside tracked source (for example `/tmp/api-docs-release-plan.json`), and inspect its version, notes, baseline, dirty flag and unclassified commits. The preparer regenerates the proposal from the current source and rejects changed JSON or stale source. Edit source/migration documentation before planning; do not hand-edit the JSON to bypass that comparison.

```sh
npm run --silent release:prepare -- --plan /tmp/api-docs-release-plan.json
npm run --silent release:prepare -- --plan /tmp/api-docs-release-plan.json --apply
npm run check:versions -- --release
```

The first command stages metadata in a temporary directory and audits release alignment without changing repository files. Its JSON receipt lists changed paths and before/after SHA-256 hashes. `--apply` writes a reviewable Git change: all npm workspace versions, exact internal references in every dependency section, matching lockfile entries, runtime version, the Java parent/reactor versions without `-SNAPSHOT`, and a new `CHANGELOG.md` entry. Third-party versions, resolved archives and integrity records stay unchanged. The lockfile retains npm's format and requires no dependency resolution or registry access. Existing changelog introductions and earlier entries are preserved; entries use `## <semver> - YYYY-MM-DD`, and duplicate or unsupported headings fail.

Only tracked regular metadata files are replaced; an absent changelog may be created for review. Metadata symlinks are refused. Preparation stages and validates the full candidate before replacing files, rechecks the source and snapshots, preserves file modes, and audits the installed result. An apply lock serializes preparations for the checkout. A normal failure attempts to restore completed replacements; a concurrent edit is preserved and original recovery metadata is retained with its location in the error. Replacements are atomic per file, rather than a filesystem-wide transaction. An interrupted process or machine can leave partial metadata and a lock; inspect its owner file and Git changes before restoring the checkout and removing the stale lock. No Git history is reset automatically.

After applying, review `git diff`, finish migration/release notes, run all applicable source/browser/integration/Java/package checks against the exact prepared candidate, and commit it with a conventional release message. Applying does not install packages, stage/commit files, create tags, push or publish. The receipt identifies the plan's input commit; publication evidence must identify the final reviewed commit and artifact digests. Runtime/artifact schema versions and documentation API versions are independent and are not changed by this command.

## Pack and verify npm components

First run the [distribution version audit](versioning.md), which also participates in `npm run check`. The current checkout permits development Maven snapshots; release-mode alignment is a later gate.

Use the pinned Node/npm versions and a clean checkout for reviewable candidates:

```sh
npm ci --ignore-scripts
npm run check
npm run test:packages
```

`test:packages` first packs all 12 public components, including the reader runtime required by the CLI. It stages built output, tracked source for source/declaration maps, package exports, README, Apache-2.0 LICENSE and NOTICE in temporary directories. It removes workspace build scripts and development dependencies from the packed metadata. It checks archive contents, executable/export targets, reader assets, and npm SHA-512 integrity, then records SHA-256 hashes, file inventories, the source commit and whether the working tree was dirty. A dirty run is development evidence, not an approved release candidate. `npm run release:pack` produces only the archives/inventory; build first.

The consumer check installs the archives into a temporary project outside the workspace, audits its dependency tree at the moderate threshold, reinstalls from its lockfile using the local npm cache with network access disabled for npm, and runs the installed code. Internal package directories must be physical installs rather than workspace symlinks. The smoke covers strict public TypeScript declarations, CLI initialization, trusted MDX and plugin workers, plugin conformance, strict doctor validation, artifact checks, static serving, and authenticated Express/Fastify mounts under a subpath. Its Node TypeScript fixture selects `types: ["node"]` and keeps `skipLibCheck: false`; this avoids auto-loading unrelated ambient MDX JSX types. Projects that consume MDX types directly must configure the JSX runtime they use.

Results remain in `.api-docs/npm-candidates/<commit>-<run>/`: archives, `manifest.json`, `consumer-result.json`, the installed consumer lockfile and a CycloneDX SBOM. The lockfile/SBOM describe this tested consumer, including its integration hosts, rather than every Docker/Java distribution. The source workflow retains candidates and browser reports for 14 days. These workflow steps are configured but remote execution is currently blocked by the GitHub account billing restriction; local results are separate evidence.

Browser builds collect license texts for packages identified in bundle source maps plus Vite's generated preload helper. Reader exports and Studio distributions include `assets/THIRD_PARTY_NOTICES.txt`; static exports retain that file. This is attribution collection, not completion of the release-wide dependency/license review.

## Still required before publication

Confirm owned npm/Maven/container namespaces and the final project name. Complete the advertised support matrix, independent security/accessibility review and pilots; verify branch/tag/environment protection; then test the exact candidate from a clean checkout. Registry release workflows, reviewed final version/changelog changes, Java/container SBOMs, signatures, provenance, upgrade/install rehearsals and release-owner approval remain launch gates. A local tarball install and a cache-only npm reinstall do not establish installation from public registries or a fully air-gapped server deployment.
