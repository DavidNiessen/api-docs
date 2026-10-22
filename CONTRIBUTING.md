# Contributing

The project is in its planning phase. Start with the [product](docs/planning/01-product.md), [architecture](docs/planning/02-architecture.md), and [delivery](docs/planning/03-delivery-and-launch.md) documents. Proposed features are not implemented capabilities.

## Local checks

Install the Node.js version in `.node-version` and npm 11. The repository uses npm 11.9.0 as its package-manager baseline and commits `package-lock.json`.

```sh
npm ci --ignore-scripts
npm run check
```

Run `npm run format` to apply formatting. `npm run check` verifies Prettier formatting, JavaScript tooling with ESLint, and Markdown with markdownlint. It does not currently run application tests, builds, or TypeScript checks because no application implementation exists. Add those checks with the first runnable packages.

The current tooling has no required dependency lifecycle scripts, so installation uses `--ignore-scripts`. Reassess that policy explicitly when introducing build tools with legitimate installation steps.

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

Release automation, TypeScript/application checks, packaged Java/Node test matrices, security scanning, licensing, and community governance are tracked in the [launch plan](docs/planning/03-delivery-and-launch.md). No production release or package publication is configured at this stage.
