import type { ProjectConfig } from './index.js';

/** A configured issue destination is public artifact data; never include credentials. */
export function safeFeedbackUrl(value: string): boolean {
  if (
    value.length > 2048 ||
    value !== value.trim() ||
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Optional issue context uses the configured public origin and path, never browser query/hash/state. */
export function feedbackHref(
  config: ProjectConfig,
  pagePath: string,
): string | undefined {
  const feedback = config.feedback;
  if (!feedback || !safeFeedbackUrl(feedback.url)) return undefined;
  const destination = new URL(feedback.url);
  if (
    feedback.includePage &&
    config.siteUrl &&
    safeFeedbackUrl(config.siteUrl)
  ) {
    const path = pagePath.split(/[?#]/, 1)[0]!;
    if (
      path.length <= 2048 &&
      /^\/[a-zA-Z0-9_/-]*$/.test(path) &&
      !path.includes('//')
    ) {
      const page = new URL(config.siteUrl);
      page.pathname = config.basePath + path;
      page.search = '';
      page.hash = '';
      const body = destination.searchParams.get('body');
      destination.searchParams.set(
        'body',
        [body, `Documentation page: ${page.href}`].filter(Boolean).join('\n\n'),
      );
      if (destination.href.length > 4096) return feedback.url;
    }
  }
  return destination.href;
}
