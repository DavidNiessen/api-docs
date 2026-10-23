# Public GitHub Pages demo

The public demo is intended for [davidniessen.github.io/api-docs](https://davidniessen.github.io/api-docs/). Deployment availability depends on repository Pages settings and successful GitHub Actions runs. The source is [examples/pages-demo](../examples/pages-demo), separate from the localhost API example.

## What visitors can try

The static site contains fictional Orbit projects and webhooks, authored guides, local search, API schemas, request examples, prepared themes, modern/classic layouts, resizable panels and the modal playground. **Send mock** generates a documented success response entirely in the browser. Mock controls also preview error statuses, named examples and seeded schema data. Highlighting, folding, fullscreen and complete-response copying work normally.

The demonstration explicitly configures:

```yaml
explorer:
  mode: mock
```

This mode prevents the reader's Send action from reaching live fetch/relay transport. Authentication controls and relay selection are unavailable. Changing the displayed API server cannot enable live requests. No credentials, backend or database are required. Mock generation ignores request inputs and does not create, update or delete resources. The illustrative `demo.orbit.invalid` address has no live service. Static page, asset and search requests still load from GitHub Pages.

Ordinary projects retain live sending by default; `explorer.mode: live` makes that choice explicit. Local mock-preview controls remain available alongside live sending. Mock mode is a demonstration feature, not a browser network sandbox for arbitrary custom scripts or styles.

## Build and preview locally

After installing the locked workspace dependencies:

```sh
pnpm run build
pnpm run demo:pages
pnpm run test:pages
```

The verified static root is `.api-docs/pages-demo/`. The build copies only the dedicated demo into temporary storage, applies the deployment origin/base path and removes the temporary project afterward. It replaces this generated output directory. The default URL derives from `GITHUB_REPOSITORY`, falling back to this repository. `PAGES_SITE_URL=https://docs.example.com/preview` overrides the build URL when testing another static host; it must be HTTPS without credentials, query or fragment. Custom-domain deployment additionally requires the corresponding GitHub Pages domain configuration.

To inspect the default build interactively, run `node scripts/pages-demo-browser-fixture.mjs` and open `http://127.0.0.1:4180/api-docs/`. This preview serves plain generated files and directory indexes, with no SPA fallback or API routes.

The dedicated browser suite blocks external requests and fails if one is attempted. It exercises direct/reloaded subpath links, 404s, local GET/POST/DELETE responses, error previews, server edits, classic playgrounds, exact response copy, fullscreen/folding, local search, theme matching, mobile accessibility and reading without JavaScript.

## Deployment pipeline

The **Repository quality** workflow builds and tests the static demo on branch pushes, pull requests and merge queue candidates. Its **Static mock demo** job is required by the aggregate **Quality** check. It uploads the verified site under a name containing that checkout's commit SHA.

After a successful quality run for a **push to master**, **Deploy public demo** downloads that exact run's artifact and deploys it to the `github-pages` environment. It does not rebuild or execute downloaded repository code. Pull requests, forks, failed runs and manual quality dispatches cannot deploy. Actions are pinned by SHA. Only the deployment job receives Pages write and OIDC permissions; artifact preparation uses read permissions.

Repository maintainers must enable **Settings → Pages → Build and deployment → Source: GitHub Actions** and allow deployments from `master` in the `github-pages` environment. Existing environment approval policies remain effective. Actions billing/spending restrictions must also permit the quality jobs to run. Repository files alone cannot grant this session access to Pages settings or remove billing restrictions.

Once enabled, a successful main pipeline publishes the demo automatically. To retry a failed deployment without a new commit, rerun the associated quality workflow; the successful completion triggers deployment again.
