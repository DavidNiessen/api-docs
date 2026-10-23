import { describe, expect, it } from 'vitest';
import {
  defaultReaderPreferences,
  parseReaderPreferences,
  personalTheme,
  readerPreferencesKey,
  editorContrastIssues,
} from '../apps/reader/src/reader-preferences.js';

const theme = {
  accent: '#7c3aed',
  radius: 12,
  font: 'serif',
  codeTheme: 'light',
  density: 'compact',
  colors: { dark: { background: '#111122', text: '#eeeeff' } },
  sidebarWidth: 300,
  contentWidth: 800,
};
describe('personal reader preferences', () => {
  it.each([
    null,
    '',
    '{',
    'null',
    '[]',
    JSON.stringify({ version: 2, mode: 'dark' }),
    ' '.repeat(65537),
  ])('ignores corrupt, unsupported or excessive storage %s', (source) => {
    expect(parseReaderPreferences(source)).toEqual(defaultReaderPreferences());
  });
  it('restores bounded themes, editor tokens and layout without mutating defaults', () => {
    const source = {
      ...defaultReaderPreferences(),
      mode: 'dark',
      layout: 'classic',
      editorTheme: 'custom',
      theme,
      savedThemes: [{ name: '  My palette  ', theme }],
    };
    const value = parseReaderPreferences(JSON.stringify(source));
    expect(value).toMatchObject({
      mode: 'dark',
      layout: 'classic',
      editorTheme: 'custom',
      theme,
      savedThemes: [{ name: 'My palette', theme }],
    });
    value.editorColors.background = '#ffffff';
    expect(defaultReaderPreferences().editorColors.background).toBe('#101820');
    expect(
      parseReaderPreferences(JSON.stringify(source)).editorColors.background,
    ).toBe('#101820');
  });
  it('drops arbitrary stylesheet paths, CSS, invalid dimensions and unknown palette tokens', () => {
    expect(
      personalTheme({
        ...theme,
        stylesheet: 'https://invalid.example/theme.css',
        font: 'url(secret)',
        radius: Infinity,
      }),
    ).toBeUndefined();
    const result = personalTheme({
      ...theme,
      stylesheet: 'theme.css',
      font: 'url(secret)',
      sidebarWidth: 1e9,
      colors: {
        dark: {
          background: 'url(secret)',
          text: '#ffffff',
          other: 'arbitrary',
        },
      },
    });
    expect(result).toMatchObject({
      font: 'system',
      colors: { dark: { text: '#ffffff' } },
    });
    expect(result).not.toHaveProperty('stylesheet');
    expect(result).not.toHaveProperty('sidebarWidth');
    expect(result!.colors!.dark).not.toHaveProperty('other');
    expect(result!.colors!.dark).not.toHaveProperty('background');
  });
  it('falls back per invalid field and retains independent valid choices', () => {
    const result = parseReaderPreferences(
      JSON.stringify({
        version: 1,
        mode: 'injected',
        layout: 'classic',
        editorTheme: 'injected',
        editorColors: { foreground: 'red', background: '#abcdef' },
        theme: { accent: 'red', radius: 10 },
      }),
    );
    expect(result).toMatchObject({
      mode: 'system',
      layout: 'classic',
      editorTheme: 'auto',
      editorColors: { foreground: '#e4edf5', background: '#abcdef' },
    });
    expect(result.theme).toBeUndefined();
  });
  it('bounds and deduplicates saved themes', () => {
    const result = parseReaderPreferences(
      JSON.stringify({
        version: 1,
        savedThemes: [
          { name: 'a', theme },
          { name: 'a', theme },
          { name: ' ', theme },
          { name: 'invalid', theme: {} },
          ...Array.from({ length: 20 }, (_, index) => ({
            name: 'name' + index,
            theme,
          })),
        ],
      }),
    );
    expect(result.savedThemes).toHaveLength(5);
    expect(result.savedThemes.map((item) => item.name)).toEqual([
      'a',
      'name0',
      'name1',
      'name2',
      'name3',
    ]);
  });
  it('warns about unreadable custom editor tokens and scopes storage by project mount', () => {
    const defaults = defaultReaderPreferences();
    expect(editorContrastIssues(defaults.editorColors)).toEqual([]);
    expect(
      editorContrastIssues({
        ...defaults.editorColors,
        foreground: defaults.editorColors.background,
      }),
    ).toEqual(['foreground']);
    expect(readerPreferencesKey('')).toBe(readerPreferencesKey('/'));
    expect(readerPreferencesKey('/first')).not.toBe(
      readerPreferencesKey('/second'),
    );
  });
});
