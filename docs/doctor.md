# Documentation doctor

`validate` checks structural configuration, OpenAPI and content correctness. `doctor` adds offline validation of authored examples against their schemas:

```sh
node packages/cli/dist/main.js doctor my-docs
node packages/cli/dist/main.js doctor my-docs --strict --json
```

Errors fail with exit code 1. `--strict` also fails warnings. JSON output is the existing diagnostic array (`code`, `severity`, `message`, `source`). Invalid authored examples use `invalid-example`; unsupported/uncompilable validation uses `example-schema-unsupported`. Diagnostic sources identify normalized spec locations, not source line numbers. Actual example values are omitted from errors.

Examples include parameter `example`/named `examples`, request and response media examples, response-header examples, and schema-level `example`/`examples` values, including nested properties and components. Explicit false, zero, empty string and null values are checked. Named example references are resolved locally. `externalValue` yields an `external-example` warning; no network download occurs. Vendor external data into an example's `value` for repeatable CI.

Validation supports local recursive/composed schemas, standard formats from ajv-formats, and OpenAPI 3.0 nullable and boolean exclusive boundaries. OpenAPI 3.1 reference siblings retain their validation constraints. Request validation excludes read-only fields from required lists; response validation excludes write-only fields. Incoming callback/webhook payloads use the producer's output direction. Component-level examples have no request/response projection. Extra read-only/write-only fields are not rejected solely for their visibility annotation.

Each API is checked in a separate worker with a 10-second wall deadline, 512 MiB V8 old-space limit, 128 MiB serialized input and 4 MiB diagnostic output limits. Regex/format evaluation happens there, so pathological expressions cannot hang the CLI indefinitely. There is a 10,000-example/diagnostic limit, 500,000 conversion/traversal node budget and depth limit of 64. Exceeding a budget fails explicitly; reduce/split the contract or simplify its schemas. This limit is independent of compiler and publication benchmarks.

Unknown validation keywords/formats and schema scope/dynamic-reference semantics are reported for review, rather than claimed as fully checked. `x-` extensions are treated as annotations. This is example validation, not a general JSON Schema support claim or execution of generated snippets. Link checking, coverage rules and justified suppressions remain further doctor work. Plain builds and `validate` do not execute this additional example-validation pass; run doctor explicitly in CI. Trusted MDX/plugins require their separate trust flags, just as in normal builds.
