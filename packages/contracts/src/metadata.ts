import { guideHref, operationHref, normalizePagePath } from './index.js';
import type { SiteData } from './index.js';
export function pageMetadata(site: SiteData, inputPath: string) {
  const path = normalizePagePath(inputPath);
  const guide =
    site.guides.find((guide) => guideHref(guide) === path) ??
    (path === '/' ? site.guides[0] : undefined);
  const operation =
    site.apis
      .flatMap((api) => api.operations.map((operation) => ({ api, operation })))
      .find(({ api, operation }) => operationHref(api, operation) === path)
      ?.operation ??
    (path === '/' && !guide ? site.apis[0]?.operations[0] : undefined);
  const found = Boolean(guide || operation || path === '/');
  return {
    title:
      guide?.title ??
      operation?.summary ??
      (found ? site.config.name : 'Page not found'),
    description: (
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
