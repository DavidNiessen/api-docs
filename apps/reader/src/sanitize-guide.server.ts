import createDOMPurify from 'dompurify';
import { createRequire } from 'node:module';
import { guideHtmlPolicy } from './guide-html-policy.js';

// Load the server DOM only for authored HTML; API-only rendering needs no DOM.
// Reuse one isolated DOM per process, with no global window or network resources.
const require = createRequire(import.meta.url);
let purifier: ReturnType<typeof createDOMPurify> | undefined;
export function sanitizeGuideHtml(html: string): string {
  if (!purifier) {
    const { JSDOM } = require('jsdom') as typeof import('jsdom');
    purifier = createDOMPurify(new JSDOM('').window);
  }
  return purifier.sanitize(html, guideHtmlPolicy);
}
