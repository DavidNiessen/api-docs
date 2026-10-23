import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const root = 'http://127.0.0.1:4177/localized';
const operation = '/api/api/v1/listprojects/';

test('localized personal and editor settings preserve portable values and literal theme names across languages', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) =>
          sessionStorage.setItem('localized-theme-copy', text),
      },
    }),
  );
  await page.goto(root + operation);
  const open = page.getByRole('button', {
    name: 'Leseeinstellungen öffnen',
    exact: true,
  });
  await open.click();
  const dialog = page.getByRole('dialog', {
    name: 'Leseeinstellungen',
    exact: true,
  });
  await expect(
    dialog.getByRole('region', { name: 'Persönliche Einstellungen' }),
  ).toBeVisible();
  await dialog
    .getByRole('combobox', { name: 'Darstellungsmodus', exact: true })
    .selectOption('dark');
  await dialog
    .getByRole('combobox', { name: 'Voreinstellung', exact: true })
    .selectOption('ocean');
  const name = '<img src=x onerror=alert(1)>';
  await dialog.getByLabel('Designname', { exact: true }).fill(name);
  await dialog
    .getByRole('button', { name: 'Aktuelles Design speichern' })
    .click();
  await expect(
    dialog.getByRole('button', { name: `${name} anwenden`, exact: true }),
  ).toBeVisible();
  await expect(dialog.locator('img')).toHaveCount(0);
  await dialog
    .getByRole('combobox', { name: 'Design des Antworteditors', exact: true })
    .selectOption('custom');
  await expect(
    dialog.getByLabel('Editorfarbe: Hintergrund', { exact: true }),
  ).toBeVisible();
  const foreground = dialog.getByLabel('Editorfarbe: Vordergrund', {
    exact: true,
  });
  await foreground.evaluate((input) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, '#101820');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(dialog.getByRole('status')).toContainText([
    'Editor-Kontrast unter 4,5:1: Vordergrund.',
  ]);
  await foreground.evaluate((input) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, '#ffffff');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dialog
    .getByRole('button', { name: 'Designkonfiguration kopieren', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toContainText(['Design kopiert.']);
  const copied = JSON.parse(
    (await page.evaluate(() =>
      sessionStorage.getItem('localized-theme-copy'),
    ))!,
  );
  expect(copied.theme).toMatchObject({
    preset: 'ocean',
    font: 'system',
    density: 'comfortable',
  });
  expect(copied.theme).not.toHaveProperty('savedThemes');
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  const preview = dialog.getByRole('region', {
    name: 'Vorschau der Editor-Farbpalette',
    exact: true,
  });
  await preview.focus();
  await expect(preview).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => preview.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await page.locator('.locale-menu > summary').click();
  await page
    .locator('.locale-menu')
    .getByRole('link', { name: 'English', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open reader settings', exact: true })
    .click();
  const english = page.getByRole('dialog', {
    name: 'Reader settings',
    exact: true,
  });
  await expect(
    english.getByRole('combobox', {
      name: 'Response editor theme',
      exact: true,
    }),
  ).toHaveValue('custom');
  await expect(
    english.getByRole('button', { name: `Apply ${name}`, exact: true }),
  ).toBeVisible();
  await english
    .getByRole('button', { name: `Delete theme ${name}`, exact: true })
    .click();
  await expect(
    english.getByRole('button', { name: `Apply ${name}`, exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('localized classic lists retain translated retry states, counts, pagination and endpoint details', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      'api-docs:reader-settings:v1:/localized',
      JSON.stringify({ version: 1, layout: 'classic' }),
    ),
  );
  let catalogCalls = 0,
    pageCalls = 0,
    detailCalls = 0;
  await page.route(root + '/api-index/0/catalog.json', (route) =>
    ++catalogCalls === 1
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({
          json: {
            schemaVersion: 1,
            apiId: 'api',
            version: 'v1',
            total: 101,
            pageSize: 100,
            pages: 2,
          },
        }),
  );
  await page.route(root + '/api-index/0/0.json', (route) =>
    ++pageCalls === 1
      ? route.fulfill({ status: 503, body: 'Unavailable' })
      : route.fulfill({
          json: {
            schemaVersion: 1,
            apiId: 'api',
            version: 'v1',
            page: 0,
            operations: Array.from({ length: 100 }, (_, i) => ({
              slug: `virtual${i}`,
              method: 'get',
              path: `/virtual/${i}`,
              summary: `Virtuell ${i}`,
              tag: 'Testgruppe',
              deprecated: i === 0,
            })),
          },
        }),
  );
  await page.route(root + '/api-index/0/1.json', (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        apiId: 'api',
        version: 'v1',
        page: 1,
        operations: [
          {
            slug: 'listprojects',
            method: 'get',
            path: '/projects',
            summary: 'Projekte auflisten',
            tag: 'Projekte',
            deprecated: false,
          },
        ],
      },
    }),
  );
  await page.route(root + '/api/api/v1/virtual0/page-data.json', (route) => {
    detailCalls++;
    return route.fulfill({ status: 503, body: 'Unavailable' });
  });
  await page.goto(root + operation);
  await expect(
    page.getByRole('region', { name: 'API-Endpunktreferenz', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'Die Endpunktliste konnte nicht geladen werden.',
  );
  await page
    .getByRole('button', { name: 'Endpunktliste erneut laden', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(
    'Diese Endpunktseite konnte nicht geladen werden.',
  );
  await page
    .getByRole('button', { name: 'Endpunktliste erneut laden', exact: true })
    .click();
  await expect(page.locator('.endpoint-disclosure')).toHaveCount(100);
  await expect(page.locator('.classic-pagination')).toContainText(
    'Endpunkte: 101 · Seite 1 von 2',
  );
  const row = page.locator('#classic-0-virtual0');
  await expect(row.locator('summary')).toContainText('Veraltet');
  await row.locator('summary').click();
  await expect(row.getByRole('alert')).toContainText(
    'Die Endpunktdetails konnten nicht geladen werden.',
  );
  await row
    .getByRole('button', { name: 'Endpunktdetails erneut laden', exact: true })
    .click();
  await expect.poll(() => detailCalls).toBe(2);
  await page
    .getByRole('button', { name: 'Nächste Endpunkte', exact: true })
    .click();
  await expect(page.locator('.classic-pagination')).toContainText(
    'Endpunkte: 101 · Seite 2 von 2',
  );
  await page.locator('#classic-1-listprojects > summary').click();
  await expect(
    page.getByRole('link', { name: 'Dauerhafter Endpunktlink', exact: true }),
  ).toHaveAttribute(
    'href',
    '/localized/api/api/v1/listprojects/#classic-1-listprojects',
  );
  await page.getByRole('button', { name: 'Jetzt testen', exact: true }).click();
  await expect(
    page.getByRole('dialog', {
      name: 'Projekte auflisten testen',
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Jetzt testen', exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(catalogCalls).toBe(2);
  expect(pageCalls).toBe(2);
  expect(errors).toEqual([]);
});
