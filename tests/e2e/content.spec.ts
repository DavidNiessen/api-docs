import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('authored components support keyboard tabs, disclosures and accessible navigation', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4174/gallery/guides/components/');
  const javascript = page.getByRole('tab', { name: 'JavaScript', exact: true });
  const java = page.getByRole('tab', { name: 'Java', exact: true });
  await expect(javascript).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tabpanel').filter({ hasText: 'Java runs this example' }),
  ).toBeHidden();
  await javascript.focus();
  await page.keyboard.press('ArrowRight');
  await expect(java).toBeFocused();
  await expect(java).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tabpanel').filter({ hasText: 'Java runs this example' }),
  ).toBeVisible();
  await java.press('Home');
  await expect(javascript).toBeFocused();
  await page.getByText('Troubleshooting', { exact: true }).click();
  await expect(
    page.getByText('Verify the configured base URL', { exact: false }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  const dark = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    dark.violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    ),
  ).toEqual([]);
  await page
    .getByRole('link', { name: 'Open the health endpoint', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Service health', exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://docs.example.test/gallery/api/gallery/v1/health/',
  );
  await page.getByRole('button', { name: 'Search documentation…' }).click();
  await page
    .getByRole('textbox', { name: 'Search documentation', exact: true })
    .fill('health');
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link')
      .filter({ hasText: 'Service health' })
      .first(),
  ).toBeVisible();
  await page.goto('http://127.0.0.1:4174/gallery/missing/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Build your integration', exact: true })
    .first()
    .click();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://docs.example.test/gallery/guides/components/',
  );
});
test('every authored tab remains readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/gallery/guides/components/');
    await expect(
      page
        .getByRole('tabpanel')
        .filter({ hasText: 'JavaScript runs this example' }),
    ).toBeVisible();
    await expect(
      page.getByRole('tabpanel').filter({ hasText: 'Java runs this example' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
