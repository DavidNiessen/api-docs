# Framework integrations

All integrations serve the same verified static publication. Build it once with the CLI; no Node process is required inside a Java application. Adapter code does not generate OpenAPI from arbitrary application source: consume your framework's established OpenAPI generator instead.

## Express

Build with `basePath: /docs`, then mount the adapter:

```js
import express from 'express';
import { createExpressDocs } from '@api-docs/node/express';

const app = express();
const docs = await createExpressDocs({
  directory: './documentation/.api-docs/site',
  // authenticate: yourExistingAuthenticationMiddleware,
});
app.use(docs.mountPath, docs.router);
app.listen(8080);
```

The optional middleware runs before every documentation request, including search and assets. Use host authentication for private docs; hiding the navigation is insufficient. The adapter verifies the artifact at startup and rejects a mount path that disagrees with the compiled configuration.

## Fastify

```js
import Fastify from 'fastify';
import { apiDocsPlugin } from '@api-docs/node/fastify';

const app = Fastify();
await app.register(apiDocsPlugin, {
  directory: './documentation/.api-docs/site',
  // authenticate: yourExistingOnRequestHook,
});
await app.listen({ port: 8080 });
```

Authentication hooks remain within the plugin's encapsulation. Follow the documented immutable artifact policy and keep the generated `basePath` aligned with reverse-proxy routing.

## Spring Boot

Build and install the Java development artifacts with a JDK and Maven:

```sh
npm run build
node scripts/prepare-java-fixture.mjs
cd integrations/java
./mvnw --batch-mode --no-transfer-progress --strict-checksums install
```

Add `io.github.davidniessen.apidocs:api-docs-spring-boot-starter` to your application after installing or publishing the local artifacts. The current development version is `0.1.0-SNAPSHOT`. Registry publication is separate release work.

The local installation includes source and Javadoc archives. Spring-aware IDEs can complete the documented `api-docs` properties from the starter’s generated configuration metadata.

Configure a prebuilt publication:

```yaml
api-docs:
  enabled: true
  directory: /srv/documentation/site
  path: /docs
```

Auto-configuration supports servlet MVC and reactive WebFlux. It verifies the portable version 2 manifest identity and every file's SHA-256 digest before registering resource handlers. It serves only manifest-listed files and resolves page directories to `index.html`. Root navigation redirects to the index page without duplicating the application context prefix. The application's Spring Security configuration continues to protect documentation requests.

Optionally set `api-docs.artifact-digest` to an approved digest from your trusted build/release inventory; a mismatch fails startup. Older version 1 publications must be rebuilt before using this Java adapter. See [manifest verification and migration](artifact-manifest.md).

The publication's `basePath` must equal the application context path plus `api-docs.path`. For a proxy prefix that differs from the application context, set `api-docs.public-base-path` to the exact external path and compile the publication with that same path. Incorrect paths fail startup rather than producing broken assets.

Disable the integration with `api-docs.enabled=false`. Configure security rules for the entire `/docs/**` tree, including search JSON and scripts. The starter does not weaken the host security policy.

Spring Boot 3.5.16 and 4.1.1 pass the local Linux matrix on JDK 17, 21 and 25, compiling Java 17 bytecode. Each combination runs manifest and servlet/reactive host tests without skips. GitHub-hosted CI is configured for the same matrix but remains unverified while account billing blocks Actions. See [runtime versions, evidence and the local runner](java-validation.md). The installed-consumer runner also checks one baseline-built JAR against both Boot lines with isolated MVC-only/WebFlux-only classpaths; a compatibility split will be introduced if their binary APIs diverge.

## Generic Java

`api-docs-core` provides a `Publication` that validates an artifact directory and exposes only verified paths, its artifact digest and configured base path. A servlet, JAX-RS service, or other framework can use it with its own authentication and static serving mechanism. The optional constructor digest pins a deployment to an approved artifact. It requires no JavaScript engine or embedded web server.

## Other languages and runtime environments

Serve the static artifact using an existing authenticated file server, reverse proxy, or framework resource handler. The manifest and site configuration are portable JSON. Framework-specific source generation and native adapters for Python, Go, .NET, and other runtimes remain roadmap work; static hosting works independently of those adapters.
