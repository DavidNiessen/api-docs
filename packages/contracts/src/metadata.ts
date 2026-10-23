import { guideHref, operationHref, normalizePagePath } from './index.js';
import type { SiteData } from './index.js';
import { localeRoute } from './locale.js';
import { lifecycleContext } from './lifecycle-pages.js';
export function pageMetadata(site: SiteData, inputPath: string) {
  const path = normalizePagePath(inputPath);
  const { locale, contentPath } = localeRoute(site.config, path);
  const lifecycle =
    site.pagePath === path
      ? site.lifecycle?.page
      : contentPath.startsWith('/deprecations/')
        ? lifecycleContext(site, contentPath).page
        : undefined;
  const guide =
    site.guides.find((guide) => guideHref(guide) === contentPath) ??
    (contentPath === '/' ? site.guides[0] : undefined);
  const operation =
    site.apis
      .flatMap((api) => api.operations.map((operation) => ({ api, operation })))
      .find(
        ({ api, operation }) => operationHref(api, operation) === contentPath,
      )?.operation ??
    (contentPath === '/' && !guide ? site.apis[0]?.operations[0] : undefined);
  const found = Boolean(lifecycle || guide || operation || contentPath === '/');
  return {
    title:
      (lifecycle ? 'Deprecations' : undefined) ??
      guide?.title ??
      operation?.summary ??
      (found ? site.config.name : 'Page not found'),
    description: (
      (lifecycle
        ? 'Plan API migrations with retirement dates, replacement operations and migration guides.'
        : '') ||
      guide?.description ||
      operation?.description ||
      site.config.description
    )
      .replace(/\s+/g, ' ')
      .slice(0, 320),
    robots:
      found && site.config.seo?.index !== false
        ? locale === site.config.defaultLocale
          ? 'index,follow'
          : 'noindex,follow'
        : 'noindex,nofollow',
    ...(found && site.config.siteUrl
      ? { canonical: site.config.siteUrl + site.config.basePath + contentPath }
      : {}),
    ...(site.config.seo?.socialImage && site.config.siteUrl
      ? {
          image:
            site.config.siteUrl +
            site.config.basePath +
            '/media/' +
            site.config.seo.socialImage,
        }
      : {}),
  };
}
