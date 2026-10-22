# CLI reference

Build the repository with `npm ci && npm run build`. Commands below use `node packages/cli/dist/main.js`; the packaged executable is named `api-docs`.

| Command                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `init [directory]`      | Create a project without overwriting existing files     |
| `build [project]`       | Compile and verify a static publication                 |
| `export [project]`      | Alias for build; output is portable static files        |
| `dev [project]`         | Build, serve and watch inputs; refresh after rebuilding |
| `serve <directory>`     | Serve an existing publication with security headers     |
| `validate [project]`    | Check configuration, specs and guides                   |
| `doctor [project]`      | Alias for validate; supports `--strict` and `--json`    |
| `diff <before> <after>` | Detect removed operations and newly required parameters |

`build` and `dev` accept `--config`, `--output`, and `--trust-plugins`. Output must stay inside the project's `.api-docs` directory to protect source files. `serve` and `dev` accept `--port` and `--host`; the default interface is loopback.

## Configuration

```yaml
schemaVersion: 1
name: My API
basePath: /docs
specs:
  - id: public
    path: openapi.yaml
    version: v1
guides: guides
theme:
  accent: '#148567'
  radius: 10
  density: comfortable
  font: system
```

A project can contain multiple API ids and versions. API ids and versions must be URL-safe. Relative references must resolve inside the project; external HTTP references are disabled. Vendor remote schemas locally for reproducible builds.

## Guides

Markdown front matter supports `title`, `description`, `group`, and numeric `order`. Tables, lists, code fences, blockquotes, and safe links are supported. Raw active HTML is removed. Heading anchors are deterministic. Trusted MDX and reusable interactive guide components are available with `--trust-content`; see the authoring reference.

## Trust and credentials

Plugins execute trusted local code and require `--trust-plugins`. A timeout is a cooperative lifecycle limit, not a security sandbox. Do not enable plugins from untrusted repositories. Reader credentials remain in memory; copied request examples use placeholders. The explorer sends browser requests directly, so the target API must permit the reader origin through CORS.

## Verification and diagnostics

Every build writes `manifest.json` with SHA-256 output digests and verifies it before replacing the previous output. Failed builds leave the prior publication available. Doctor warnings can be made fatal with `--strict`. The current diff command intentionally reports its limited classification scope; it does not yet detect every breaking schema change.

## Self-hosted publication protocol

The management server consumes immutable artifacts in its configured `ARTIFACT_ROOT`. Build with `basePath: /docs/<project-slug>`. Verify the generated manifest, then copy the complete build directory into `<ARTIFACT_ROOT>/<manifest.artifactDigest>` using an operator-controlled deployment process. Keep that directory immutable once registered.

Authenticate management API requests with an operator or project-scoped bearer token. Create a project, register its artifact, and activate it:

1. `POST /api/projects` with `slug`, `name`, and `visibility` (operator only).
2. `POST /api/projects/<id>/artifacts` with `artifactId` (publisher).
3. `POST /api/projects/<id>/publications` with `artifactId`, `expectedPublicationId` (null for the first publish), and a unique `idempotencyKey` (publisher).

Publish again with the same key and artifact to safely retry. A stale expected publication returns HTTP 409. Roll back by activating a previously registered artifact with a new key and the current expected publication id. History remains immutable.

Use `api-docs stage <directory> --store <artifact-root>` to verify and atomically stage a build; retries are idempotent. Then set `DOCS_PUBLISH_TOKEN` securely and use `api-docs publish <artifact-id> --server <https-origin> --project <slug-or-id>`. For loopback testing only, add `--insecure-development`. An optional `DOCS_IDEMPOTENCY_KEY` makes CI retries reuse the same publication request.

The protocol stages through operator-controlled storage rather than accepting arbitrary archives from the browser. Isolated upload/build workers are further roadmap work.

## Trusted guide execution

Build, export, validate and dev accept `--trust-content` for reviewed MDX. It is separate from `--trust-plugins`. Markdown needs neither flag. See the [authoring and component reference](authoring.md) for execution boundaries, frontmatter, reusable components and source limits.

## Incremental local preview

After the initial verified build, `dev` reuses its API graph for plain Markdown body edits whose navigation metadata stays unchanged. It updates the affected pages, search data and manifest, then asks you to refresh the browser. Navigation, configuration, spec, assets, plugins and trusted MDX changes use a full rebuild. Do not edit generated preview files manually. Staging and publishing always verify the complete artifact. See the [measured limits and invalidation behavior](performance.md).
