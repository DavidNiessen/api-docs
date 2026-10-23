import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const root = 'http://127.0.0.1:4178/extensions';
test('reviewed ESM dependencies mount a footer, follow page changes and isolate a failing extension', async ({
  page,
}) => {
  const errors: string[] = [],
    warnings: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.goto(root + '/?api_key=not-for-sdk#private');
  const host = page.locator('.reader-extension-host');
  await expect(host).toContainText('Current page: Reader extension example');
  await expect
    .poll(() => warnings.some((text) => text.includes('unavailable-example')))
    .toBe(true);
  expect(warnings.join(' ')).not.toContain('Demonstration activation failure');
  await host
    .getByRole('link', { name: 'Read about extension lifecycle' })
    .click();
  await expect(page).toHaveURL(root + '/guides/next/');
  await expect(host).toContainText('Current page: Extension lifecycle');
  await expect(
    host.locator('[data-reader-extension="related-guides"]'),
  ).toHaveCount(1);
  await page.getByRole('link', { name: 'API Reference', exact: true }).click();
  await expect(host).toContainText('Current page: List projects');
  await page.getByRole('button', { name: 'Try now', exact: true }).click();
  await expect(page.getByLabel('Request URL', { exact: true })).toHaveText(
    'http://127.0.0.1:4010/v1/projects',
  );
  await page.keyboard.press('Escape');
  for (const mode of ['dark', 'light']) {
    await page.getByRole('button', { name: `Switch to ${mode} theme` }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.reader-extension-host')
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await host.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test('page teardown aborts extension context and disposes widgets and activation cleanup', async ({
  page,
}) => {
  await page.route('**/related-guides.mjs', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export default {id:'related-guides',version:'1.0.0',pluginApi:'1',capabilities:['page','footer'],activate(ctx){globalThis.extensionPage=ctx.getPage();globalThis.extensionAborted=false;ctx.signal.addEventListener('abort',()=>globalThis.extensionAborted=true);ctx.setFooter(()=>({element:document.createElement('p'),dispose:()=>globalThis.widgetDisposed=true}));return()=>globalThis.extensionDisposed=true;}};`,
    }),
  );
  await page.goto(root + '/?private=query#private');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as unknown as { extensionPage: unknown }).extensionPage,
      ),
    )
    .toMatchObject({ path: '/', locale: 'en', kind: 'guide' });
  const captured = await page.evaluate(
    () =>
      (globalThis as unknown as { extensionPage: Record<string, unknown> })
        .extensionPage,
  );
  expect(Object.keys(captured).sort()).toEqual([
    'kind',
    'locale',
    'path',
    'title',
  ]);
  expect(JSON.stringify(captured)).not.toContain('private');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const result = await page.evaluate(() => {
    const target = globalThis as unknown as {
      extensionAborted: boolean;
      widgetDisposed: boolean;
      extensionDisposed: boolean;
    };
    return {
      aborted: target.extensionAborted,
      widget: target.widgetDisposed,
      extension: target.extensionDisposed,
    };
  });
  expect(result).toEqual({ aborted: true, widget: true, extension: true });
});
for (const reason of ['deadline', 'pagehide'])
  test(`a pending module cannot activate after ${reason}`, async ({ page }) => {
    if (reason === 'deadline') await page.clock.install();
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => (release = resolve));
    let requested = 0;
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'warning') warnings.push(message.text());
    });
    await page.route('**/related-guides.mjs', async (route) => {
      requested++;
      await pending;
      await route
        .fulfill({
          contentType: 'text/javascript',
          body: `globalThis.lateModuleEvaluated=true;export default {id:'related-guides',version:'1.0.0',pluginApi:'1',capabilities:['page'],activate(){globalThis.staleExtensionActivated=true;}};`,
        })
        .catch(() => {});
    });
    try {
      await page.goto(root + '/');
      await expect.poll(() => requested).toBe(1);
      if (reason === 'deadline') {
        await page.clock.fastForward(5100);
        await expect
          .poll(() => warnings.some((text) => text.includes('related-guides')))
          .toBe(true);
      } else
        await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      release();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (globalThis as unknown as { lateModuleEvaluated?: boolean })
                .lateModuleEvaluated,
          ),
        )
        .toBe(true);
      expect(
        await page.evaluate(
          () =>
            (globalThis as unknown as { staleExtensionActivated?: boolean })
              .staleExtensionActivated,
        ),
      ).toBeUndefined();
      await page
        .getByRole('button', { name: 'Search documentation', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Search documentation', exact: true })
        .fill('lifecycle');
      await expect(page.locator('.search-results')).toContainText(
        'Extension lifecycle',
      );
    } finally {
      release();
    }
  });
test('documentation is readable without JavaScript and default readers load no extension runtime', async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const plain = await context.newPage();
    await plain.goto(root + '/');
    await expect(
      plain.getByRole('heading', {
        name: 'Reader extension example',
        exact: true,
      }),
    ).toBeVisible();
    await expect(plain.locator('.reader-extension-host')).toHaveCount(0);
  } finally {
    await context.close();
  }
  const loaded: string[] = [];
  page.on('request', (request) => {
    if (/ReaderExtensions|reader-extensions\//.test(request.url()))
      loaded.push(request.url());
  });
  await page.goto('http://127.0.0.1:4173/');
  await page
    .getByRole('button', { name: 'Search documentation', exact: true })
    .click();
  expect(loaded).toEqual([]);
});
