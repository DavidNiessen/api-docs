import type { ProjectConfig } from './index.js';

type Locales = Pick<ProjectConfig, 'locales' | 'defaultLocale'>;
/** Resolve a route relative to the publication base path; this does not authorize routes. */
export function localeRoute(config: Locales, path: string) {
  const candidate = path.split('/')[1];
  const locale =
    candidate &&
    candidate !== config.defaultLocale &&
    config.locales.includes(candidate)
      ? candidate
      : config.defaultLocale;
  const prefix = locale === config.defaultLocale ? '' : '/' + locale;
  return {
    locale,
    prefix,
    contentPath: prefix ? path.slice(prefix.length) || '/' : path,
  };
}
/** Default-language URLs remain stable; alternate locales have an explicit prefix. */
export function localizePath(
  config: Locales,
  path: string,
  locale: string,
): string {
  if (!config.locales.includes(locale))
    throw new Error('Locale is not configured');
  if (
    !path.startsWith('/') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('\\') ||
    path.includes('//')
  )
    throw new Error(
      'Use a publication-relative page path without query or fragment',
    );
  const contentPath = localeRoute(config, path).contentPath;
  return (locale === config.defaultLocale ? '' : '/' + locale) + contentPath;
}
export function localePaths(config: Locales, path: string): string[] {
  return [
    config.defaultLocale,
    ...config.locales.filter((locale) => locale !== config.defaultLocale),
  ].map((locale) => localizePath(config, path, locale));
}
const languageNames: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
  fi: 'Suomi',
  da: 'Dansk',
  no: 'Norsk',
  cs: 'Čeština',
  tr: 'Türkçe',
  el: 'Ελληνικά',
  uk: 'Українська',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
  he: 'עברית',
};
/** Stable labels avoid server/browser ICU differences during hydration. */
export function localeName(locale: string): string {
  const [language, region] = locale.split('-');
  const name = languageNames[language!] ?? language!;
  return region ? `${name} (${region})` : name;
}
