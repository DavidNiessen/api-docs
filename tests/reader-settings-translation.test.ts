import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createUiTranslation } from '@api-docs/contracts';
import { parseConfig } from '@api-docs/spec';
import { UiContext } from '../apps/reader/src/ui-translation.js';
import { ReaderSettingsControls } from '../apps/reader/src/components/ReaderSettingsControls.js';
import ThemeEditor from '../apps/reader/src/components/ThemeEditor.js';
import { defaultReaderPreferences } from '../apps/reader/src/reader-preferences.js';

const config = parseConfig({
  name: 'Reader translation fixture',
  specs: [{ id: 'api', path: 'openapi.yaml' }],
  locales: ['en', 'de-DE'],
  i18n: {
    messages: {
      de: {
        'settings.region': 'Persönliche Einstellungen',
        'settings.apply': '{name} anwenden',
        'settings.editorColor': 'Farbe: {color}',
        'settings.editorContrast': 'Kontrast prüfen: {colors}.',
        'color.foreground': 'Vordergrund',
        'appearance.title': 'Leseeinstellungen',
        'appearance.color': 'Farbe {color} im Modus {mode}',
        'appearance.contrastIssue': '{foreground} auf {background}: {mode}',
        'appearance.radius': '{value}px Radius',
      },
      'de-DE': {
        'settings.unavailable': 'Speicher <nicht verfügbar>',
      },
    },
  },
});
const noop = () => {};
it('server-renders localized preferences, safe named themes and independent palette warnings with per-message fallback', () => {
  const value = defaultReaderPreferences();
  value.editorTheme = 'custom';
  value.editorColors.foreground = value.editorColors.background;
  value.savedThemes = [
    { name: '<img src=x onerror=alert(1)>', theme: config.theme },
  ];
  const controls = createElement(ReaderSettingsControls, {
    value,
    onChange: noop,
    theme: config.theme,
    stored: false,
  });
  const html = renderToStaticMarkup(
    createElement(
      UiContext.Provider,
      {
        value: createUiTranslation('de-DE', config.i18n),
      },
      controls,
    ),
  );
  expect(html).toContain('aria-label="Persönliche Einstellungen"');
  expect(html).toContain('Speicher &lt;nicht verfügbar&gt;');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt; anwenden');
  expect(html).not.toContain('<img');
  expect(html).toContain('aria-label="Farbe: Vordergrund"');
  expect(html).toContain('Kontrast prüfen: Vordergrund.');
  expect(html).toContain('Documentation layout');
  const english = renderToStaticMarkup(
    createElement(
      UiContext.Provider,
      {
        value: createUiTranslation('en', config.i18n),
      },
      controls,
    ),
  );
  expect(english).toContain('aria-label="Personal preferences"');
  expect(english).toContain('Editor contrast below 4.5:1: foreground.');
  expect(english).not.toContain('Persönliche Einstellungen');
});
it('server-renders translated theme dimensions and contrast context while preserving public configuration values', () => {
  const html = renderToStaticMarkup(
    createElement(
      UiContext.Provider,
      {
        value: createUiTranslation('de-DE', config.i18n),
      },
      createElement(ThemeEditor, {
        value: { ...config.theme, colors: { light: { text: '#ffffff' } } },
        mode: 'light',
        personal: true,
        onChange: noop,
        onModeChange: noop,
        onClose: noop,
        onReset: noop,
      }),
    ),
  );
  expect(html).toContain('Leseeinstellungen');
  expect(html).toContain('10px Radius');
  expect(html).toContain('aria-label="Farbe text im Modus light"');
  expect(html).toContain('text auf background: light');
  expect(html).toContain('value="comfortable"');
  expect(html).toContain('value="system"');
  expect(html).toContain('Improve contrast before exporting');
});
