# Distribution version consistency

The repository uses one distribution version across the root, all npm workspaces and the Java reactor. `packages/contracts/src/version.ts` exports the runtime `toolVersion` used by the CLI, HTML generator metadata and compiler manifests. API documentation versions, plugin API versions and artifact schema versions have separate contracts.

```sh
npm run check:versions
npm run check:versions -- --json
npm run check:versions -- --release --json
```

The first two commands inspect development metadata without writing files. Development allows Java's matching `-SNAPSHOT` suffix. `--release` requires the exact npm version in every Java POM, including prerelease qualifiers, with no snapshot suffix. The current development checkout intentionally fails that stricter mode. A passing version check establishes alignment; publication also requires the [release gates](releases.md).

Versions must be canonical SemVer. Build metadata is excluded because npm does not give it a separate distribution identity. Every internal dependency uses the exact unified version, including private workspaces. Public runtime, optional and peer dependencies cannot point to private packages. The npm lockfile must agree with workspace declarations, package inventories, versions, links and internal dependency references. The root Maven reactor declares the modules inspected by the checker; owned core dependencies use `${project.version}`.

`npm run check` runs this audit and the Node tooling tests before the compiler tests. npm candidate packaging repeats the audit and discovers public components from the same workspace inventory. It excludes private applications, refuses colliding archive filenames and checks the installed CLI, generator metadata and manifest against the packaged runtime version. Metadata symlinks outside the checkout are refused.

The current commands validate and report alignment. Release preparation, conventional-commit changelog generation, protected publication, signatures and provenance verification remain separate implementation/review gates. All package namespaces remain provisional until ownership is verified. No version bump, registry publication or release tag is performed by these checks.
