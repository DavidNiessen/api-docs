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
  'navigation.all': 'All',
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
  'theme.settings': 'Open reader settings',
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
  'playground.mockSend': 'Send mock',
  'playground.mockSendLabel': 'Send mock request',
  'playground.mockNote':
    'Demo mode: responses are generated locally from the specification. No API requests are sent, credentials are not needed, and changes are not saved.',
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
  'settings.region': 'Personal preferences',
  'settings.saved':
    'Saved in this browser for this documentation site. Your settings do not change the published project.',
  'settings.unavailable':
    'Browser storage is unavailable. Settings work for this visit.',
  'settings.mode': 'Appearance mode',
  'settings.system': 'Use system setting',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.layout': 'Documentation layout',
  'settings.modern': 'Modern islands',
  'settings.classic': 'Classic API reference',
  'settings.editorTheme': 'Response editor theme',
  'settings.follow': 'Follow appearance',
  'settings.contrast': 'High contrast',
  'settings.custom': 'Custom palette',
  'settings.layoutHelp':
    'Modern islands have resizable navigation and inspectors. Classic groups collapsed, method-colored endpoints in the main reference page.',
  'settings.editorPalette': 'Custom editor palette',
  'settings.editorColor': 'Editor {color} color',
  'settings.editorPreview': 'Editor palette preview',
  'settings.editorContrast': 'Editor contrast below 4.5:1: {colors}.',
  'settings.savedThemes': 'Saved custom themes',
  'settings.name': 'Theme name',
  'settings.defaultName': 'My theme',
  'settings.save': 'Save current theme',
  'settings.apply': 'Apply {name}',
  'settings.deleteLabel': 'Delete theme {name}',
  'settings.delete': 'Delete',
  'settings.saveHelp':
    'Save up to eight palettes, typography, density and width presets. Saving an existing name replaces it.',
  'appearance.workspace': 'Your workspace',
  'appearance.preview': 'Live preview',
  'appearance.title': 'Reader settings',
  'appearance.previewTitle': 'Make it yours',
  'appearance.close': 'Close reader settings',
  'appearance.closePreview': 'Close appearance editor',
  'appearance.help':
    'Customize your reading theme. Changes apply immediately; use the palette controls to refine either appearance mode.',
  'appearance.previewHelp':
    'Preview your brand across the documentation. Copy the theme section when it is ready.',
  'appearance.preset': 'Preset',
  'appearance.paletteMode': 'Palette mode',
  'appearance.previewMode': 'Preview mode',
  'appearance.accent': 'Accent',
  'appearance.density': 'Density',
  'appearance.comfortable': 'Comfortable',
  'appearance.compact': 'Compact',
  'appearance.typography': 'Typography',
  'appearance.system': 'System',
  'appearance.sans': 'Sans serif',
  'appearance.serif': 'Serif',
  'appearance.code': 'Code blocks',
  'appearance.radius': 'Corner radius: {value}px',
  'appearance.sidebarWidth': 'Sidebar width: {value}px',
  'appearance.readingWidth': 'Reading width: {value}px',
  'appearance.palette': '{mode} palette',
  'appearance.color': '{mode} {color} color',
  'appearance.contrastIssue':
    '{mode}: {foreground} needs more contrast against {background}.',
  'appearance.improveContrast': 'Improve contrast before exporting',
  'appearance.moreContrast':
    '{count} additional contrast checks need attention.',
  'appearance.validContrast': 'Reading colors meet the 4.5:1 contrast checks.',
  'appearance.copy': 'Copy theme configuration',
  'appearance.copied':
    'Theme copied. Merge its theme section into your project configuration.',
  'appearance.clipboardUnavailable':
    'Clipboard access is unavailable. Review your browser permissions.',
  'appearance.restored': 'Published theme restored.',
  'appearance.restore': 'Use published theme',
  'appearance.reset': 'Reset',
  'color.light': 'light',
  'color.dark': 'dark',
  'color.background': 'background',
  'color.surface': 'surface',
  'color.subtle': 'subtle',
  'color.border': 'border',
  'color.text': 'text',
  'color.muted': 'muted',
  'color.heading': 'heading',
  'color.foreground': 'foreground',
  'color.key': 'key',
  'color.string': 'string',
  'color.number': 'number',
  'color.keyword': 'keyword',
  'classic.region': 'API endpoint reference',
  'classic.help':
    'Expand an endpoint to read its parameters, schemas and responses, or try a request.',
  'classic.count': '{count} endpoints',
  'classic.page': 'Page {page} of {pages}',
  'classic.empty': 'No endpoints',
  'classic.previous': 'Previous endpoints',
  'classic.next': 'Next endpoints',
  'classic.loading': 'Loading endpoints…',
  'classic.listError':
    'The endpoint list could not be loaded. Retry or use documentation search.',
  'classic.pageError': 'This endpoint page could not be loaded.',
  'classic.retry': 'Retry endpoint list',
  'classic.deprecated': 'Deprecated',
  'classic.detailsLoading': 'Loading endpoint details…',
  'classic.detailsError': 'Endpoint details could not be loaded.',
  'classic.detailsRetry': 'Retry endpoint details',
  'classic.permalink': 'Endpoint permalink',
  'schema.anyValue': 'any value',
  'schema.noValue': 'no value allowed',
  'schema.reference': 'reference',
  'schema.oneOfType': 'one of',
  'schema.anyOfType': 'any of',
  'schema.allOfType': 'all of',
  'schema.anyType': 'any',
  'schema.allowed': 'Allowed values:',
  'schema.oneOf': 'Exactly one variant must match.',
  'schema.anyOf': 'One or more variants must match.',
  'schema.allOf': 'Every variant must match.',
  'schema.items': 'Array items',
  'schema.contains': 'Contains matching items',
  'schema.propertyNames': 'Property names',
  'schema.additionalProperties': 'Additional properties',
  'schema.unevaluatedProperties': 'Unevaluated properties',
  'schema.unevaluatedItems': 'Unevaluated items',
  'schema.not': 'Must not match',
  'schema.if': 'Condition',
  'schema.then': 'When the condition matches',
  'schema.else': 'When the condition does not match',
  'schema.recursive': 'Recursive reference:',
  'schema.depth': 'Nested schema display stops after 6 levels.',
  'schema.required': 'required',
  'schema.deprecated': 'deprecated',
  'schema.showChildren': 'Show child attributes',
  'schema.variant': 'Variant {number}',
  'schema.tuple': 'Tuple positions',
  'schema.position': 'Position {number}',
  'schema.pattern': 'Property pattern',
  'schema.dependency': 'When property is present',
  'lifecycle.reached': 'Sunset date reached',
  'lifecycle.soon': 'Sunset within 30 days',
  'lifecycle.deprecated': 'Deprecated operation',
  'lifecycle.announcement': 'Lifecycle announcement',
  'lifecycle.deprecation': 'Deprecation',
  'lifecycle.sunset': 'Sunset',
  'lifecycle.replacement': 'Replacement operation',
  'lifecycle.migration': 'Migration guide',
  'lifecycle.replacementUnavailable':
    'Replacement details are unavailable. Contact the API owner for migration guidance.',
  'lifecycle.region': 'Operation lifecycle',
  'lifecycle.viewAll': 'View all deprecations',
  'lifecycle.eyebrow': 'API lifecycle',
  'lifecycle.help':
    'Plan your next migration. Find retirement dates, replacement operations and guidance across every published API version.',
  'lifecycle.dateHelp':
    'Dates begin at 00:00 UTC. A declared sunset does not confirm that an API has been shut down.',
  'lifecycle.asOf': 'Status as of {date} (UTC).',
  'lifecycle.noScript':
    'Calendar status is available with JavaScript; all declared dates are listed below.',
  'lifecycle.filters': 'Filter deprecations',
  'lifecycle.all': 'All APIs',
  'lifecycle.choose': 'Choose API and version',
  'lifecycle.countOne': '{count} operation',
  'lifecycle.countOther': '{count} operations',
  'lifecycle.inGroup': '{count} in {title} \u00b7 {version}',
  'lifecycle.acrossAll': '{count} across all API versions',
  'lifecycle.page': 'Page {page} of {pages}',
  'lifecycle.noSunset': 'No sunset date announced.',
  'lifecycle.empty':
    'No deprecated operations or lifecycle announcements in this publication.',
  'lifecycle.pages': 'Deprecation pages',
  'lifecycle.previous': 'Previous page',
  'lifecycle.next': 'Next page',
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
