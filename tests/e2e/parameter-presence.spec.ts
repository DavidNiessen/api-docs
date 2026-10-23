import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const route =
  'http://127.0.0.1:4174/gallery/api/gallery/v1/parameterpresence/?playground=open';

test('optional inclusion preserves omitted drafts and the URL preview matches empty query/header wire values', async ({
  page,
}) => {
  await page.goto(route);
  const playground = page.getByLabel('API playground');
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('demo-token');
  await expect(
    playground.getByRole('checkbox', {
      name: 'Allow empty value: query requiredBlank',
      exact: true,
    }),
  ).toBeChecked();
  const query = playground.getByRole('textbox', {
    name: 'trace query parameter',
    exact: true,
  });
  const header = playground.getByRole('textbox', {
    name: 'trace header parameter',
    exact: true,
  });
  await expect(query).toBeVisible();
  await expect(header).toBeVisible();
  await query.fill('private query draft');
  await playground
    .getByRole('checkbox', {
      name: 'Include in request: query trace',
      exact: true,
    })
    .uncheck();
  await header.fill('header value');
  await playground
    .getByRole('textbox', { name: 'filters parameter', exact: true })
    .fill('{private invalid draft');
  await playground
    .getByRole('checkbox', {
      name: 'Include in request: query filters',
      exact: true,
    })
    .uncheck();
  await expect(query).toHaveValue('private query draft');
  await playground.locator('.playground-request-example > summary').click();
  await expect(
    playground.locator('.playground-request-example pre'),
  ).not.toContainText('private');
  const first = page.waitForResponse(
    (response) =>
      response.url().includes('/v1/presence/') &&
      response.request().method() === 'GET',
  );
  await playground.getByRole('button', { name: 'Send request' }).click();
  expect(await (await first).json()).toEqual({
    url: '/v1/presence/example?requiredBlank=',
    trace: 'header value',
  });
  await query.fill('');
  await playground
    .getByRole('checkbox', {
      name: 'Include in request: query trace',
      exact: true,
    })
    .check();
  await header.fill('');
  await playground
    .getByRole('checkbox', {
      name: 'Include in request: header trace',
      exact: true,
    })
    .check();
  const target =
    'http://127.0.0.1:4010/v1/presence/example?requiredBlank=&trace=';
  await expect(
    playground.getByLabel('Request URL', { exact: true }),
  ).toHaveText(target);
  await expect(
    playground.locator('.playground-request-example pre'),
  ).toContainText("--header 'trace;'");
  await expect(
    playground.locator('.playground-request-example pre'),
  ).toContainText(target);
  const next = page.waitForResponse((response) => response.url() === target);
  await playground.getByRole('button', { name: 'Send request' }).click();
  expect(await (await next).json()).toEqual({
    url: '/v1/presence/example?requiredBlank=&trace=',
    trace: '',
  });
  await playground
    .getByRole('checkbox', {
      name: 'Include in request: header trace',
      exact: true,
    })
    .uncheck();
  await playground
    .getByRole('checkbox', {
      name: 'Allow empty value: query requiredBlank',
      exact: true,
    })
    .uncheck();
  await expect(
    playground.getByRole('button', { name: 'Send request' }),
  ).toBeDisabled();
  await expect(playground.locator('.playground-request-example')).toContainText(
    'requiredBlank is required',
  );
  await expect(
    playground.getByLabel('Request URL', { exact: true }),
  ).toContainText('Complete');
});

test('empty paths require explicit intent and drafts stay private across themes and compact layouts', async ({
  page,
}) => {
  await page.goto(route);
  const playground = page.getByLabel('API playground');
  await playground
    .getByLabel('bearer credential', { exact: true })
    .fill('demo-token');
  await playground
    .getByRole('textbox', { name: 'id parameter', exact: true })
    .fill('');
  await expect(
    playground.getByLabel('Request URL', { exact: true }),
  ).toContainText('Complete');
  await playground
    .getByRole('checkbox', { name: 'Allow empty value: path id', exact: true })
    .check();
  const target = 'http://127.0.0.1:4010/v1/presence/?requiredBlank=';
  await expect(
    playground.getByLabel('Request URL', { exact: true }),
  ).toHaveText(target);
  const sent = page.waitForResponse((response) => response.url() === target);
  await playground.getByRole('button', { name: 'Send request' }).click();
  expect(await (await sent).json()).toEqual({
    url: '/v1/presence/?requiredBlank=',
    trace: null,
  });
  expect(
    (await new AxeBuilder({ page }).include('.playground-dialog').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Try now', exact: true }).click();
  expect(
    await playground.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  expect(
    (await new AxeBuilder({ page }).include('.playground-dialog').analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'private',
  );
});
