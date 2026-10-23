# Trusted build plugins

The current experimental SDK supports typed `theme` and `transform` hooks over the normalized site graph. Framework serving adapters are separate native integrations; see [integration instructions](integrations.md). Source loaders, custom browser components and dynamic snippet/search hooks remain roadmap work.

Start from [the runnable release-label example](../examples/plugins/release-label.mjs):

```sh
npm run build
node packages/cli/dist/main.js plugin-check release-label.mjs examples/plugins --trust-plugins
node packages/cli/dist/main.js plugin-check brand-theme.mjs examples/plugins --trust-plugins
node packages/cli/dist/main.js build examples/plugins --trust-plugins
```

The conformance command compiles the fixture with its configured plugins disabled, then executes the specified plugin twice in fresh workers. It checks metadata, graph shape, route identity, declared input hashes, configuration, and identical JSON output. It fails rather than certifying nondeterministic output. Repeatability on one fixture is useful evidence, not a security audit or proof across every project.

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

The SDK exports `runPluginFiles` and `checkPluginConformance` for tooling. Graph validation occurs there; compiler/CLI callers additionally validate project configuration and sanitize guide HTML. Advanced callers can choose bounded worker options (`timeoutMs`, `maxBytes`, `heapMiB`). `applyPlugins` remains an in-process helper for already trusted code; its abort timeout is cooperative and cannot stop synchronous loops. Use the file runner for compiler lifecycle guarantees.
