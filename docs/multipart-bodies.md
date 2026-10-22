# Multipart request bodies

The reader and explorer SDK prepare bounded, binary-safe `multipart/form-data` requests. All five snippet generators support uploads.

## Reader inputs

The playground separates local file selectors from text values. Declared binary arrays accept multiple files; each selected file becomes its own part. Use Fields or JSON for text/JSON values, including exact numeric tokens. Examples can describe a file field but cannot select a visitor's local file: binary example placeholders are removed from the text draft, and required uploads remain disabled until a file is chosen. Do not place binary fields or encoded file contents into the text JSON object.

The reader caps its controls at 100 declared properties. It blocks invalid JSON, missing required parts, unsupported codecs and requests above the aggregate size/part limits. Response-only properties are not required in requests. Each file field has a clear control; changing the API server, content type, example or operation clears file selections. Request/response tab changes retain them. The reader does not persist selections across navigation or reload and sends files directly to the API only after Send request and the normal mutating-request confirmation.

Previews retain ordinary text/plain and JSON values while redacting password/write-only annotations, nested JSON values and known credentials. File bytes and original filenames are always replaced. Opaque non-JSON structures use a whole-part placeholder because their nested values cannot be safely interpreted by the JSON schema redactor. Missing, invalid or excessive redaction contexts fail closed. This annotation-based protection still requires reviewing an example before executing it.

## SDK

Supply logical text values as a JSON object, and selected files separately. File fields declare `format: binary`, directly or inside array items. Arrays of files and arrays of text/JSON values repeat the part name. The encoder resolves local root, property and item references using the API's schema map and dialect.

```ts
import { prepareRequest, toFetchRequest } from '@api-docs/explorer';

const request = prepareRequest(operation, api.securitySchemes, {
  server: 'https://api.example.com',
  parameters: {},
  contentType: 'multipart/form-data',
  bodyFormat: 'json',
  body: '{"title":"Example upload","metadata":{"id":9007199254740993}}',
  files: {
    attachment: [{ data: selectedFile, filename: selectedFile.name }],
  },
  schemas: api.schemas,
  openapiVersion: api.openapiVersion,
});
const response = await fetch(request.url, {
  ...toFetchRequest(request),
  credentials: 'omit',
  redirect: 'error',
  signal: AbortSignal.timeout(30_000),
});
```

`selectedFile` is a browser `File` or another `Blob`; the SDK does not read filesystem paths. `prepareRequest` returns `multipart` parts instead of a string `body`. Use `toFetchRequest` to materialize the actual fetch method, standard `Headers` instance and Blob body. Inspect a returned header with `.headers.get(name)`. Each invocation creates a fresh cryptographically random boundary and matching Content-Type header. Do not provide a boundary or other outer media-type parameters. Files remain immutable Blob slices during preparation and assembly; the encoder never decodes them as text. Preparation uses no clock or randomness, making request previews deterministic.

Text primitives use UTF-8 `text/plain`; objects use JSON. Explicit per-field `encoding.contentType` selects one concrete media type. Non-JSON structured fields require already serialized text. JSON parts have a content type and no filename; they are not disguised as uploaded files. File parts default to `application/octet-stream`; an explicit encoding can select another type. No content sniffing, base64 decoding or XML conversion occurs. Exact numeric tokens in logical JSON remain intact.

`createMultipartParts(body, files, media, options)` exposes preparation independently. `MULTIPART_LIMITS` publishes the 100-part, 32-MiB aggregate and 1,024-byte field-name/filename limits. The aggregate limit includes conservative space for headers and boundaries. Logical JSON also obeys the shared [JSON input limits](explorer-bodies.md). Oversized requests fail before file bytes are read. Single-file fields reject multiple files; required request fields need at least one emitted part, while read-only properties are exempt. Empty arrays emit no part. A binary field cannot also appear in the logical text object. GET/HEAD uploads and files supplied for other body media types fail explicitly.

## Boundaries and safety

The initial codec supports direct object roots and content-based encoding. Composed/conditional root schemas, explicit style/explode/allowReserved settings, custom per-part headers and unresolved references fail rather than being silently approximated. This is a serializer with presence checks, not full schema-instance or file-content validation. Configure API-side size limits, authorization and file validation separately.

Field names reject controls, double quotes and backslashes to avoid ambiguous Content-Disposition parsing. Filenames must be basenames without controls or path separators; quoted filenames escape `"` as `%22`, matching browser multipart behavior. Ordinary Unicode names and filenames remain UTF-8. Check a server's decoding behavior if it relies on unusual filename characters.

`redactRequest` accepts the same optional `BodyRedaction` context for multipart as JSON requests. With a valid context it reconstructs logical arrays, applies conservative annotation redaction and preserves exact JSON tokens. Uploaded bytes and filenames are always replaced; opaque parts and failures use placeholders. Without a context, all text values are replaced conservatively. The actual prepared request is unchanged. `createMultipartParts` records `collection: true` on repeated logical array parts; preserve that metadata when transforming requests. Manually constructed array parts must provide it when their schema cannot establish the grouping. `generateSnippet` supports cURL, JavaScript, TypeScript, Python and Java. JSON-part placeholders remain syntactically valid JSON strings.

## Executable snippets

Multipart snippets use numbered `./YOUR_FILE_1`, `./YOUR_FILE_2`, … paths. Replace each with a local file before execution. Selected file bytes and original filenames never enter generated source, even when the caller passes an unredacted request; generated part filenames are `upload-1.bin`, `upload-2.bin`, … . Adapt these generic names if the destination requires a particular filename. Text values come from the provided request, so call `redactRequest` before copying a preview containing sensitive values.

Each generated client creates a fresh boundary and sends Content-Type values per part, preserving repeated fields, arbitrary binary file bytes and explicit JSON parts without filenames. Native Blob assembly, standard-library publishers or private temporary body files avoid treating uploaded bytes as text. JavaScript/TypeScript file examples target the pinned Node.js 24 runtime and use `node:fs` `openAsBlob`; they do not access browser file inputs. Python uses only its standard library. Java uses file body publishers. cURL upload examples are POSIX shell scripts requiring `mktemp`, `od`, `tr`, `cat` and `base64` in addition to cURL. They create temporary bodies under a restrictive umask and clean up on exit.

The executable harness tests all five clients against a real loopback server and independently parses their multipart data. It covers text-only uploads, binary and empty files, Unicode, NUL characters, repeated values, exact numeric tokens inside JSON, per-part types, generic filenames, HTTP failures and redirects that must not issue another request. These 20 multipart checks run alongside the existing 40 snippet cases.

Tests exercise an independent multipart parser and actual loopback HTTP requests, including binary octets, Unicode, repeated fields/files, large JSON numbers, per-part content types, boundary freshness, injection attempts, limits and redaction. See [form-urlencoded bodies](form-bodies.md) for the separate text-form codec.
