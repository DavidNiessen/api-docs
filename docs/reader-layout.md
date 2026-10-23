# Workspace layout and fullscreen responses

The reader uses a shared canvas with separate rounded islands for the header, navigation, article and inspector. Existing project colors, light/dark palettes, density, fonts and radius tokens remain available. The island radius has a 14-pixel minimum; inner controls retain their own radii. API examples and guide contents use the inspector alongside the article when space permits.

## Personal reader settings

Open the settings button in the header to customize this browser's reading experience. Settings apply to the current origin and documentation base path, independently of published project configuration. They survive reloads and synchronize with other open tabs for the same site. No account, request contents, response data or API credentials are stored with appearance preferences. Blocked storage keeps settings usable for the current visit; invalid, unsupported or oversized saved data falls back to safe defaults.

Choose system, light or dark appearance. System mode follows operating-system changes while the site is open. Select a mint, ocean, violet or neutral accent preset, or customize the light/dark reading palettes, typography, density, radius and preferred widths. The palette mode chooses which appearance to edit. Contrast warnings identify reading colors below 4.5:1. Save up to eight named custom documentation themes, apply them later, or delete them; saving the same name replaces that preset. **Use published theme** removes the personal documentation theme while retaining other preferences. The separate `?theme-editor=1` authoring preview remains temporary and can export portable project theme configuration.

The default **Modern islands** layout keeps resizable navigation and inspectors. Choose **Reader settings → Documentation layout → Classic API reference** for a Swagger-style endpoint list. **Classic API reference** shows collapsed, method-colored endpoint rows grouped by tag in the main page, with no API sidebar. Expand a row to read its description, parameters, schemas and responses, or open **Try now**. One row expands at a time. Its API/version selector sits above the list. Guides retain their navigation rail, and switching back restores modern sizing preferences. Both layouts retain search and the modal API playground.

Classic lists use complete exported endpoint catalogs, with 100 rows per page, independently of the bounded sidebar inventory. Full schema/security details load only when needed. Paging, collapsing, changing API/version or leaving the layout cancels obsolete metadata work; late results cannot replace the selected endpoint. Loading failures offer explicit retry controls. Catalog and detail requests have byte/deadline limits. An endpoint permalink or shared playground URL uses a `#classic-<page>-<slug>` fragment to restore the selected row; a plain reference page initially keeps every row collapsed. The existing read-only response editor, fullscreen/copy behavior and authentication policies apply to classic playgrounds.

The response editor has independent follow-appearance, light, dark, high-contrast and custom theme choices. Custom editor colors cover the background, text, property keys, strings, numbers and keywords, with a live sample and contrast feedback. This editor preference is saved separately from named documentation themes. Changing it, including from another tab, preserves the current response and folding state. Fullscreen viewing uses the same theme; copying still returns the entire original response.

Reader and Studio scrollbars use slim, theme-aware thumbs and transparent tracks, with stronger hover/focus colors. Native scrolling retains keyboard and touch behavior. Forced-color mode restores platform scrollbar colors, and Monaco uses its own matching compact scrollbar controls.

## Filter sidebar navigation

**All** is the initial section on every page load and shows authored guides alongside endpoints for the selected API version. **Documentation** shows guide groups only; **API Reference** shows endpoint groups and the API version selector. Selecting a section opens its first page when crossing from the other section. Ordinary sidebar links and back/forward navigation keep an active section consistent with the displayed page; All continues including both kinds. Search remains available across the documentation. Pre-rendered navigation includes both kinds for readers without JavaScript.

## Resize the workspace

On desktop, drag the gutter between navigation and content or between the article and inspector. The playground also has a divider between request configuration and response. Width changes update CSS tracks without rerendering the documentation tree or sending API requests. Preferred widths are bounded, and available space can further constrain rendered widths.

Each divider is keyboard focusable and announces its preferred width:

- Left/right arrows move the divider by 16 pixels.
- Hold Shift for 32-pixel changes.
- Home/End select the minimum/maximum preferred width.
- Double-click restores the default width.

Navigation defaults to the configured `theme.sidebarWidth`. API and guide inspectors have separate preferences. Preferences are local to the browser origin and project base path; the playground shares its project preference across endpoints. Storage failure uses working in-memory defaults. No credentials or response data are stored with these preferences. Clear the site's browser storage to remove saved preferences.

Medium layouts stack API examples beneath the article. Compact layouts use the existing navigation menu and stack the playground's request and response panels. Unneeded dividers disappear rather than reserving width. Pre-rendered content and ordinary links remain usable without JavaScript; interactive resizing becomes available after hydration.

Studio uses the same rounded workspace surfaces. Its desktop navigation-width slider supports pointer and native keyboard controls and remembers its width locally. On compact screens, navigation becomes a horizontal menu and the width control disappears.

## View an entire response

After receiving or generating a response, choose **View response fullscreen** in the response-editor toolbar. A native modal expands the response view to the viewport, with read-only Monaco highlighting, folding, scrolling and **Copy entire response**. Switching views preserves folding/scroll state for the same response. Copy retains the complete original response text, including formatting and precise number tokens; the formatted display does not replace the copy source.

Use **Exit response fullscreen** or Escape to return to the existing playground. Focus returns to the fullscreen button, and another Escape closes the playground. This is a viewport-sized application modal; it does not request browser fullscreen permissions or hide browser chrome. The same controls work on mobile and in both themes. An editor-initialization failure retains a plain response view and copy action; failure to load the editor module retains the existing plain fallback.

Fullscreen changes presentation only. Existing explorer transport, response limits, authentication and cancellation policies continue to apply. See [request serialization](request-serialization.md) and [explorer authentication](explorer-auth.md) for those contracts.
