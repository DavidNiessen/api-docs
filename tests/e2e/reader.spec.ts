import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('reader, local search and live API playground work end to end', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Introduction', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Search documentation', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Search documentation', exact: true })
    .fill('create project');
  await page
    .getByRole('dialog')
    .getByRole('link')
    .filter({ hasText: 'Create a project' })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Create a project', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'bearerAuth credential' })
    .fill('demo-token');
  const createRequest = page.waitForResponse(
    (response) =>
      response.url() === 'http://127.0.0.1:4010/v1/projects' &&
      response.request().method() === 'POST',
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Send request' }).click();
  expect((await createRequest).status()).toBe(201);
  await expect(
    page.getByLabel('API playground').getByText('201', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByLabel('API playground')
      .getByText('My first project', { exact: false })
      .first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Introduction', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Create a project', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Quickstart', exact: true })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Make your first request', exact: true }),
  ).toBeVisible();
  await page.goto('/index.html');
  await expect(
    page.getByRole('heading', { name: 'Introduction', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('core guide is accessible and readable without JavaScript', async ({
  browser,
  page,
}) => {
  await page.goto('/');
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto('/guides/quickstart/');
  await expect(
    plain.getByRole('heading', { name: 'Quickstart', exact: true }),
  ).toBeVisible();
  await expect(
    plain.getByText('Make your first request', { exact: true }).first(),
  ).toBeVisible();
  await context.close();
});
test('mobile navigation and unknown routes behave correctly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Search documentation', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Search documentation' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Authentication', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Authentication', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await page.goto('/missing/');
  expect(result?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});

test('authored guide links preserve queries, fragments and same-page history', async ({
  page,
}) => {
  await page.goto('/guides/introduction/');
  const quickstart = page.getByRole('link', {
    name: 'quickstart',
    exact: true,
  });
  await quickstart.evaluate((element) => {
    const link = element as HTMLAnchorElement,
      url = new URL(link.href);
    url.searchParams.set('ref', 'introduction');
    link.href = url.href;
  });
  await quickstart.click();
  await expect(page).toHaveURL(
    /\/guides\/quickstart\/\?ref=introduction#heading-make-your-first-request$/,
  );
  await expect(
    page.locator('#heading-make-your-first-request'),
  ).toBeInViewport();
  await page
    .locator('.page-toc')
    .getByRole('link', { name: 'Build your integration', exact: true })
    .click();
  await expect(page).toHaveURL(/#heading-build-your-integration$/);
  const repeat = page.getByRole('link', {
    name: 'Return to your first request',
    exact: true,
  });
  await repeat.evaluate((element) => {
    const link = element as HTMLAnchorElement,
      url = new URL(link.href);
    url.search = location.search;
    link.href = url.href;
  });
  await repeat.click();
  await expect(page).toHaveURL(
    /\?ref=introduction#heading-make-your-first-request$/,
  );
  await expect(
    page.locator('#heading-make-your-first-request'),
  ).toBeInViewport();
});
