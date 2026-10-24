import { test, expect } from '@playwright/test';

test('the live Send action retains confirmation and replaces an earlier mock response', async ({
  page,
}) => {
  const target = 'https://api.example.test/mock-preview';
  let posts = 0;
  await page.route(target, async (route) => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization',
      'content-type': 'application/json',
    };
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers });
    posts++;
    expect(route.request().headers().authorization).toBe(
      'Bearer visitor-secret',
    );
    await route.fulfill({ status: 200, headers, body: '{"live":true}' });
  });
  await page.goto(
    'http://127.0.0.1:4174/gallery/api/gallery/v1/previewmockresponses/?playground=open',
  );
  const playground = page.getByLabel('API playground'),
    output = playground.getByRole('region', { name: 'API response' });
  await playground.getByText('Mock response options', { exact: true }).click();
  await playground
    .getByRole('button', { name: 'Generate mock response' })
    .click();
  await expect(output.locator('.response-meta')).toContainText('Mock response');
  expect(posts).toBe(0);
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('visitor-secret');
  page.once('dialog', (dialog) => dialog.accept());
  await playground.getByRole('button', { name: 'Send request' }).click();
  await expect(output.locator('.monaco-editor .view-lines')).toContainText(
    'live',
  );
  await expect(output.locator('.mock-response-badge')).toHaveCount(0);
  await expect(output.locator('.response-meta')).toContainText(/\d+ ms/);
  expect(posts).toBe(1);
});
