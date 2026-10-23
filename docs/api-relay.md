# Authenticated API relay

The optional server relay forwards bounded API requests after documentation-project authorization and operator destination checks. It is disabled by default: no relay routes are registered without a valid server policy. Publishing an API spec does not grant relay access. This backend API is implemented; explicit reader transport selection is the next integration step. The existing playground continues to send directly from the browser.

## Operator policy

Mount a reviewed JSON policy read-only and set `RELAY_CONFIG_FILE` to its path. Configuration is read at startup, limited to 64 KiB and validated strictly; unknown fields or invalid rules stop startup. Restart the server to change policy. Normal Docker/Kubernetes file mounts and trusted configuration symlinks are supported.

```json
{
  "projects": {
    "orbit": {
      "minimumRole": "viewer",
      "destinations": [
        {
          "origin": "https://api.example.com",
          "pathPrefix": "/v1/",
          "methods": ["GET", "HEAD", "POST"]
        }
      ],
      "requestHeaders": [
        "Accept",
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "Idempotency-Key"
      ]
    }
  }
}
```

Project keys are existing project slugs. Every caller must have an assigned project role, scoped project token or operator identity, even for a public project. The minimum role defaults to viewer and can be raised. Token/session validity and current role assignment are checked for each request. Cookie-authenticated POSTs require the configured PUBLIC_URL origin. The relay has no anonymous mode.

Configure 1–32 projects and 1–16 destination rules per project. Origins are exact HTTP(S) origins, without credentials, wildcards, paths, queries or fragments. Path subtrees end in `/`; `/v1/` does not authorize `/v10/` or `/v1` without its slash. The most-specific matching subtree controls methods; a broader rule cannot bypass a narrower restriction. Defaults permit only GET and HEAD. Encoded path delimiters/dot/percent/control bytes, backslashes and ambiguous paths are rejected. Ordinary Unicode path values remain percent-encoded; APIs requiring encoded slashes or literal encoded percent paths need a direct client.

HTTPS and public addresses are required by default. Cleartext HTTP and eligible private/loopback networks require separate `allowHttp: true` and `allowPrivateNetwork: true` options on the exact destination rule. Metadata/link-local and other reserved ranges remain blocked. Every DNS answer is checked, connections/CONNECT authority are pinned, and TLS verifies the original hostname. Configured proxy and CA trust remain in effect. Supply an approved runtime CA through the platform's normal trust configuration for internal/corporate TLS; certificate checks are never disabled. See [outbound transport](outbound-http.md).

## Credentials and headers

Documentation authentication stays in the outer request's cookie or bearer token. Target API credentials belong only in the explicit target header array or target URL/body, as required by that API. The server does not copy incoming documentation cookies, Authorization, Origin or forwarding headers to the target. The relay receives the supplied API credentials and payload, so use it only on a documentation server you trust.

Only configured request header names are accepted, with case-insensitive duplicate rejection. The default list is Accept, Content-Type and Authorization. Cookies, Host/framing, proxy/security, trusted forwarding, Origin, Referer and caller User-Agent cannot be granted. The server uses its own product User-Agent, exact Content-Length and identity Accept-Encoding. Explicit caller headers fit within 15 KiB and 64 fields. No service credentials are injected from server configuration.

Responses expose only Content-Type, Content-Language, Cache-Control, ETag, Last-Modified, Retry-After, WWW-Authenticate, X-Request-Id and the three common X-RateLimit headers as JSON metadata. Upstream cookies, redirects and unapproved headers cannot modify the documentation session or browser. Buffers are not decompressed; unexpected compression, protocol upgrades and redirects fail. There is no streaming, cookie jar or retry.

## Resource and audit boundaries

| Policy field             | Default / maximum                          |
| ------------------------ | ------------------------------------------ |
| `maxRequestBytes`        | 1 MiB                                      |
| `maxResponseBytes`       | 2 MiB                                      |
| `timeoutMs`              | 30000                                      |
| `maxConcurrent`          | 16                                         |
| `maxConcurrentPerMember` | 2 / 4                                      |
| `perMinute`              | 30 / 60 requests per directly connected IP |

Limits can be lowered. The rate bucket is shared by GET/POST and project aliases and applies before authentication work. The concurrency lease starts after membership authorization, before body parsing, and remains through response delivery and bounded audit writes. Slow uploads, disconnects and deadlines close/cancel the work; shutdown aborts active exchanges and drains bounded outcome records. Apply reverse-proxy connection/body/rate limits as well; per-instance limits are not distributed quotas.

The PostgreSQL writer appends metadata-only `relay.started`, `relay.completed`, `relay.failed` and `relay.denied` records. They contain a correlation ID, actor/project, configured origin, method, outcome/status, byte counts and duration. They exclude target query/path, credentials, header values and request/response bodies. `X-Api-Docs-Relay-Id` correlates a response with its audit records. A start record must succeed before contacting a target. Custom repositories remain compatible when the relay is disabled; enabling it requires a `RelayAuditWriter` with append-only storage.

Audit writes have a separate five-second application cap. The PostgreSQL writer uses a dedicated pool of at most four connections with a four-second database statement timeout and a five-second read timeout; it does not occupy the management pool while waiting on an audit lock. A timeout, disconnect or failed completion audit does not prove the API did not execute a mutation. The relay never retries it automatically. Review the target API's own idempotency/recovery behavior before sending again.

## Server API

Authenticated `GET /api/projects/<id-or-slug>/relay` returns the enabled project's destination/method/header policy and resource limits, without private-network flags or credentials. All relay responses use no-store caching. An unconfigured project returns 404; missing/insufficient authentication returns 401/403.

`POST` to the same endpoint accepts a strict JSON object:

```json
{
  "url": "https://api.example.com/v1/items",
  "method": "POST",
  "headers": [
    ["Authorization", "Bearer YOUR_API_CREDENTIAL"],
    ["Content-Type", "application/json"]
  ],
  "bodyBase64": "eyJuYW1lIjoiRXhhbXBsZSJ9"
}
```

`bodyBase64` is optional, canonical standard base64 of the exact request bytes. Header pairs avoid JSON prototype-name ambiguities. GET/HEAD cannot carry nonempty bodies. A successful relay exchange returns HTTP 200 with `{schemaVersion: 1, status, headers, bodyBase64}`; `status` is the target status, including API errors. Relay errors use ordinary 4xx/5xx status codes and never embed target payloads. Response bytes remain binary-safe through the JSON envelope.

Real HTTP/PostgreSQL tests cover authentication, role/token revocation, cookie/origin isolation, policy/byte limits, audits, failures without retries, shared quotas, stalled uploads, disconnects and shutdown. This prerelease still requires independent security review and deployment-specific acceptance before production claims.
