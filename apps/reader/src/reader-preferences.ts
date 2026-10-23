import { contrastRatio, themePresets } from '@api-docs/contracts';
import type { Palette, Theme } from '@api-docs/contracts';

export interface EditorPalette {
  background: string;
  foreground: string;
  key: string;
  string: string;
  number: string;
  keyword: string;
}
export interface ReaderPreferences {
  version: 1;
  mode: 'system' | 'light' | 'dark';
  layout: 'modern' | 'classic';
  editorTheme: 'auto' | 'light' | 'dark' | 'contrast' | 'custom';
  editorColors: EditorPalette;
  theme?: Theme | undefined;
  savedThemes: { name: string; theme: Theme }[];
}
export const defaultEditorColors: EditorPalette = {
  background: '#101820',
  foreground: '#e4edf5',
  key: '#8ad9ff',
  string: '#a8e6bb',
  number: '#f5ce8b',
  keyword: '#d6b5ff',
};
export function defaultReaderPreferences(): ReaderPreferences {
  return {
    version: 1,
    mode: 'system',
    layout: 'modern',
    editorTheme: 'auto',
    editorColors: { ...defaultEditorColors },
    savedThemes: [],
  };
}
export const readerPreferencesKey = (basePath: string) =>
  'api-docs:reader-settings:v1:' + (basePath || '/');
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const color = (value: unknown): value is string =>
  typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value);
const number = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;
const choice = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** Local preferences accept only bounded tokens; arbitrary CSS and URLs are never restored. */
export function personalTheme(value: unknown): Theme | undefined {
  if (!record(value) || !color(value.accent) || !number(value.radius, 0, 24))
    return undefined;
  const theme: Theme = {
    accent: value.accent,
    radius: value.radius,
    font: choice(value.font, ['system', 'sans', 'serif'], 'system'),
    density: choice(value.density, ['comfortable', 'compact'], 'comfortable'),
    codeTheme: choice(value.codeTheme, ['light', 'dark'], 'dark'),
  };
  if (
    typeof value.preset === 'string' &&
    Object.hasOwn(themePresets, value.preset)
  )
    theme.preset = value.preset as NonNullable<Theme['preset']>;
  if (number(value.sidebarWidth, 220, 320))
    theme.sidebarWidth = value.sidebarWidth;
  if (number(value.contentWidth, 600, 960))
    theme.contentWidth = value.contentWidth;
  if (record(value.colors)) {
    theme.colors = {};
    for (const mode of ['light', 'dark'] as const) {
      const source = value.colors[mode];
      if (!record(source)) continue;
      const palette: Partial<Palette> = {};
      for (const key of [
        'background',
        'surface',
        'subtle',
        'border',
        'text',
        'muted',
        'heading',
      ] as const)
        if (color(source[key])) palette[key] = source[key];
      theme.colors[mode] = palette;
    }
  }
  return theme;
}
export function parseReaderPreferences(
  source: string | null,
): ReaderPreferences {
  const result = defaultReaderPreferences();
  if (!source || source.length > 65536) return result;
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return result;
  }
  if (!record(data) || data.version !== 1) return result;
  result.mode = choice(data.mode, ['system', 'light', 'dark'], 'system');
  result.layout = choice(data.layout, ['modern', 'classic'], 'modern');
  result.editorTheme = choice(
    data.editorTheme,
    ['auto', 'light', 'dark', 'contrast', 'custom'],
    'auto',
  );
  if (record(data.editorColors))
    for (const key of Object.keys(
      result.editorColors,
    ) as (keyof EditorPalette)[])
      if (color(data.editorColors[key]))
        result.editorColors[key] = data.editorColors[key];
  result.theme = personalTheme(data.theme);
  if (Array.isArray(data.savedThemes))
    for (const saved of data.savedThemes.slice(0, 8)) {
      if (!record(saved) || typeof saved.name !== 'string') continue;
      const theme = personalTheme(saved.theme),
        name = saved.name.trim().slice(0, 40);
      if (
        theme &&
        name &&
        !result.savedThemes.some((entry) => entry.name === name)
      )
        result.savedThemes.push({ name, theme });
    }
  return result;
}
export function editorContrastIssues(colors: EditorPalette): string[] {
  return (Object.keys(colors) as (keyof EditorPalette)[]).filter(
    (key) =>
      key !== 'background' &&
      contrastRatio(colors[key], colors.background) < 4.5,
  );
}
