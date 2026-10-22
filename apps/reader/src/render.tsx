import { renderToString } from 'react-dom/server';
import { App } from './components/App.js';
import { createPageData } from '@api-docs/contracts';
import type { SiteData } from '@api-docs/contracts';
export function renderDocument(
  site: SiteData,
  path: string,
  options: { status?: number; title?: string } = {},
): string {
  const page = createPageData(site, path);
  const encoded = JSON.stringify(page).replace(
    /[<\u2028\u2029]/g,
    (char) =>
      String.fromCharCode(92) +
      'u' +
      char.charCodeAt(0).toString(16).padStart(4, '0'),
  );
  const markup = renderToString(<App site={page} initialPath={path} />);
  const escape = (value: string): string =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char] ?? char,
    );
  return `<!doctype html><html lang="${escape(site.config.defaultLocale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="description" content="${escape(site.config.description)}"><meta name="generator" content="api-docs 0.1.0"><title>${escape(options.title ?? site.config.name)} · Documentation</title><link rel="stylesheet" href="${site.config.basePath}/assets/reader.css"></head><body><div id="root">${markup}</div><script type="application/json" id="docs-data">${encoded}</script><script type="module" src="${site.config.basePath}/assets/reader.js"></script></body></html>`;
}
