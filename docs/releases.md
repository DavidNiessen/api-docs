# Development candidates and release gates

The project is in development. There is no approved stable release, registry ownership is not verified, and these commands do not publish anything. The current `@api-docs` scope and Maven coordinates remain provisional. Never install or execute artifacts from an untrusted pull request.

## Pack and verify npm components

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

Confirm owned npm/Maven/container namespaces and the final project name. Complete the advertised support matrix, independent security/accessibility review and pilots; verify branch/tag/environment protection; then test the exact candidate from a clean checkout. Registry release workflows, reviewed semantic version/changelog changes, Java/container SBOMs, signatures, provenance, upgrade/install rehearsals and release-owner approval remain launch gates. A local tarball install and a cache-only npm reinstall do not establish installation from public registries or a fully air-gapped server deployment.
