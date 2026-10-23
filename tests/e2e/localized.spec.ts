import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const root = 'http://127.0.0.1:4177/localized';
test('translated labels preserve search, theme, modal focus, Scalar URL copying and Monaco controls', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
    }),
  );
  await page.goto(root + '/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(
    page.getByRole('link', { name: 'Dokumentation', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Dokumentation durchsuchen', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Dokumentation durchsuchen', exact: true })
    .fill('Projekte');
  await expect(page.locator('.search-results')).toContainText(
    'Projekte auflisten',
  );
  await page
    .getByRole('button', { name: 'Suche schließen', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Zum dunklen Design wechseln' })
    .click();
  await page.getByRole('link', { name: 'API-Referenz', exact: true }).click();
  await page.getByRole('button', { name: 'Jetzt testen', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Projekte auflisten testen',
  });
  const close = dialog.getByRole('button', { name: 'Testfenster schließen' });
  await expect(close).toBeFocused();
  const playground = page.getByLabel('API testen', { exact: true });
  await expect(
    playground.getByText('Deine Antwort erscheint hier', { exact: true }),
  ).toBeVisible();
  await playground
    .getByRole('button', { name: 'Anfrage-URL kopieren' })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { copied: string }).copied),
    )
    .toBe('http://127.0.0.1:4010/v1/projects');
  await expect(
    playground.getByRole('status').filter({ hasText: 'Kopiert' }),
  ).toHaveCount(1);
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('demo-token');
  await playground.getByRole('button', { name: 'Anfrage senden' }).click();
  const output = playground.getByRole('region', { name: 'API-Antwort' });
  await expect(output.locator('.monaco-editor')).toBeVisible();
  await output.getByRole('button', { name: 'Alles einklappen' }).click();
  await output
    .getByRole('button', { name: 'Vollständige Antwort kopieren' })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { copied: string }).copied),
    )
    .toContain('data');
  await output.getByRole('button', { name: 'Alles ausklappen' }).click();
  expect(
    (await new AxeBuilder({ page }).include('.playground-dialog').analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Jetzt testen', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Jetzt testen', exact: true }).click();
  await expect(close).toBeFocused();
  await close.click();
  expect(errors).toEqual([]);
});
test('translated navigation is prerendered and readable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(root + '/');
    await expect(
      page.getByRole('link', { name: 'Dokumentation', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Einstieg', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Erstellt mit api-docs', { exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'API-Referenz', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Projekte auflisten', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
