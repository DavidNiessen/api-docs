# Explorer authentication

The reader currently accepts API keys, basic credentials and bearer tokens in memory. OAuth/OpenID security schemes can use a manually acquired bearer token. Navigation clears operation credentials, and copied snippets use placeholders. The target API still enforces token validity, scopes and permissions.

## Public-client PKCE protocol helpers

`@api-docs/explorer` exports `createPkceTransaction`, `calculatePkceChallenge`, `exchangePkceCode` and their types. These implement authorization code with S256 PKCE for public clients, without a client-secret field. Reader popup integration is the next implementation step; these helpers alone do not open a window or establish a login session.

Create a transaction with the registered public `clientId`, exact `issuer`, authorization/token endpoint URLs, registered `redirectUri`, and required scopes. The authorization URL retains provider query parameters and sets the OAuth response type, state, client, redirect, scopes and S256 challenge. Verifiers and state use independent 32-byte Web Crypto random values. Keep the returned transaction in memory and never log, serialize or persist it.

The host must bind callback origin and window identity before passing its `URLSearchParams` to `exchangePkceCode`. The helper checks state, duplicate callback parameters, provider errors and an issuer parameter when present. Transactions expire after five minutes and are consumed once a token request starts. A failed exchange requires a new authorization flow.

Endpoints require HTTPS without URL credentials or fragments. Redirect/issuer URLs cannot contain query strings. Explicit `allowLoopbackHttp` permits development on `localhost`, `127.0.0.1` or `::1`; it does not permit arbitrary HTTP hosts. Token requests omit cookies, refuse redirects and abort after 30 seconds or the supplied signal. Responses must be successful JSON, are bounded to 64 KiB, and must contain a bearer access token of at most 16 KiB without control characters. Declared lifetimes must be positive safe integer seconds.

Only the access token and optional expiry are returned. Refresh tokens and ID tokens are discarded; this is access-token acquisition, not OpenID login or ID-token verification. Provider response values and arbitrary fetch exception details are omitted from errors. Keep returned tokens in memory and clear them on expiry, cancellation, sign-out and navigation. These checks do not replace the independent security review required before a production release.
