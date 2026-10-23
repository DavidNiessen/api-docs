# Trusted build plugins

The current experimental SDK supports typed `loadSpec`, `theme` and `transform` hooks. Framework serving adapters are separate native integrations; see [integration instructions](integrations.md). Custom browser components and dynamic snippet/search hooks remain roadmap work.

Start from [the runnable release-label example](../examples/plugins/release-label.mjs):

```sh
npm run build
node packages/cli/dist/main.js plugin-check release-label.mjs examples/plugins --trust-plugins
node packages/cli/dist/main.js plugin-check brand-theme.mjs examples/plugins --trust-plugins
node packages/cli/dist/main.js build examples/plugins --trust-plugins
node packages/cli/dist/main.js plugin-check deployment.mjs examples/source-plugin --trust-plugins
node packages/cli/dist/main.js build examples/source-plugin --trust-plugins
```

The conformance command substitutes the specified plugin for the fixture's configured plugin list and compiles the complete project twice. Each compilation runs source hooks in a fresh worker, validates/normalizes OpenAPI and then runs theme/graph hooks in a separate fresh worker. It checks metadata, graph shape, route identity, declared input hashes, configuration and identical JSON output. It fails rather than certifying nondeterministic output. Repeatability on one fixture is useful evidence, not a security audit or proof across every project.

## Public contract

```js
import { definePlugin } from '@api-docs/plugin-sdk';
export default definePlugin({
  name: '@example/release-label',
  version: '1.0.0',
  pluginApi: '1',
  capabilities: ['transform'],
  inputs: ['label.json', 'package-lock.json'],
  transform(site, { signal, diagnostic }) {
    if (signal.aborted) throw new Error('Cancelled');
    site.config.name = 'My API';
    diagnostic({
      code: 'release-label',
      severity: 'warning',
      message: 'Applied the release label.',
    });
    return site;
  },
});
```

`transform` receives a cloned graph and returns a graph; it can be asynchronous. Hooks run in configuration order, and each sees the preceding result. Duplicate plugin names, unsupported API versions, malformed graph fields, unknown security scheme references, duplicate routes, and invalid configuration fail the build. Guide HTML returned by plugins is sanitized again before rendering. Plugins must preserve the documented graph contract; arbitrary extension fields are rejected.

### Spec sources

`loadSpec(source, context)` requires `capabilities: ['source']`. It receives a cloned `SpecSource` (`id`, project-relative `path`, optional configured `version`, and UTF-8 `content`) for each configured spec, and returns a string containing YAML or JSON OpenAPI. Hooks run in configuration order, with every spec processed by one plugin before the next plugin runs. A hook can inspect the id/path and return the original text for inputs it does not handle. Source identity and reference base paths cannot be changed by mutating the snapshot.

```js
export default definePlugin({
  name: '@example/wrapped-export',
  version: '1.0.0',
  pluginApi: '1',
  capabilities: ['source'],
  loadSpec(source) {
    // Example producer emits an envelope around its OpenAPI document.
    if (source.path !== 'wrapped.json') return source.content;
    return JSON.stringify(JSON.parse(source.content).document);
  },
});
```

That minimal envelope example uses native JSON numbers; use a lossless parser when precise numeric examples matter. [The first-party deployment plugin](../examples/source-plugin/deployment.mjs) instead uses the public lossless JSON tree to replace only the top-level server list, retaining numeric tokens. That example deliberately supports JSON documents within the tree editor's 1 MiB/32-level/10,000-value limits and leaves other filenames untouched; the hook itself supports up to 16 MiB per spec, 64 MiB total and 128 configured specs. Declare the reviewed deployment file and any helpers in `inputs`. YAML-aware or alternate export adapters can supply their own bounded parser.

Returned text goes through the ordinary bounded parser, OpenAPI 3.0/3.1 structural validation, reference bundling and normalization. Local references remain relative to the original source file and confined to the project. Network reference fetching remains disabled. The build rejects malformed/non-string/oversized results, duplicate plugin names, changed spec inputs and changes to declared plugin inputs between stages. Failure preserves the previous publication.

Source and graph stages use separate processes/module caches; communicate through returned source text or declared immutable inputs, not module globals or filesystem writes. Each stage has the worker limits below. Source diagnostics are carried into the site before graph transforms. A plugin implementing multiple hooks lists every capability it uses. Source hooks do not fetch remote specs implicitly; use [explicit snapshot importing](remote-import.md) first.

### Theme tokens

[The runnable brand-theme example](../examples/plugins/brand-theme.mjs) reads a declared `brand.json` file and returns a `ThemePatch`. Theme-only plugins require `capabilities: ['theme']`. A plugin implementing both hooks declares `['theme', 'transform']`; its theme hook runs first, so its transform sees the updated theme. Existing transform plugins without capability declarations remain supported.

```js
export default definePlugin({
  name: '@example/brand',
  version: '1.0.0',
  pluginApi: '1',
  capabilities: ['theme'],
  theme(current, { signal }) {
    if (signal.aborted) throw new Error('Cancelled');
    return {
      radius: 12,
      accent: '#087f5b',
      colors: { light: { surface: '#f4f8f6' } },
    };
  },
});
```

The hook receives a separate theme snapshot; mutations to that snapshot are discarded. Return a plain partial token object. Omitted or undefined top-level values preserve existing tokens, and palette patches merge individual tokens within each mode, preserving the other mode. Selecting `preset` without `accent` applies that preset's default accent; an explicit accent takes precedence. Theme configuration supports colors, typography, radius, density, layout widths, code theme and a local public CSS asset path. This hook does not register browser components or execute client-side code. Custom CSS assets must already be inside the configured public assets directory.

The compiler and `plugin-check` apply the same strict configuration validation, including token types/ranges, safe asset paths and 4.5:1 text contrast. Invalid output fails before replacing a previous publication. Both hooks share the plugin's abort deadline and diagnostic context. Theme plugins use the same fresh worker, declared-input fingerprinting and explicit trust boundary as transforms. SDK callers using `applyPlugins`/`runPluginFiles` directly must still validate the resulting project configuration, as described below.

Entries must be compiled JavaScript (`.js`, `.mjs`, `.cjs`) inside the project. List helpers, configuration files and applicable lockfiles in `inputs`, relative to the project root. Entry files are always included. Paths are canonicalized and may not escape through traversal or symlinks. Inputs are regular files of at most 16 MiB each, with at most 128 declared inputs per plugin and 32 plugin files per invocation. Combined source reads are limited to 64 MiB per invocation, including repeated declarations. The generated manifest records plugin name/version, file hashes and a combined source digest. Changed declared files invalidate artifact identity even if the declared package version remains unchanged. Inputs that change during execution fail verification.

Each invocation starts a fresh process, including its module cache, so changing an imported helper takes effect on the next full development rebuild. Undeclared inputs are not fingerprinted automatically: declare all files affecting output, avoid network/time/randomness, and never treat an undeclared dependency as cacheable.

## Execution and trust

`--trust-plugins` acknowledges execution of reviewed local code. The worker has a 10-second external deadline, a 512 MiB V8 old-space limit, and 128 MiB serialized input/output limits. Exceeding a limit or throwing fails the build and preserves the previous publication. The old-space limit is not a total RSS or CPU quota. On POSIX systems the worker process group is killed on completion/failure; Windows terminates the worker itself. Detached descendants can escape this lifecycle mechanism.

The dedicated output pipe separates protocol data from plugin stdout/stderr. Arbitrary logs and exception details are not relayed, because they can contain build credentials. Use explicit diagnostics for reviewed, non-sensitive messages. Diagnostic content is published with the artifact; never include secrets. Worker failures intentionally use generic messages.

**This is a trusted-code resource boundary, not a security sandbox.** The worker inherits the build user's filesystem, environment and network access. Capability declarations document intended behavior and do not enforce OS permissions. Review imports as well as entry files. Run untrusted or hosted builds in a separately restricted container/OS environment without host credentials, with source/output mounts and network/CPU/memory policies. The management server still accepts operator-staged artifacts, rather than executing uploaded plugins.

The SDK exports `runPluginFiles` / `checkPluginConformance` for graph/theme tooling and `runSourcePluginFiles` / `checkSourcePluginConformance` for bounded source-text tooling. The latter validates source identities, byte limits and diagnostics; callers must still validate/normalize OpenAPI. The compiler exports `checkProjectPluginConformance` for the complete pipeline, which the CLI uses. Compiler/CLI callers also validate project configuration and sanitize guide HTML. Advanced callers can choose bounded worker options (`timeoutMs`, `maxBytes`, `heapMiB`). `applyPlugins` remains an in-process helper for already trusted code; its abort timeout is cooperative and cannot stop synchronous loops. Use the file runner for compiler lifecycle guarantees.
