import type { Config } from 'dompurify';

export const guideHtmlPolicy: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: [
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'link',
    'meta',
    'script',
  ],
  FORBID_ATTR: ['style'],
};
