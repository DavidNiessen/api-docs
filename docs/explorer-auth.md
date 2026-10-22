# Explorer authentication

The reader accepts API keys, basic credentials, bearer tokens and OAuth authorization code with S256 PKCE. OAuth/OpenID security schemes can also use a manually acquired bearer token. Navigation and changes to the API server clear operation credentials; copied snippets use placeholders. The target API still enforces token validity, scopes and permissions.

## Open the playground

Choose **Try now** beside the endpoint URL or in its request example card. The playground opens over the current documentation, with request fields and collapsible request snippets on the left and a read-only response editor on the right. On narrow screens the panels stack inside the modal. Add `?playground=open` to an endpoint URL to share the open playground; existing query parameters and fragments are preserved when opening or closing it.

Use the close button, Escape or the backdrop to dismiss the modal. Keyboard focus returns to the control that opened it. Closing discards request drafts, files and credentials, cancels pending authorization, and aborts an in-flight browser request. An API may already have processed a request before cancellation; closing the playground does not undo server changes. Reopening starts a fresh request from the specification examples. The endpoint documentation and request example remain readable without JavaScript; sending requests requires JavaScript.

See the [response viewer and request URL bar](explorer-responses.md) for folding, syntax highlighting and full-response/URL copying.

## Register a public client

For an OAuth2 scheme with an `authorizationCode` flow, open **OAuth public client** in the playground. Set the public client ID and exact provider issuer, review the requested scopes, and register the displayed redirect URI with the provider. Then choose **Authorize with PKCE**. The provider must support public clients with PKCE and permit browser token requests through CORS. No client secret is needed or accepted in project configuration.

Defaults can be published in project configuration. The two mapping keys are the configured API id and OpenAPI security-scheme name:

```yaml
explorer:
  oauthClients:
    api:
      oauth:
        clientId: your-public-client-id
        issuer: https://identity.example.com
```

Scopes initially come from the operation's first alternative using that scheme and can be edited before authorization. Absolute authorization/token URLs come from the spec. Relative URLs resolve against the selected API server, treating its path as a directory; `/oauth/token` resolves at the server origin, while `oauth/token` retains the server base path.

Each export contains a static `<basePath>/oauth/callback/` page and a small callback script. That route is reserved, excluded from search/sitemaps and marked noindex. It removes query/fragment data from browser history before communicating with the opener. The reader requires the expected origin, exact popup window and state. A navigation or destination change cancels pending authorization; switching request/response panels preserves the active flow and expiry timer. Acquired tokens clear at the declared expiry or through **Clear credential**; no-expiry tokens remain until cleared or navigation. Cancelling a replacement flow leaves an existing token unchanged.

Use HTTPS for the documentation and provider. Loopback HTTP is supported when the reader itself is served on loopback HTTP for development. Host authentication must permit the callback navigation, normally through the same reader session cookie. A proxy's `Cross-Origin-Opener-Policy` must allow the provider popup to retain its opener (for example, `same-origin-allow-popups` where appropriate). Redact callback query strings from proxy access logs. Popup blockers, missing CORS support or a lost opener produce an error without installing a token.

## Public-client PKCE protocol helpers

`@api-docs/explorer` exports `createPkceTransaction`, `calculatePkceChallenge`, `exchangePkceCode`, `resolveOAuthEndpoint` and their types. These are the protocol helpers used by the reader. A host using the helpers directly supplies its own popup/callback handling.

Create a transaction with the registered public `clientId`, exact `issuer`, authorization/token endpoint URLs, registered `redirectUri`, and required scopes. The authorization URL retains provider query parameters and sets the OAuth response type, state, client, redirect, scopes and S256 challenge. Verifiers and state use independent 32-byte Web Crypto random values. Keep the returned transaction in memory and never log, serialize or persist it.

The host must bind callback origin and window identity before passing its `URLSearchParams` to `exchangePkceCode`. The helper checks state, duplicate callback parameters, provider errors and an issuer parameter when present. Transactions expire after five minutes and are consumed once a token request starts. A failed exchange requires a new authorization flow.

Endpoints require HTTPS without URL credentials or fragments. Redirect/issuer URLs cannot contain query strings. Explicit `allowLoopbackHttp` permits development on `localhost`, `127.0.0.1` or `::1`; it does not permit arbitrary HTTP hosts. Token requests omit cookies, refuse redirects and abort after 30 seconds or the supplied signal. Responses must be successful JSON, are bounded to 64 KiB, and must contain a bearer access token of at most 16 KiB without control characters. Declared lifetimes must be positive safe integer seconds.

Only the access token and optional expiry are returned. Refresh tokens and ID tokens are discarded; this is access-token acquisition, not OpenID login or ID-token verification. Provider response values and arbitrary fetch exception details are omitted from errors. Keep returned tokens in memory and clear them on expiry, cancellation, sign-out and navigation. These checks do not replace the independent security review required before a production release.
