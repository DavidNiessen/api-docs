import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const root = 'http://127.0.0.1:4177/localized';
const operation = root + '/api/api/v1/listprojects/?playground=open';

test('translated PKCE controls acquire a real token, keep it private and show localized expiry and clearing feedback', async ({
  page,
}) => {
  await page.clock.install();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(operation);
  const modal = page.getByLabel('API testen', { exact: true });
  await modal.getByLabel('Für 30 Minuten in diesem Tab merken').check();
  await expect(
    modal
      .getByRole('status')
      .filter({ hasText: 'Zugangsdaten bleiben bis zu 30 Minuten' }),
  ).toBeVisible();
  await modal.getByText('Öffentlicher OAuth-Client', { exact: true }).click();
  await expect(
    modal.getByLabel('OAuth-Client-ID für oauth', { exact: true }),
  ).toHaveValue('reader-fixture');
  await expect(
    modal.getByLabel('OAuth-Berechtigungsbereiche für oauth', { exact: true }),
  ).toHaveValue('projects:read');
  const callback = modal.getByLabel('OAuth-Weiterleitungs-URI für oauth', {
    exact: true,
  });
  await expect(callback).toHaveValue(root + '/oauth/callback/');
  await expect(callback).toHaveJSProperty('readOnly', true);
  const popupPromise = page.waitForEvent('popup');
  await modal
    .getByRole('button', { name: 'oauth mit PKCE autorisieren', exact: true })
    .click();
  const popup = await popupPromise;
  await popup
    .getByRole('button', { name: 'Authorize fixture client', exact: true })
    .click();
  const token = modal.getByLabel('Zugangsdaten oauth', { exact: true });
  await expect(token).toHaveValue('demo-token');
  await expect(
    modal.getByRole('status').filter({ hasText: 'Bearer-Token erhalten.' }),
  ).toBeVisible();
  await modal.locator('.playground-request-example > summary').click();
  await expect(modal.locator('pre')).not.toContainText('demo-token');
  const sent = page.waitForResponse(
    (response) =>
      response.url() === 'http://127.0.0.1:4010/v1/projects' &&
      response.request().method() === 'GET',
  );
  await modal
    .getByRole('button', { name: 'Anfrage senden', exact: true })
    .click();
  expect((await sent).status()).toBe(200);
  const storage = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
  expect(storage).not.toContain('demo-token');
  await page.clock.fastForward(61_000);
  await expect(token).toHaveValue('');
  await expect(
    modal.getByRole('status').filter({ hasText: 'Token abgelaufen.' }),
  ).toBeVisible();
  await token.fill('manual-fixture-token');
  await modal
    .getByRole('button', { name: 'Zugangsdaten oauth löschen', exact: true })
    .click();
  await expect(token).toHaveValue('');
  await expect(
    modal.getByRole('status').filter({ hasText: 'Zugangsdaten gelöscht.' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await new AxeBuilder({ page }).include('.playground-dialog').analyze())
      .violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test('translated credential reuse and relay errors preserve explicit retries, target credentials and original response bytes', async ({
  page,
}) => {
  const endpoint = 'http://127.0.0.1:4177/api/projects/localized/relay';
  let checks = 0,
    posts = 0,
    direct = 0;
  const errors: string[] = [];
  const raw = '{"relayed":"Grüße","id":9007199254740993}\n';
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:4010/')) direct++;
  });
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
  await page.route(endpoint, async (route) => {
    if (route.request().method() === 'GET') {
      checks++;
      if (checks === 1)
        return route.fulfill({
          status: 403,
          json: { error: 'private-policy-marker' },
        });
      return route.fulfill({
        json: {
          schemaVersion: 1,
          project: 'localized',
          maxRequestBytes: 1024 * 1024,
          maxResponseBytes: 2 * 1024 * 1024,
          timeoutMs: 30000,
          requestHeaders: ['Accept', 'Authorization', 'Content-Type'],
          destinations: [
            {
              origin: 'http://127.0.0.1:4010',
              pathPrefix: '/v1/',
              methods: ['GET'],
            },
          ],
        },
      });
    }
    posts++;
    expect(route.request().headers().authorization).toBeUndefined();
    expect(route.request().postDataJSON().headers).toContainEqual([
      'authorization',
      'Bearer relay-fixture-secret',
    ]);
    if (posts === 1)
      return route.fulfill({
        status: 503,
        json: { error: 'private-upstream-marker' },
      });
    await route.fulfill({
      json: {
        schemaVersion: 1,
        status: 200,
        headers: { 'content-type': 'application/json' },
        bodyBase64: Buffer.from(raw).toString('base64'),
      },
    });
  });
  await page.goto(operation);
  const modal = page.getByLabel('API testen', { exact: true });
  const credential = modal.getByLabel('Zugangsdaten bearer', { exact: true });
  await credential.fill('relay-fixture-secret');
  const remember = modal.getByLabel('Für 30 Minuten in diesem Tab merken');
  await remember.check();
  await remember.uncheck();
  await expect(
    modal
      .getByRole('status')
      .filter({ hasText: 'Gespeicherte Zugangsdaten wurden vergessen.' }),
  ).toBeVisible();
  await expect(credential).toHaveValue('relay-fixture-secret');
  await remember.check();
  await modal
    .getByRole('button', { name: 'Alle API-Zugangsdaten löschen', exact: true })
    .click();
  await expect(credential).toHaveValue('');
  await expect(
    modal
      .getByRole('status')
      .filter({ hasText: 'Alle API-Zugangsdaten wurden gelöscht.' }),
  ).toBeVisible();
  await credential.fill('relay-fixture-secret');
  await modal
    .getByLabel('Anfragetransport', { exact: true })
    .selectOption('relay');
  await expect(modal.getByRole('alert')).toContainText(
    'Der Dokumentationsserver hat den Relay-Zugriff oder diese Anfrage verweigert.',
  );
  expect(checks).toBe(1);
  await modal
    .getByRole('button', { name: 'Relay-Zugriff erneut prüfen', exact: true })
    .click();
  await expect(
    modal.getByRole('button', { name: 'Anfrage senden', exact: true }),
  ).toBeEnabled();
  expect(checks).toBe(2);
  await modal
    .getByRole('button', { name: 'Anfrage senden', exact: true })
    .click();
  await expect(modal.getByRole('alert')).toContainText(
    'Der Dokumentationsserver konnte die Relay-Anfrage nicht abschließen.',
  );
  expect(posts).toBe(1);
  expect(await modal.textContent()).not.toContain('private-upstream-marker');
  await modal
    .getByRole('button', { name: 'Anfrage senden', exact: true })
    .click();
  const response = modal.getByRole('region', {
    name: 'API-Antwort',
    exact: true,
  });
  await expect(response.locator('.monaco-editor')).toBeVisible();
  await response
    .getByRole('button', { name: 'Vollständige Antwort kopieren', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { copied: string }).copied),
    )
    .toBe(raw);
  expect(posts).toBe(2);
  expect(direct).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await new AxeBuilder({ page }).include('.playground-dialog').analyze())
      .violations,
  ).toEqual([]);
  expect(errors).toEqual([]);
});
