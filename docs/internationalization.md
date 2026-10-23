# Reader languages and UI translations

Projects can customize the core reader labels without JavaScript plugins or remote translation services. `defaultLocale` selects the HTML language and the UI message catalog. The current increment covers navigation/search, theme actions, playground/URL-bar actions, response-editor controls, clipboard feedback and the page footer. Advanced request-form, schema, lifecycle, authentication and administration wording still uses English. Configured locales generate reader routes and a language menu. Documentation content currently comes from the default-locale sources; alternate UI languages display an explicit content-fallback notice. Source files are never translated automatically.

## Locale routes and content fallback

Default-language URLs stay unchanged. With `basePath: /docs`, `defaultLocale: en` and `locales: [en, de]`, a guide remains at `/docs/guides/start/`; its German UI is at `/docs/de/guides/start/`. The prefixed route selects German messages and displays the same source content with an explicit English-content fallback notice. The content article retains its source-language attribute. The default locale does not get a redundant prefix.

The header language menu uses ordinary links, so it works without JavaScript and starts a fresh reader instance. Switching languages keeps the current guide, operation or lifecycle page, drops URL queries/fragments and clears playground drafts, responses and remembered API credentials. It does not acquire credentials or issue an API request. Subsequent reader navigation and search-result links retain the selected locale. Authored links inside source content retain their authored destinations.

All generated locale HTML/page-data routes belong to the same verified artifact and hosting allowlist. Assets, search shards, `site.json` and the OAuth callback keep their existing unprefixed locations under `basePath`; a locale prefix does not grant access to additional files. Search uses the shared source-language corpus while mapping result navigation to the selected UI language. Incremental guide updates regenerate every locale variant and match clean builds. The existing artifact ceilings of 100,000 routes and 200,000 files still apply after expansion.

Alternate routes currently contain source-language fallback content. They use `noindex,follow`, canonicalize to the default-language page and stay out of the sitemap. They are not advertised as fully translated SEO alternates. The verified generic 404 document uses the default language; unknown locale/page paths remain 404s and their language-menu links lead to a valid localized home page.

## Configure messages

```yaml
locales: [en, de-DE]
defaultLocale: de-DE
i18n:
  messages:
    de:
      navigation.docs: Dokumentation
      search.label: Dokumentation durchsuchen
      search.placeholder: Dokumentation durchsuchen…
      playground.try: Jetzt testen
      playground.dialog: '{title} testen'
      playground.send: Senden
      response.copy: Vollständige Antwort kopieren
    de-DE:
      playground.send: Anfrage senden
```

See the [German example](../examples/localized/docs.config.yaml). The example is a partial project-authored catalog, not a claim of a reviewed complete German translation. Source guides and OpenAPI summaries remain authored content.

Resolution is exact locale, its base language, then the bundled English message. A missing key falls back individually. Regional overrides do not erase base-language keys. English defaults and existing URLs/accessible names remain unchanged when no messages are configured. The renderer and browser use the same catalog, with no language detection, storage, network requests or global locale state.

Supported locale identifiers use two lowercase language letters and an optional uppercase two-letter region, such as `de` or `pt-BR`. Configure 1–16 distinct locales and include `defaultLocale`. Message catalog keys must target a configured locale or its base language. Every message key is validated against the public catalog; unknown keys, empty text, control characters and values above 512 characters fail the build. Do not put secrets in messages: they are public artifact configuration.

## Named parameters and plain text

Some messages require named context, such as `{title}`, `{count}`, `{method}` or `{origin}`. Keep the original names; translated text can reorder them. Validation rejects missing or substituted parameter names. Values are inserted literally once, so a value containing another placeholder does not trigger recursive substitution.

Messages render as text, including accessible labels and confirmation dialogs. They cannot contain executable expressions, HTML components, Markdown or formatting instructions. Literal `<` and `>` characters are escaped by React, and boot configuration is encoded safely in the HTML document. Changing the close-button label does not change its focus behavior: the modal uses a stable DOM marker.

## Public message API

`@api-docs/contracts` exports `defaultUiMessages`, `createUiTranslation`, `validUiMessage`, `UiMessageKey`, `UiMessages`, `UiConfiguration`, `UiText` and `UiTranslation`. Inspect the default catalog to obtain the supported stable IDs and English values:

```js
import { defaultUiMessages, createUiTranslation } from '@api-docs/contracts';
console.log(JSON.stringify(defaultUiMessages, null, 2));
const ui = createUiTranslation('de-DE', config.i18n);
console.log(ui.text('playground.dialog', { title: 'Create project' }));
console.log({
  translated: ui.translated,
  fallback: ui.fallback,
  total: ui.total,
});
```

TypeScript checks named arguments for each message. Coverage counts describe this core message catalog, not all product text or translated documentation. For English locales the bundled catalog supplies every entry; other locales count valid exact/base overrides. The public helper ignores invalid runtime overrides and inherited message keys. Configuration validation remains the recommended entry point.

Full text direction/layout acceptance and independent linguistic/accessibility review remain separate release work. Do not advertise a fully localized language solely because its identifier is configured.

## Public route helpers

`localeRoute(config, path)` returns the selected locale, prefix and source `contentPath`. `localizePath(config, path, locale)` changes the locale prefix and rejects unconfigured languages or paths containing queries/fragments. `localePaths(config, path)` enumerates default/alternate variants. Inputs are paths relative to the publication base path, not filesystem paths or absolute URLs. These helpers do not authorize routes; the artifact manifest remains authoritative. `localeName(locale)` supplies stable native menu labels without server/browser ICU differences.
