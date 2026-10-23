import type { Guide, SiteData } from './index.js';
import { guideHref } from './index.js';
import { localeRoute, localizePath } from './locale.js';

export function guidesForLocale(site: SiteData, locale: string): Guide[] {
  const translations = site.guideTranslations?.[locale];
  if (!translations?.length) return site.guides;
  const bySlug = new Map(translations.map((guide) => [guide.slug, guide]));
  return site.guides.map((guide) => bySlug.get(guide.slug) ?? guide);
}
export function pageContentLocale(site: SiteData, path: string): string {
  if (site.pagePath === path && site.contentLocale) return site.contentLocale;
  const { locale, contentPath } = localeRoute(site.config, path);
  if (
    locale === site.config.defaultLocale ||
    (contentPath !== '/' && !contentPath.startsWith('/guides/'))
  )
    return site.config.defaultLocale;
  const guide =
    site.guides.find((guide) => guideHref(guide) === contentPath) ??
    (contentPath === '/' ? site.guides[0] : undefined);
  return guide &&
    site.guideTranslations?.[locale]?.some((item) => item.slug === guide.slug)
    ? locale
    : site.config.defaultLocale;
}
export function guideAlternates(
  site: SiteData,
  path: string,
): { locale: string; href: string }[] {
  if (site.pagePath === path && site.pageTranslations)
    return site.pageTranslations;
  const { contentPath } = localeRoute(site.config, path);
  const guide =
    site.guides.find((guide) => guideHref(guide) === contentPath) ??
    (contentPath === '/' ? site.guides[0] : undefined);
  if (!guide) return [];
  const locales = site.config.locales.filter(
    (locale) =>
      locale === site.config.defaultLocale ||
      site.guideTranslations?.[locale]?.some(
        (item) => item.slug === guide.slug,
      ),
  );
  return locales.length > 1
    ? locales.map((locale) => ({
        locale,
        href: localizePath(site.config, contentPath, locale),
      }))
    : [];
}
/** Shared compiler/plugin boundary: bounded, unique variants of existing guide identities. */
export function validateGuideTranslations(site: SiteData): void {
  if (!site.guideTranslations) return;
  if (
    !Array.isArray(site.config.locales) ||
    typeof site.config.defaultLocale !== 'string'
  )
    throw new Error('Translated guides require valid locale configuration');
  const slugs = new Set(site.guides.map((guide) => guide.slug));
  let count = site.guides.length,
    bytes = site.guides.reduce(
      (sum, guide) => sum + (guide.sourceBytes ?? 0),
      0,
    );
  for (const [locale, guides] of Object.entries(site.guideTranslations ?? {})) {
    if (
      !site.config.locales.includes(locale) ||
      locale === site.config.defaultLocale
    )
      throw new Error(
        'Translated guides require a configured non-default locale',
      );
    const seen = new Set<string>();
    for (const guide of guides) {
      if (!slugs.has(guide.slug) || seen.has(guide.slug))
        throw new Error(
          'Translated guides must have unique slugs matching default-language guides',
        );
      seen.add(guide.slug);
      count++;
      bytes += guide.sourceBytes ?? 0;
    }
  }
  if (count > 10000 || bytes > 64 * 1024 * 1024)
    throw new Error(
      'Default and translated guides exceed their shared source budget',
    );
}
