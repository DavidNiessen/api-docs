import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('authored components support keyboard tabs, disclosures and accessible navigation', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:4174/guides/components/');
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
});
test('every authored tab remains readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/guides/components/');
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
