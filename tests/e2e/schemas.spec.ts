import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('schema constraints remain visible for booleans, arrays, dictionaries and composition', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    'http://127.0.0.1:4174/gallery/api/gallery/v1/inspectschemas/',
  );
  const response = page.locator('#responses');
  await expect(
    response
      .locator('.schema-constraints')
      .first()
      .getByText('minProperties', { exact: true }),
  ).toBeVisible();
  const field = (name: string) =>
    response
      .locator('.schema-field')
      .filter({
        has: page
          .locator('.field-heading > code')
          .filter({ hasText: new RegExp(`^${name}$`) }),
      })
      .first();
  await expect(
    field('forbidden').getByText('no value allowed', { exact: true }),
  ).toBeVisible();
  await expect(
    field('free').getByText('any value', { exact: true }),
  ).toBeVisible();
  await expect(field('nullableAnnotation').locator('.type-label')).toHaveText(
    'string',
  );
  await expect(field('id').locator('.deprecated-label')).toBeVisible();
  await expect(
    field('id').getByText('readOnly', { exact: true }),
  ).toBeVisible();
  await expect(
    field('id').getByText('A nonnegative numeric identifier.', { exact: true }),
  ).toBeVisible();
  await field('nullableList')
    .getByText('Show child attributes', { exact: true })
    .click();
  await expect(
    field('nullableList').getByText('array | null', { exact: true }),
  ).toBeVisible();
  await expect(
    field('nullableList').getByText('minItems', { exact: true }),
  ).toBeVisible();
  await field('nullableList')
    .getByText('Array items', { exact: false })
    .click();
  await expect(
    field('nullableList').getByText('minimum', { exact: true }),
  ).toBeVisible();
  await field('dictionary')
    .getByText('Show child attributes', { exact: true })
    .click();
  await field('dictionary')
    .getByText('Additional properties', { exact: false })
    .click();
  await expect(
    field('dictionary').getByText('maximum', { exact: true }),
  ).toBeVisible();
  await field('tuple')
    .getByText('Show child attributes', { exact: true })
    .click();
  await field('tuple').getByText('Position 2', { exact: false }).click();
  await expect(
    field('tuple')
      .locator('.schema-view')
      .getByText('no value allowed', { exact: true })
      .first(),
  ).toBeVisible();
  await field('choice')
    .getByText('Show child attributes', { exact: true })
    .click();
  await expect(
    field('choice').getByText('minLength', { exact: true }),
  ).toBeVisible();
  await expect(
    field('choice').getByText('Every variant must match.', { exact: true }),
  ).toBeVisible();
  await expect(
    field('choice').getByText('One or more variants must match.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(field('values').locator('.schema-enum code')).toHaveText([
    'null',
    '"null"',
    'false',
    '0',
  ]);
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('schema-light.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const darkAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(darkAudit.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('schema-dark.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(
    'http://127.0.0.1:4174/gallery/api/legacy/v1/nullablelegacy/',
  );
  await expect(
    page.locator('#responses .field-heading .type-label'),
  ).toHaveText(['any', 'string | null']);
  expect(errors).toEqual([]);
});
