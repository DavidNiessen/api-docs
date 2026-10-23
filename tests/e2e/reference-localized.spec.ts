import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('localized schema controls preserve authored properties, enum values and English fallback across language changes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4177/localized/api/api/v1/listprojects/');
  const response = page.locator('#responses');
  await response
    .getByText('Unterattribute anzeigen', { exact: true })
    .first()
    .click();
  await response.getByText('Array-Elemente', { exact: false }).click();
  const field = (name: string) =>
    response
      .locator('.schema-field')
      .filter({
        has: page
          .locator('.field-heading > code')
          .filter({ hasText: new RegExp(`^${name}$`) }),
      })
      .first();
  await expect(field('id').locator('.required')).toHaveText('erforderlich');
  await expect(field('status').locator('.schema-enum')).toContainText(
    'Erlaubte Werte:',
  );
  await expect(field('status').locator('.schema-enum code')).toHaveText([
    '"active"',
    '"paused"',
  ]);
  await expect(field('status')).toContainText('Aktueller Projektstatus.');
  await expect(field('legacyId').locator('.deprecated-label')).toHaveText(
    'veraltet',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator('.locale-menu > summary').click();
  await page
    .locator('.locale-menu')
    .getByRole('link', { name: 'English', exact: true })
    .click();
  await response
    .getByText('Show child attributes', { exact: true })
    .first()
    .click();
  await response.getByText('Array items', { exact: false }).click();
  await expect(field('id').locator('.required')).toHaveText('required');
  await expect(field('status').locator('.schema-enum')).toContainText(
    'Allowed values:',
  );
  await expect(field('status')).toContainText('Aktueller Projektstatus.');
  expect(errors).toEqual([]);
});

test('localized lifecycle status, grouped pagination and migration links work with and without JavaScript', async ({
  page,
  browser,
}) => {
  const root = 'http://127.0.0.1:4176/reference/de';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2027-05-15T12:00:00Z'));
  await page.goto(root + '/deprecations/');
  await expect(
    page.getByRole('heading', { name: 'Abkündigungen', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Stand: 2027-05-15 (UTC).', { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .locator('.lifecycle-status')
      .filter({ hasText: 'Abschaltdatum erreicht' }),
  ).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Seiten der Abkündigungen' }),
  ).toContainText('Seite 1 von 2');
  await page.getByRole('link', { name: 'Nächste Seite', exact: true }).click();
  await expect(page).toHaveURL(root + '/deprecations/page/2/');
  await expect(page.locator('.lifecycle-card')).toHaveCount(6);
  await page.getByText('API und Version auswählen', { exact: true }).click();
  await page
    .getByRole('link', { name: 'Catalog API · v2 1', exact: true })
    .click();
  await expect(page).toHaveURL(root + '/deprecations/api/catalog/version/v2/');
  await expect(page.locator('.lifecycle-center')).toContainText(
    '1 Endpunkt in Catalog API · v2',
  );
  await expect(page.locator('.lifecycle-status')).toHaveText(
    'Lebenszyklusankündigung',
  );
  await page
    .getByRole('link', { name: 'Migrationsanleitung', exact: true })
    .click();
  await expect(page).toHaveURL(
    root + '/guides/migration/#heading-update-your-client',
  );
  await expect(page.locator('#heading-update-your-client')).toBeInViewport();
  await page.goto(root + '/api/catalog/v1/listwidgets/');
  const notice = page.getByRole('complementary', {
    name: 'Lebenszyklus des Endpunkts',
    exact: true,
  });
  await expect(notice).toContainText('Abschaltdatum innerhalb von 30 Tagen');
  await expect(
    notice.getByRole('link', { name: 'Nachfolgeendpunkt', exact: true }),
  ).toHaveAttribute('href', '/reference/de/api/catalog/v2/listwidgets/');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(root + '/deprecations/');
    await expect(staticPage.locator('html')).toHaveAttribute('lang', 'de');
    await expect(staticPage.locator('.lifecycle-center')).toContainText(
      'Der Kalenderstatus benötigt JavaScript.',
    );
    await staticPage
      .getByRole('link', { name: 'Nächste Seite', exact: true })
      .click();
    await expect(staticPage).toHaveURL(root + '/deprecations/page/2/');
    await expect(staticPage.locator('.lifecycle-card')).toHaveCount(6);
  } finally {
    await context.close();
  }
  expect(errors).toEqual([]);
});
