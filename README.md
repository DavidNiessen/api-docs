# api-docs

A planned open source, self-hosted API documentation platform: polished documentation, interactive API references, and framework integrations without a required hosted service.

**Status: product and engineering planning.** This repository does not yet contain a working documentation application. The specifications below define the intended product and its acceptance criteria; they are not claims about implemented features.

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

## Repository checks

Use Node.js from `.node-version` and npm 11:

```sh
npm ci --ignore-scripts
npm run check
```

Prettier, ESLint, and Markdown linting run on feature branch pushes, pull requests, merge queue candidates, and `master`. PR titles use conventional commit format. See [CONTRIBUTING](CONTRIBUTING.md) for details and the distinction between current documentation checks and planned application/release pipelines.

## Project principles

The documentation must work without an account with the project maintainers. Deployments own their content, credentials, configuration, and artifacts. Public documentation should remain readable when optional services fail. Accessibility, security, upgrade safety, and performance are release requirements.

The visual direction takes inspiration from Mintlify's layout and interaction quality while using original implementation, branding, assets, and copy.
