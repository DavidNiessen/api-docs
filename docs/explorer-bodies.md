# Editing JSON request bodies

JSON request bodies open in the raw **JSON** editor. For object schemas with declared properties, choose **Fields** to edit individual values. Strings use text inputs, password/write-only strings are masked, booleans and enums use selectors, and nullable properties have an explicit null control. Numbers retain their original JSON number tokens, including large integer IDs and precise decimals. Arrays and nested objects use JSON editors within their field.

Use the include checkbox to add or omit a property. New values use an explicit constant, default or example when available; otherwise the editor starts with an empty value of the declared type. Required labels remain visible. Unknown properties and existing read-only properties are retained when another field changes; edit those values through JSON. Read-only properties are excluded from the field controls. A `const` property displays its fixed value.

Incomplete numeric or collection edits disable **Send request** and replace the snippet with an error. The underlying body keeps its last valid value until the field input is valid. Returning to JSON discards incomplete field drafts and shows that last valid body. Field editing checks JSON syntax and the immediate declared value type; it does not replace full JSON Schema validation or the target API's constraints. Required fields, patterns, bounds and cross-field rules still apply.

## Precision and editing limits

Editing fields uses a JSON syntax tree rather than converting number tokens to JavaScript floating-point numbers. Updating a name does not round an unrelated ID such as `9007199254740993`, a precise decimal or an exponent value. Unknown nested values retain their numeric tokens too. Formatting and equivalent string escapes may change when the body is rewritten.

The field editor accepts at most 1 MiB of UTF-8 JSON, 32 nesting levels, 10,000 values and 100 declared root properties. Duplicate property names require the raw editor. Non-object bodies and composed/conditional root schemas also use JSON; nested collections remain available as JSON values. These boundaries disable field editing rather than truncating the request. OpenAPI 3.0 typed nullable fields and 3.1 null type unions keep their respective meanings.

## Sensitive examples

For JSON bodies, displayed/copied snippets replace values marked `writeOnly: true` or `format: password` with `YOUR_SENSITIVE_VALUE`, including referenced schemas, nested objects, array items and composition branches. Known credentials are also scrubbed from decoded JSON strings, so Unicode escapes cannot bypass a direct string comparison. Pattern and conditional schema branches are handled conservatively; a value may be redacted even when a specific branch would not apply. The redactor does not execute spec-supplied regular expressions.

Invalid, duplicate-key, oversized, excessively complex or unresolved JSON bodies use `YOUR_REQUEST_BODY` in snippets when safe redaction cannot be established. Redaction changes only the displayed example; the actual request uses the body you edited. The raw JSON editor displays the actual values for review. Response bodies are not covered by request redaction.

Annotations and known credentials cannot identify every secret. Mark sensitive schema fields, review copied requests and avoid entering production credentials in demo sites. Non-JSON body formats currently rely on known-credential replacement; schema-aware JSON redaction is not an XML/form-data parser.

Programmatic clients can pass `{ schema, schemas, openapiVersion }` as the third argument to `redactRequest`, or call `redactJsonBody` directly. Generic request redaction without that context does not perform schema-aware body traversal. The public `parseJsonValue`, `serializeJsonValue` and `setJsonProperty` helpers in `@api-docs/contracts` preserve number tokens for integrations that build their own editors.

See [request serialization](request-serialization.md), [OAuth authentication](explorer-auth.md) and [generated snippets](snippets.md) for the remaining request behavior. Multipart uploads and schema-driven form-url-encoded bodies remain separate implementation work.
