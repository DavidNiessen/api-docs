import { test, expect } from '@playwright/test';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildSite, stageArtifact } from '@api-docs/cli';
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
  await page.getByRole('button', { name: 'Publications', exact: true }).click();
  await page.getByLabel('Artifact SHA-256').fill(artifact);
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
