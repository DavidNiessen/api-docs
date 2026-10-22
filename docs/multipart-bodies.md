# Multipart request bodies

The explorer SDK prepares bounded, binary-safe `multipart/form-data` requests. All five SDK snippet generators support uploads. Reader upload controls remain a pending increment; the reader currently reports unsupported multipart input rather than sending a misleading request.

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

`createMultipartParts(body, files, media, options)` exposes preparation independently. `MULTIPART_LIMITS` publishes the 100-part, 32-MiB aggregate and 1,024-byte field-name/filename limits. The aggregate limit includes conservative space for headers and boundaries. Logical JSON also obeys the shared [JSON input limits](explorer-bodies.md). Oversized requests fail before file bytes are read. Single-file fields reject multiple files; required fields need at least one emitted part. Empty arrays emit no part. A binary field cannot also appear in the logical text object. GET/HEAD uploads and files supplied for other body media types fail explicitly.

## Boundaries and safety

The initial codec supports direct object roots and content-based encoding. Composed/conditional root schemas, explicit style/explode/allowReserved settings, custom per-part headers and unresolved references fail rather than being silently approximated. This is a serializer with presence checks, not full schema-instance or file-content validation. Configure API-side size limits, authorization and file validation separately.

Field names reject controls, double quotes and backslashes to avoid ambiguous Content-Disposition parsing. Filenames must be basenames without controls or path separators; quoted filenames escape `"` as `%22`, matching browser multipart behavior. Ordinary Unicode names and filenames remain UTF-8. Check a server's decoding behavior if it relies on unusual filename characters.

`redactRequest` removes all multipart text values and replaces uploaded bytes and filenames with empty generic placeholders in its returned preview. The actual prepared request is unchanged. This deliberately conservative multipart redaction currently does not preserve non-sensitive text fields. `generateSnippet` supports the same cURL, JavaScript, TypeScript, Python and Java targets as ordinary requests. JSON-part placeholders remain valid JSON strings. Schema-aware multipart previews and reader controls remain required before this is a complete reader feature.

## Executable snippets

Multipart snippets use numbered `./YOUR_FILE_1`, `./YOUR_FILE_2`, … paths. Replace each with a local file before execution. Selected file bytes and original filenames never enter generated source, even when the caller passes an unredacted request; generated part filenames are `upload-1.bin`, `upload-2.bin`, … . Adapt these generic names if the destination requires a particular filename. Text values come from the provided request, so call `redactRequest` before copying a preview containing sensitive values.

Each generated client creates a fresh boundary and sends Content-Type values per part, preserving repeated fields, arbitrary binary file bytes and explicit JSON parts without filenames. Native Blob assembly, standard-library publishers or private temporary body files avoid treating uploaded bytes as text. JavaScript/TypeScript file examples target the pinned Node.js 24 runtime and use `node:fs` `openAsBlob`; they do not access browser file inputs. Python uses only its standard library. Java uses file body publishers. cURL upload examples are POSIX shell scripts requiring `mktemp`, `od`, `tr`, `cat` and `base64` in addition to cURL. They create temporary bodies under a restrictive umask and clean up on exit.

The executable harness tests all five clients against a real loopback server and independently parses their multipart data. It covers text-only uploads, binary and empty files, Unicode, NUL characters, repeated values, exact numeric tokens inside JSON, per-part types, generic filenames, HTTP failures and redirects that must not issue another request. These 20 multipart checks run alongside the existing 40 snippet cases.

Tests exercise an independent multipart parser and actual loopback HTTP requests, including binary octets, Unicode, repeated fields/files, large JSON numbers, per-part content types, boundary freshness, injection attempts, limits and redaction. See [form-urlencoded bodies](form-bodies.md) for the separate text-form codec.
