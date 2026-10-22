import { guideHref, operationHref, normalizePagePath } from './index.js';
import type { SiteData } from './index.js';
import { lifecycleContext } from './lifecycle-pages.js';
export function pageMetadata(site: SiteData, inputPath: string) {
  const path = normalizePagePath(inputPath);
  const lifecycle =
    site.pagePath === path
      ? site.lifecycle?.page
      : path.startsWith('/deprecations/')
        ? lifecycleContext(site, path).page
        : undefined;
  const guide =
    site.guides.find((guide) => guideHref(guide) === path) ??
    (path === '/' ? site.guides[0] : undefined);
  const operation =
    site.apis
      .flatMap((api) => api.operations.map((operation) => ({ api, operation })))
      .find(({ api, operation }) => operationHref(api, operation) === path)
      ?.operation ??
    (path === '/' && !guide ? site.apis[0]?.operations[0] : undefined);
  const found = Boolean(lifecycle || guide || operation || path === '/');
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
        ? 'index,follow'
        : 'noindex,nofollow',
    ...(found && site.config.siteUrl
      ? { canonical: site.config.siteUrl + site.config.basePath + path }
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
