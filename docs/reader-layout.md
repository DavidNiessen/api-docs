# Workspace layout and fullscreen responses

The reader uses a shared canvas with separate rounded islands for the header, navigation, article and inspector. Existing project colors, light/dark palettes, density, fonts and radius tokens remain available. The island radius has a 14-pixel minimum; inner controls retain their own radii. API examples and guide contents use the inspector alongside the article when space permits.

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
