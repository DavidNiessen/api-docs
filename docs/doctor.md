# Documentation doctor

`validate` checks structural configuration, OpenAPI and content correctness. `doctor` adds offline validation of authored examples, publication links and documentation coverage:

```sh
node packages/cli/dist/main.js doctor my-docs
node packages/cli/dist/main.js doctor my-docs --strict --json
```

Errors fail with exit code 1. `--strict` also fails warnings. JSON output is the existing diagnostic array (`code`, `severity`, `message`, `source`). Invalid authored examples use `invalid-example`; unsupported/uncompilable validation uses `example-schema-unsupported`. Diagnostic sources identify normalized spec locations, not source line numbers. Actual example values are omitted from errors.

Examples include parameter `example`/named `examples`, request and response media examples, response-header examples, and schema-level `example`/`examples` values, including nested properties and components. Explicit false, zero, empty string and null values are checked. Named example references are resolved locally. `externalValue` yields an `external-example` warning; no network download occurs. Vendor external data into an example's `value` for repeatable CI.

Validation supports local recursive/composed schemas, standard formats from ajv-formats, and OpenAPI 3.0 nullable and boolean exclusive boundaries. OpenAPI 3.1 reference siblings retain their validation constraints. Request validation excludes read-only fields from required lists; response validation excludes write-only fields. Incoming callback/webhook payloads use the producer's output direction. Component-level examples have no request/response projection. Extra read-only/write-only fields are not rejected solely for their visibility annotation.

JSON/`+json` media examples are logical JSON values; a string containing JSON is still a string and is not silently decoded. Plain-text examples with a string schema are checked as exact strings, preserving whitespace. Serialized XML, form, binary and other non-JSON examples need media-specific decoding: `example-serialization-unsupported` warns rather than falsely rejecting a serialized string as an object. Native non-string values in these media types are checked against their logical schemas, with the same warning that wire serialization remains unverified. Schema-level examples are always logical values. These review warnings can use the same explicit rule/suppression policy as other doctor findings.

Each API is checked in a separate worker with a 10-second wall deadline, 512 MiB V8 old-space limit, 128 MiB serialized input and 4 MiB diagnostic output limits. Regex/format evaluation happens there, so pathological expressions cannot hang the CLI indefinitely. There is a 10,000-example/diagnostic limit, 500,000 conversion/traversal node budget and depth limit of 64. Exceeding a budget fails explicitly; reduce/split the contract or simplify its schemas. This limit is independent of compiler and publication benchmarks.

Unknown validation keywords/formats and schema scope/dynamic-reference semantics are reported for review, rather than claimed as fully checked. `x-` extensions are treated as annotations. This is example validation, not a general JSON Schema support claim or execution of generated snippets. Plain builds and `validate` do not execute this additional example-validation pass; run doctor explicitly in CI. Trusted MDX/plugins require their separate trust flags, just as in normal builds.

## Links, fragments and assets

Doctor checks links in sanitized Markdown/MDX output against generated guide/operation routes, the root-page alias, configured redirects and copied public assets. It checks guide heading/component fragments, supported endpoint sections (`authentication`, `path-parameters`, `query-parameters`, `header-parameters`, `cookie-parameters`, `request-body`, `responses`) and `main-content` when present. HTML index aliases and query strings resolve to the same page. Browser text fragments and `#top` remain usable. Local images must resolve to supported raster assets. External links/images, mail/tel links and data URLs are not fetched or certified.

Broken links/images use `broken-link`, absent fragments `broken-anchor`, and malformed local URLs `invalid-link`, all errors by default. Sources such as `guides/intro.md#links/2` identify the zero-based link/image position in sanitized document order. Messages omit URL query values. Redirect collisions and absent destinations use `redirect-collision`/`redirect-target` errors. Link checking has a 100,000-link project budget; coverage traversal has a 500,000-node budget and depth limit of 64. Limits fail explicitly rather than claiming unchecked content passed.

Relative `.md`/`.mdx` links inside the guide tree are rewritten to their generated routes, preserving query/fragment suffixes and the configured `basePath`. Root-relative guide links and image URLs receive that prefix once. Use `/media/path.png` for copied public images, `/api/id/version/operation/` for reference links, and generated `heading-...` fragments for headings. Links escaping the guide tree are not rewritten into readable source-file URLs. Local guide routes participate in client navigation. Plugin-returned HTML is sanitized again; authors of transforms remain responsible for its link paths.

## Coverage rules and reviewable exceptions

Additional warnings identify operations without tags (`operation-tags`), authored payload examples (`operation-example`), documented error/default responses (`operation-error-response`), or deliberately anonymous alternatives beside authentication (`operation-anonymous`). Existing missing-description/response diagnostics remain included. Coverage is guidance: it does not prove examples represent production behavior or that every error has been documented.

Configure per-rule severity and narrow exceptions in `docs.config.yaml`:

```yaml
doctor:
  rules:
    operation-tags: error
    operation-error-response: warning
  suppressions:
    - code: broken-link
      source: guides/introduction.md#links/2
      reason: The authenticated portal gateway supplies this route outside this artifact.
```

Severities are `off`, `warning` or `error`. Suppressions match an exact code/source pair, including any link index; patterns are not expanded. A nonempty explanatory reason of 8–500 characters is required. Unused exceptions produce `doctor-unused-suppression`; unknown rule ids produce `doctor-unknown-rule`. Review exceptions as source changes move links. Rules also apply to known compiler/plugin diagnostic codes emitted in that run. Policy configuration and diagnostic sources are build metadata and may appear in exported data; do not include confidential information in reasons.
