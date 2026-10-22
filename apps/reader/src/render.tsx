import { renderToString } from 'react-dom/server';
import { App } from './components/App.js';
import type { SiteData } from '@api-docs/contracts';
export function renderDocument(
  site: SiteData,
  path: string,
  options: { status?: number; title?: string } = {},
): string {
  const encoded = JSON.stringify(site)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const markup = renderToString(<App site={site} initialPath={path} />);
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
