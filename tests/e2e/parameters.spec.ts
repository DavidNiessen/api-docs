import { test, expect } from '@playwright/test';

test('parameter examples produce the same serialized browser request as the preview', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    'http://127.0.0.1:4174/gallery/api/gallery/v1/serializeparameters/',
  );
  await page.getByRole('button', { name: 'Try now', exact: true }).click();
  const playground = page.getByLabel('API playground');
  await expect(playground.getByLabel('payload parameter')).toHaveValue(
    '"hello world"',
  );
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('demo-token');
  const expected =
    '/v1/serialization/;color=blue;color=black?tags=a%2Cb,c%26d&payload=%22hello%20world%22';
  await expect(playground.locator('pre')).toContainText(expected);
  await expect(playground.locator('pre')).toContainText('X-Color: R=100,G=200');
  const result = page.waitForResponse(
    (response) => response.url() === `http://127.0.0.1:4010${expected}`,
  );
  await playground.getByRole('button', { name: 'Send request' }).click();
  expect((await result).status()).toBe(200);
  await expect(
    playground.locator('.response-content .code-block pre'),
  ).toContainText(expected);
  await expect(
    playground.locator('.response-content .code-block pre'),
  ).toContainText('R=100,G=200');
  expect(errors).toEqual([]);
});
