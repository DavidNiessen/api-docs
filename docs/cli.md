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

Markdown front matter supports `title`, `description`, `group`, and numeric `order`. Tables, lists, code fences, blockquotes, and safe links are supported. Raw active HTML is removed. Heading anchors are deterministic. MDX and custom interactive guide components are not yet implemented.

## Trust and credentials

Plugins execute trusted local code and require `--trust-plugins`. A timeout is a cooperative lifecycle limit, not a security sandbox. Do not enable plugins from untrusted repositories. Reader credentials remain in memory; copied request examples use placeholders. The explorer sends browser requests directly, so the target API must permit the reader origin through CORS.

## Verification and diagnostics

Every build writes `manifest.json` with SHA-256 output digests and verifies it before replacing the previous output. Failed builds leave the prior publication available. Doctor warnings can be made fatal with `--strict`. The current diff command intentionally reports its limited classification scope; it does not yet detect every breaking schema change.
