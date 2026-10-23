import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const route = 'http://127.0.0.1:4174/gallery/';
const label = 'Report documentation issue';

test('configured feedback follows SPA routes and excludes browser/playground state', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'issues.example.test')
      external.push(request.url());
  });
  await page.goto(route + '?token=browser-secret#private-fragment');
  const feedback = page.getByRole('link', {
    name: label + ' (opens in a new tab)',
  });
  await expect(feedback).toBeVisible();
  const initial = new URL((await feedback.getAttribute('href'))!);
  expect(initial.searchParams.get('template')).toBe('docs');
  expect(initial.searchParams.get('body')).toBe(
    'Documentation issue\n\nDocumentation page: https://docs.example.test/gallery/',
  );
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(feedback).toHaveAttribute('referrerpolicy', 'no-referrer');
  await page
    .getByRole('link')
    .filter({ hasText: 'Upload documents' })
    .first()
    .click();
  await expect(
    page.getByRole('heading', { name: 'Upload documents', exact: true }),
  ).toBeVisible();
  await expect(feedback).toHaveAttribute('href', /uploaddocuments%2F/);
  await page.getByRole('button', { name: 'Try this endpoint' }).click();
  await page
    .getByLabel('API playground')
    .getByLabel('bearer credential', { exact: true })
    .fill('playground-secret');
  await page.getByRole('button', { name: 'Close playground' }).click();
  const destination = (await feedback.getAttribute('href'))!;
  for (const value of [
    'browser-secret',
    'private-fragment',
    'playground-secret',
    'playground%3Dopen',
  ])
    expect(destination).not.toContain(value);
  expect(external).toEqual([]);
  await feedback.focus();
  await expect(feedback).toBeFocused();
  const popupPromise = page.waitForEvent('popup');
  await page.context().route('https://issues.example.test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Issue fixture</title><p>Describe the problem</p>',
    }),
  );
  await feedback.press('Enter');
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toBe(destination);
  await popup.close();
});

test('feedback is prerendered without JavaScript and remains accessible in both themes on mobile', async ({
  page,
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(route);
  await expect(
    staticPage.getByRole('link', { name: label + ' (opens in a new tab)' }),
  ).toBeVisible();
  await context.close();
  await page.goto(route);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['light', 'dark']) {
    if (mode === 'dark')
      await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    const feedback = page.getByRole('link', {
      name: label + ' (opens in a new tab)',
    });
    await feedback.scrollIntoViewIfNeeded();
    await expect(feedback).toBeVisible();
    expect(
      await page
        .locator('.article-footer')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('link', { name: /Report.*issue/ })).toHaveCount(
    0,
  );
});
