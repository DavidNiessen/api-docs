# Contributing

The project is implementing its roadmap. Start with the [product](docs/planning/01-product.md), [architecture](docs/planning/02-architecture.md), and [delivery](docs/planning/03-delivery-and-launch.md) documents. The README and tests identify runnable capabilities; roadmap features are not automatically implemented.

## Local checks

Install the Node.js version in `.node-version` and npm 11. The repository uses npm 11.9.0 as its package-manager baseline and commits `package-lock.json`.

```sh
npm ci
npm run check
```

Run `npm run format` to apply formatting. `npm run check` verifies Prettier, ESLint, Markdown, strict TypeScript, compiler tests, and a production build. Browser tests run with `npm run demo:build && npm run test:e2e` after `npx playwright install chromium`. For a system Chromium install, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.

If the managed environment's default npm cache is not writable, prefix installation with `npm_config_cache=/workspace/.npm-cache`; keep this machine-specific path out of portable repository configuration.

## Pull requests and commits

Use a short-lived feature branch and target `master`, the main integration branch. Keep changes focused and explain the problem, result, validation, and compatibility impact. Do not include credentials or unrelated generated files.

Use conventional commits and PR titles:

```text
docs(product): clarify versioned search requirements
feat(spec): normalize reusable request bodies
fix(explorer): preserve repeated query parameters
feat(plugin-sdk)!: revise the transform hook contract
```

Allowed types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`. Scopes are optional and lowercase. Document breaking changes and migrations in the PR and commit body. Commit and push each completed, validated implementation step.

Check a proposed PR title locally with:

```sh
PR_TITLE='docs(product): clarify release scope' npm run check:pr-title
```

## Automation and release status

The `Repository quality` workflow runs on branch pushes, PRs (including title edits), merge queue candidates, and manual dispatch. Its stable job name is `Quality`. It installs locked tooling and runs the same checks as local development; PR events also validate the title. It uses read-only permissions and does not publish artifacts.

Dependabot checks npm dependencies and GitHub Actions weekly. Actions are pinned by commit SHA. Maintainers must enable branch rules requiring `Quality` and review; repository files do not activate those settings.

CI also runs PostgreSQL/server and Studio browser integration tests and a Java 17/21/25 × Spring Boot 3.5/4.1 consumer matrix. Dependency audits block moderate or higher known advisories. See [governance](GOVERNANCE.md), [security reporting](SECURITY.md), and the [code of conduct](CODE_OF_CONDUCT.md). Contributions are licensed under Apache-2.0; no separate CLA or DCO sign-off is required.

Release automation, container scanning, and package publication are still tracked in the [launch plan](docs/planning/03-delivery-and-launch.md). No production release or package publication is configured at this stage.
