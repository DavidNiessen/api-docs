import DOMPurify from 'dompurify';
import { guideHtmlPolicy } from './guide-html-policy.js';

export function sanitizeGuideHtml(html: string): string {
  return DOMPurify.sanitize(html, guideHtmlPolicy);
}
