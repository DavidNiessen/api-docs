import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { parseConfig } from '@api-docs/spec';
test('appearance preview validates contrast and copies portable theme configuration', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem('copied-theme', value);
        },
      },
    });
  });
  await page.goto('http://127.0.0.1:4174/gallery/guides/components/');
  await expect(
    page.getByRole('button', { name: 'Customize appearance' }),
  ).toHaveCount(0);
  await page.goto(
    'http://127.0.0.1:4174/gallery/guides/components/?theme-editor=1',
  );
  await page.getByRole('button', { name: 'Customize appearance' }).click();
  const editor = page.getByRole('dialog', { name: 'Make it yours' });
  await expect(editor).toBeVisible();
  await editor
    .getByRole('combobox', { name: 'Preset', exact: true })
    .selectOption('ocean');
  await expect(page.locator('.docs-shell')).toHaveCSS('--accent', '#2563eb');
  await editor.getByRole('slider', { name: /Corner radius:/ }).focus();
  await page.keyboard.press('ArrowRight');
  const text = editor.getByLabel('light text color', { exact: true });
  const setColor = async (color: string) =>
    text.evaluate((input, color) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, color);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, color);
  await setColor('#ffffff');
  await expect(editor.getByRole('alert')).toContainText('Improve contrast');
  await expect(
    editor.getByRole('button', { name: 'Copy theme configuration' }),
  ).toBeDisabled();
  await setColor('#202a35');
  await editor
    .getByRole('button', { name: 'Copy theme configuration' })
    .click();
  const copied = JSON.parse(
    (await page.evaluate(() => sessionStorage.getItem('copied-theme')))!,
  );
  expect(Object.keys(copied)).toEqual(['theme']);
  const config = parseConfig({
    name: 'Theme test',
    specs: [{ id: 'api', path: 'openapi.yaml' }],
    ...copied,
  });
  expect(config.theme).toMatchObject({ preset: 'ocean', radius: 11 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
  });
  await editor
    .getByRole('button', { name: 'Copy theme configuration' })
    .click();
  await expect(editor.getByRole('status')).toContainText([
    'Reading colors meet',
    'Clipboard access is unavailable',
  ]);
  await editor
    .getByRole('combobox', { name: 'Preview mode', exact: true })
    .selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    accessibility.violations.filter((value) =>
      ['serious', 'critical'].includes(value.impact ?? ''),
    ),
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
  await expect(page.locator('.docs-shell')).toHaveCSS('--accent', '#2563eb');
  await page.reload();
  await expect(page.locator('.docs-shell')).toHaveCSS('--accent', '#7c3aed');
  expect(errors).toEqual([]);
});
