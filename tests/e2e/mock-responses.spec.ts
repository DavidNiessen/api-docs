import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const route =
  'http://127.0.0.1:4174/gallery/api/gallery/v1/previewmockresponses/?playground=open';
test('mock previews use examples and repeatable seeds without contacting the API or using visitor credentials', async ({
  page,
}) => {
  const requests: string[] = [],
    dialogs: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'api.example.test')
      requests.push(request.url());
  });
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
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
  await page.goto(route);
  const playground = page.getByLabel('API playground');
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('visitor-secret');
  const output = playground.getByRole('region', { name: 'API response' });
  await expect(
    output.getByText('Your response will appear here', { exact: true }),
  ).toBeVisible();
  await output.getByText('Preview a mock response', { exact: true }).click();
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  await expect(output.locator('.response-meta')).toContainText(
    'Mock response · example',
  );
  await expect(output.locator('.monaco-editor .view-lines')).toContainText(
    'published-example',
  );
  const copy = async () => {
    await output.getByRole('button', { name: 'Copy entire response' }).click();
    return page.evaluate(
      () => (window as unknown as { copied: string }).copied,
    );
  };
  expect(JSON.parse(await copy())).toEqual({
    id: 'published-example',
    status: 'ready',
  });
  await output.getByLabel('Mock response example').selectOption('generated');
  await output.getByLabel('Mock response seed').fill('repeatable');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  await expect(output.locator('.response-meta')).toContainText(
    'Mock response · schema',
  );
  const first = await copy();
  expect(JSON.parse(first).id).toMatch(/^[a-f0-9-]{36}$/);
  expect(first).not.toContain('visitor-secret');
  expect(JSON.parse(first)).not.toHaveProperty('privateInput');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  expect(await copy()).toBe(first);
  await output.getByLabel('Mock response seed').fill('different');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  expect(await copy()).not.toBe(first);
  await output.getByLabel('Mock response status').selectOption('400');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  await expect(output.locator('.response-meta')).toContainText('400');
  expect(JSON.parse(await copy())).toEqual({ error: 'invalid_input' });
  await output.getByLabel('Mock response status').selectOption('204');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  expect(await copy()).toBe('');
  await output.getByLabel('Mock response status').selectOption('200');
  await output.getByLabel('Mock response media type').selectOption('text/html');
  await output.getByRole('button', { name: 'Generate mock response' }).click();
  expect(await copy()).toContain('<script>window.mockExecuted=true</script>');
  expect(
    await page.evaluate(
      () => (window as unknown as { mockExecuted?: boolean }).mockExecuted,
    ),
  ).toBeUndefined();
  expect(requests).toEqual([]);
  expect(dialogs).toEqual([]);
});
test('mock controls and the response viewer are accessible in both themes and fit mobile', async ({
  page,
}) => {
  await page.goto(route);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') {
      await page.getByRole('button', { name: 'Close playground' }).click();
      await page.getByRole('button', { name: 'Switch to dark theme' }).click();
      await page.getByRole('button', { name: 'Try this endpoint' }).click();
    }
    const output = page.getByRole('region', { name: 'API response' });
    await output.getByText('Preview a mock response', { exact: true }).click();
    await output
      .getByRole('button', { name: 'Generate mock response' })
      .click();
    await expect(output.locator('.monaco-editor')).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator('.playground-dialog')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole('button', { name: 'Close playground' }).click();
  await page.getByRole('button', { name: 'Try this endpoint' }).click();
  await expect(
    page.getByText('Your response will appear here', { exact: true }),
  ).toBeVisible();
});
