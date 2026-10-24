# api-docs

An open source, self-hosted API documentation platform: polished documentation, interactive API references, and framework integrations without a required hosted service.

**Status: implementation in progress.** The OpenAPI compiler, React reader, worker-based local search, API explorer, CLI, publication server, Studio, and Java/Spring Boot/Node integrations are runnable. Container deployment and recovery are available. Production acceptance, independent reviews and signed distribution gates remain open. `api-docs` is a temporary name pending the product rename.

The owner has [deferred independent launch reviews and pilots for prereleases](docs/adr/0002-deferred-prerelease-reviews.md). Those reviews remain unfinished; automated checks and protected registry installation acceptance remain required. This deferral is not a stable production release approval.

Try the [GitHub Pages demo](https://davidniessen.github.io/api-docs/): bundled mock responses run entirely in your browser, with no API server or credentials. See [demo deployment and local preview](docs/pages-demo.md).

Distributions target [GitHub Packages and GHCR](docs/github-packages.md). npm/Maven installation requires GitHub authentication; running generated static documentation requires no account. Actual protected publication and fresh registry acceptance remain release gates.

## Product direction

- Import OpenAPI in YAML or JSON and combine generated reference pages with authored guides.
- Deliver a refined, Mintlify-inspired reading experience with extensive branding, accessible components, and fast navigation.
- Publish to static hosting or run a self-hosted server for authentication, editing, publishing, and team workflows.
- Integrate through versioned plugins, including Java/Spring Boot and JavaScript/TypeScript frameworks.
- Keep core authoring, hosting, search, authentication, and customization available in the open source product.

## Plan

1. [Product specification](docs/planning/01-product.md): scope, visual direction, features, and measurable launch requirements.
2. [Architecture and engineering design](docs/planning/02-architecture.md): stack, package boundaries, plugin contracts, integrations, and security.
3. [Delivery and open source launch](docs/planning/03-delivery-and-launch.md): phased implementation, CI/CD, release gates, risks, and the launch checklist.
4. [Implementation progress](docs/planning/04-progress.md): current estimate, completed capabilities, validation and remaining launch work.

## Run the example

Use Node.js from `.node-version` and pnpm 11.25.0 (`npm install --global pnpm@11.25.0`):

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run demo:build
pnpm run demo:serve
```

The documentation server listens on port 3000. In a second terminal, run `npm run demo:api` to start the local API on port 4010. Use the public fixture token `demo-token` in the playground. These are local demonstration services.

## Document your own API

```sh
node packages/cli/dist/main.js init my-docs
node packages/cli/dist/main.js build my-docs
node packages/cli/dist/main.js serve my-docs/.api-docs/site
```

Edit `docs.config.yaml`, point it to your YAML or JSON OpenAPI document, and add Markdown guides. Copy the generated `.api-docs/site` folder to any static host. Multi-file remote specs can use [pinned offline reference snapshots](docs/reference-snapshots.md). See the [CLI reference](docs/cli.md), [OpenAPI compatibility](docs/openapi-compatibility.md), [guide authoring](docs/authoring.md), and [branding and SEO](docs/customization.md), and [deprecations and migration guidance](docs/lifecycle.md), and [core reader UI translations](docs/internationalization.md).

## Repository checks

Use the pinned Node.js and pnpm versions:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run check
pnpm run demo:build
pnpm exec playwright install chromium
pnpm run test:e2e
```

Prettier, ESLint, and Markdown linting run on feature branch pushes, pull requests, merge queue candidates, and `master`. PR titles use conventional commit format. Strict TypeScript checks, compiler/security unit tests, deterministic publication checks, browser workflows, and automated accessibility checks also run in CI. See [CONTRIBUTING](CONTRIBUTING.md).

## Project principles

The documentation must work without an account with the project maintainers. Deployments own their content, credentials, configuration, and artifacts. Public documentation should remain readable when optional services fail. Accessibility, security, upgrade safety, and performance are release requirements.

The visual direction takes inspiration from Mintlify's layout and interaction quality while using original implementation, branding, assets, and copy.

Readers can choose modern islands or a classic API layout, select prepared theme presets with matching response-editor colors, and filter the sidebar with All, Documentation and API Reference. See [reader settings and layouts](docs/reader-layout.md#personal-reader-settings).

## Self hosting and project policy

See the [server configuration](docs/server.md), [Studio build controls](docs/studio-builds.md), [separate build worker](docs/build-worker.md), [container deployment and recovery](docs/deployment.md), [framework integrations](docs/integrations.md), [trusted build plugins](docs/plugins.md), [candidate packaging](docs/releases.md), and [measured performance](docs/performance.md). Code is licensed under [Apache-2.0](LICENSE); see [NOTICE](NOTICE), [security reporting](SECURITY.md), [governance](GOVERNANCE.md), and the [code of conduct](CODE_OF_CONDUCT.md).
