# API contract review

Compare two local YAML or JSON OpenAPI 3.0/3.1 documents:

```sh
node packages/cli/dist/main.js diff previous/openapi.yaml next/openapi.yaml
node packages/cli/dist/main.js diff previous/openapi.json next/openapi.json --json
```

References must remain inside each document's directory. Vendor shared dependencies into those trees before comparison. No API requests or remote reference downloads occur.

## CI behavior

The default exit codes are 0 for informational changes or no findings, 1 for breaking changes, and 2 for changes requiring review. Invalid inputs also fail. `--allow-review` permits review findings to exit successfully, but never suppresses breaking findings. Use the default in a required PR check; approve uncertain changes through your repository's normal review process.

JSON output is an array with `severity`, stable `code`, `operation`, escaped JSON-pointer-style `location`, and `message`. When the new operation supplies an HTTP(S) `externalDocs` URL, findings include `referenceUrl`; use that page for migration instructions. Locations refer to the normalized operation, rather than source line numbers. Do not interpret an empty array as a proof of behavioral compatibility.

## Classification coverage

The classifier matches endpoints by method/path and keeps callback parent/name/expression and webhook identity separate. It detects removed operations, operation-id changes, removed servers, parameter removals/additions/requiredness/serialization, required or removed bodies, removed response statuses/media/headers, and loss of response-header guarantees. Added response statuses and output media require client-handling review.

Schema checks follow local component references and terminate recursive pairs. Input acceptance and output guarantees use opposite compatibility directions: narrowing request types or enum values breaks old inputs; widening response types or enum values breaks assumptions made by old clients. Bounds, nullable/type sets, literal constants, property removal/addition, required properties, array items/uniqueness, and additional-property policies are included. Required `readOnly` properties are excluded from requests and required `writeOnly` properties from responses. Callback/webhook payloads use the output direction because the API producer sends them to consumers.

Each document keeps its OpenAPI dialect: 3.0 typed `nullable` schemas accept null, while 3.1 uses JSON Schema null types and treats `nullable` as an annotation. OpenAPI 3.0 reference siblings are ignored, including through alias chains. Required visibility checks resolve referenced property schemas. Composition review distinguishes schema annotations from property-map keys and literal values, so fields named `description`, `default` or `examples` cannot hide a contract change. Programmatic `diffApi` callers should retain `ApiDocument.openapiVersion`; older inputs without it keep the legacy 3.0 handling.

Authentication comparison preserves OR alternatives, AND scheme requirements, OAuth scopes and anonymous alternatives. Removing an accepted credential alternative, adding required scopes, or changing the referenced scheme is breaking for ordinary endpoints. Incoming-event authentication changes require review.

## Deliberate review boundaries

This is a conservative structural check, not a general JSON Schema implication solver. Changed composition/conditional keywords, patterns, formats, visibility, multipart encoding, schema-valued additional-property policy transitions, and unknown schema keywords require review. Changes inside otherwise identical composition references also trigger review. Content-based response headers always require review while present. Comparing a newly constrained optional request property against a previously open object requires review.

Constraints can interact: individual findings can overstate incompatibility when another constraint already excluded the affected values. Removed optional parameters/properties/status codes are treated conservatively. The tool does not prove runtime behavior, defaults applied by a server, semantic status handling, external SDK compatibility, guide links, or changes to metadata not retained by the normalized model. For example, OpenAPI links and discriminator mapping destinations need human review. Validate generated clients and real requests against a controlled test API before release.

The comparison fails explicitly beyond 100,000 visited nodes or 10,000 findings. Depth beyond 64 produces a review finding. Split large contracts when these limits apply; comparison must not silently omit an unvisited branch. Findings are sorted by operation, location and code for repeatable CI output.
