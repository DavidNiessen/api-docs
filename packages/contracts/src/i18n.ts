/** Stable reader message IDs. Values are plain text with named placeholders. */
export const defaultUiMessages = Object.freeze({
  'locale.content': 'Page content: {language}',
  'locale.choose': 'Documentation language',
  'locale.coverage':
    '{translated} of {total} core UI labels translated. Other labels use English.',
  'locale.fallback':
    'Documentation content is shown in {language}. UI language: {locale}.',
  'navigation.loading': 'Loading documentation…',
  'navigation.skip': 'Skip to content',
  'navigation.docs': 'Documentation',
  'navigation.api': 'API Reference',
  'navigation.deprecations': 'Deprecations',
  'navigation.sections': 'Documentation sections',
  'navigation.sidebar': 'Documentation navigation',
  'navigation.toggle': 'Toggle navigation',
  'navigation.version': 'API version',
  'navigation.resources': 'Developer resources',
  'navigation.builtFor': 'Built for developers',
  'navigation.searchAll': 'Search all {count} pages',
  'navigation.onPage': 'On this page',
  'navigation.continue': 'Continue reading',
  'navigation.notFound': 'Page not found',
  'navigation.notFoundHelp':
    'This page may have moved. Try search or return to the documentation.',
  'navigation.back': 'Back to documentation',
  'search.label': 'Search documentation',
  'search.placeholder': 'Search documentation…',
  'search.close': 'Close search',
  'search.content': 'Content',
  'search.type': 'Search content type',
  'search.allContent': 'All content',
  'search.guides': 'Guides',
  'search.endpoints': 'API endpoints',
  'search.version': 'Search API version',
  'search.allVersions': 'All versions',
  'search.loading': 'Loading search…',
  'search.empty': 'No matching results',
  'search.emptyHelp': 'Try a different term, endpoint, or parameter name.',
  'search.start': 'What would you like to build?',
  'search.startHelp': 'Search guides, endpoints, and parameters.',
  'search.privacy': 'Local search · Your queries stay in your browser',
  'theme.light': 'Switch to light theme',
  'theme.dark': 'Switch to dark theme',
  'theme.customize': 'Customize appearance',
  'theme.customizeShort': 'Customize',
  'credentials.forget': 'Forget saved API credentials',
  'playground.try': 'Try now',
  'playground.tryEndpoint': 'Try this endpoint',
  'playground.dialog': '{title} playground',
  'playground.label': 'API playground',
  'playground.close': 'Close playground',
  'playground.requestUrl': 'Request URL',
  'playground.copyUrl': 'Copy request URL',
  'playground.incompleteUrl': 'Complete the server and request parameters',
  'playground.sendLabel': 'Send request',
  'playground.send': 'Send',
  'playground.sending': 'Sending…',
  'playground.cancel': 'Cancel',
  'playground.confirm': 'Send {method} to {origin}? This may modify data.',
  'response.region': 'API response',
  'response.title': 'Response',
  'response.body': 'Response body',
  'response.empty': 'Your response will appear here',
  'response.emptyHelp': 'Send a request to try this endpoint.',
  'response.loading': 'Loading response editor…',
  'response.headers': 'Response headers',
  'response.copy': 'Copy entire response',
  'response.fullscreen': 'View response fullscreen',
  'response.exitFullscreen': 'Exit response fullscreen',
  'layout.navigationControls': 'Navigation layout controls',
  'layout.navigation': 'Resize navigation',
  'layout.inspector': 'Resize inspector',
  'layout.playground': 'Resize request and response panels',
  'layout.preferredWidth': 'Preferred width: {width} pixels',
  'layout.resizeHint':
    'Drag or use arrow keys to resize. Shift changes faster. Double-click to reset.',
  'response.collapse': 'Collapse all',
  'response.expand': 'Expand all',
  'response.unavailable':
    'The editor is unavailable. The full response is shown below.',
  'copy.success': 'Copied',
  'copy.unavailable': 'Clipboard unavailable. Select and copy the text.',
  'footer.source': 'Source:',
  'footer.feedback': 'Report an issue',
  'footer.newTab': ' (opens in a new tab)',
  'footer.builtWith': 'Built with api-docs',
} as const);
export type UiMessageKey = keyof typeof defaultUiMessages;
export type UiMessages = Partial<Record<UiMessageKey, string>>;
export interface UiConfiguration {
  guides?: Record<string, string>;
  messages: Record<string, UiMessages>;
}
type Names<Text extends string> =
  Text extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Names<Rest>
    : never;
type Values<Key extends UiMessageKey> = [
  Names<(typeof defaultUiMessages)[Key]>,
] extends [never]
  ? []
  : [Record<Names<(typeof defaultUiMessages)[Key]>, string | number>];
export type UiText = <Key extends UiMessageKey>(
  key: Key,
  ...values: Values<Key>
) => string;
export interface UiTranslation {
  locale: string;
  translated: number;
  fallback: number;
  total: number;
  text: UiText;
}
const names = (value: string) =>
  [
    ...new Set(
      [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(
        (match) => match[1]!,
      ),
    ),
  ].sort();
/** Match the named parameters so translated labels retain required context. */
export function validUiMessage(key: UiMessageKey, value: string): boolean {
  return (
    value.trim().length > 0 &&
    value.length <= 512 &&
    !Array.from(value).some((char) => {
      const code = char.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    }) &&
    JSON.stringify(names(defaultUiMessages[key])) ===
      JSON.stringify(names(value))
  );
}
/** No browser detection, storage, HTML, evaluation or network requests. */
export function createUiTranslation(
  locale: string,
  configuration?: UiConfiguration,
): UiTranslation {
  const base = locale.split('-')[0]!;
  const messages: UiMessages = {};
  for (const key of Object.keys(defaultUiMessages) as UiMessageKey[])
    for (const language of [base, locale]) {
      const catalog = configuration?.messages[language];
      const candidate =
        catalog && Object.hasOwn(catalog, key) ? catalog[key] : undefined;
      if (typeof candidate === 'string' && validUiMessage(key, candidate))
        messages[key] = candidate;
    }
  const translated =
    base === 'en'
      ? Object.keys(defaultUiMessages).length
      : Object.keys(messages).length;
  function text<Key extends UiMessageKey>(
    key: Key,
    ...values: Values<Key>
  ): string {
    const value = messages[key] ?? defaultUiMessages[key];
    const parameters = values[0] as Record<string, string | number> | undefined;
    return value.replace(
      /\{([A-Za-z][A-Za-z0-9]*)\}/g,
      (literal, name: string) =>
        parameters && Object.hasOwn(parameters, name)
          ? String(parameters[name])
          : literal,
    );
  }
  return {
    locale,
    translated,
    fallback: Object.keys(defaultUiMessages).length - translated,
    total: Object.keys(defaultUiMessages).length,
    text,
  };
}
