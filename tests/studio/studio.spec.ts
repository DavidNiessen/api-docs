import { test, expect } from '@playwright/test';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildSite, stageArtifact } from '@davidniessen/cli';
const temporary: string[] = [];
test.afterAll(async () => {
  for (const directory of temporary)
    await rm(directory, { recursive: true, force: true });
});
test('an operator creates a private project, publishes, reads it and audits the result', async ({
  page,
}) => {
  const slug = `browser-${Date.now()}`;
  await page.goto('/admin/');
  await page
    .getByLabel('Operator or project token')
    .fill(process.env.TEST_ROOT_TOKEN!);
  await page.getByRole('button', { name: 'Connect to workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Overview', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Project name').fill('Browser project');
  await page.getByLabel('URL slug').fill(slug);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Project created' }),
  ).toBeVisible();
  const root = resolve('.api-docs/studio-test', slug);
  temporary.push(root);
  await mkdir(root, { recursive: true });
  await cp(resolve('examples/demo'), root, {
    recursive: true,
    filter: (file) => !file.includes('.api-docs'),
  });
  const config = join(root, 'docs.config.yaml');
  await writeFile(
    config,
    (await readFile(config, 'utf8')) + `\nbasePath: /docs/${slug}\n`,
  );
  const built = await buildSite(root);
  const artifact = await stageArtifact(
    built.directory,
    resolve('.api-docs/studio-test/artifacts'),
  );
  temporary.push(resolve('.api-docs/studio-test/artifacts', artifact));
  let releaseHistory!: () => void;
  let historyRequested!: () => void;
  const history = new Promise<void>((resolve) => {
    releaseHistory = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    historyRequested = resolve;
  });
  let intercepted = false;
  await page.route('**/api/projects/*/publications', async (route) => {
    if (route.request().method() === 'GET' && !intercepted) {
      intercepted = true;
      historyRequested();
      await history;
      await route.fulfill({
        status: 503,
        json: { error: 'Publication history is temporarily unavailable.' },
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Publications', exact: true }).click();
  await requested;
  const artifactInput = page.getByLabel('Artifact SHA-256');
  try {
    await expect(artifactInput).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Verify and publish' }),
    ).toBeDisabled();
  } finally {
    releaseHistory();
  }
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Publication history is temporarily unavailable.' }),
  ).toBeVisible();
  await expect(artifactInput).toBeDisabled();
  await page.getByRole('button', { name: 'Retry publication history' }).click();
  await expect(artifactInput).toBeEnabled();
  await artifactInput.fill(artifact);
  await expect(artifactInput).toHaveValue(artifact);
  await page.getByRole('button', { name: 'Verify and publish' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Publication activated' }),
  ).toBeVisible();
  const documentation = await page.context().newPage();
  await documentation.goto(`/docs/${slug}/`);
  await expect(
    documentation.getByRole('heading', { name: 'Introduction', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Audit log', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'publication.activated', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to your workspace' }),
  ).toBeVisible();
  expect(
    (await documentation.goto(`/docs/${slug}/search.json`))?.status(),
  ).toBe(401);
});
