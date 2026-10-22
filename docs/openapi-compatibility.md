# OpenAPI compatibility

The compiler accepts OpenAPI 3.0.0–3.0.4 and 3.1.0–3.1.2 in YAML or JSON. Equivalent files produce equivalent operation models. The API version used in documentation URLs is independently configured with `specs[].version`.

## Validation and references

Inputs are structurally validated against the OpenAPI schemas. OpenAPI 3.1 schemas are additionally checked against the JSON Schema 2020-12 meta-schema. The default OpenAPI 3.1 dialect and explicit 2020-12 dialect are supported; custom dialects produce an error. This validates the schema's structure, not every authored example or its business meaning.

Semantic checks reject duplicate operation IDs and parameters, ambiguous path templates, missing/optional path parameters, unknown security scheme names, invalid references and route collisions. Omitted responses are valid in OpenAPI 3.1 and produce a documentation warning; OpenAPI 3.0 requires them. Errors identify the source file and pointer where available. `validate --strict` fails on documentation warnings.

Local references are bundled within the real project root. Symlinks cannot escape it. Schema aliases, nested JSON Pointers, escaped pointer segments and recursive references retain a finite representation; route payloads include reachable referenced schemas. Validation siblings of `$ref` are preserved as an intersection, rather than overwriting the referenced constraints. HTTP references are currently disabled: vendor them into the project. Configured remote-source importing remains roadmap work.

File reads are bounded before loading the full input: 16 MiB per spec/reference, 128 referenced files, and 64 MiB total source bytes. YAML rejects duplicate keys and limits alias expansion. Binary/non-UTF-8 files are rejected. These limits apply to source parsing; operators must still isolate untrusted builds and bound process memory and time.

## Generated documentation

| Construct               | Current behavior                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paths and operations    | Parameters, inherited/overridden parameters, request/response bodies, media types, security alternatives, server variables, source pointers and deprecation |
| Reusable definitions    | Schemas, request bodies, responses, parameters, security schemes and response headers resolve local references                                              |
| Composition             | `allOf`, `oneOf`, `anyOf`, recursion, nullable types, enums, constants, defaults and constraints appear in the schema view                                  |
| JSON Schema annotations | Metadata is preserved; the reader shows common scalar, array, read/write and discriminator constraints                                                      |
| Webhooks                | Dedicated searchable reference pages with request payload examples                                                                                          |
| Callbacks               | Dedicated pages identify the triggering operation, callback name and runtime expression                                                                     |
| Incoming events         | Explorer execution is disabled; your application's receiver handles the documented request                                                                  |

Generated examples are bounded illustrative templates. Conditional schemas, advanced array/object evaluation, discriminator branch selection and arbitrary regex constraints are preserved but are not yet fully represented by interactive forms or guaranteed-valid synthetic examples. Example validation and broader schema presentation remain release work. Cookie parameters cannot be set manually by the browser explorer; host authentication or copyable client snippets require the appropriate runtime policy.

The compatibility suite covers YAML/JSON parity across both versions, semantic failures, alias/nested/circular references, `$ref` intersections, webhook/callback rendering, source limits and malformed UTF-8. Framework support and packaged consumer tests are documented in [integrations](integrations.md).

## Authored example checks

Run `doctor` for offline schema validation of authored examples, including local references, falsy values, standard formats and directional read/write-only requirements. See the [doctor coverage and limits](doctor.md). Structural import alone does not validate example data.
