# Executable request snippets

The explorer generates cURL, JavaScript, TypeScript, Python and Java examples from the same serialized request it sends. Snippets redact known credentials to placeholders before display or copy. Credentials stay in reader memory. Review examples before executing them against a real API.

JavaScript and TypeScript use native `fetch`, a 30-second abort signal, and content-type-aware response handling. JSON and `+json` responses are parsed; text remains text and an empty response becomes `null`. Run JavaScript as an ES module (`example.mjs`). The pinned Node.js 24 runtime also runs the generated TypeScript directly as `example.mts`; other runtimes may require compilation.

Python uses the standard library. Java uses `java.net.http.HttpClient` and can run as `java Example.java` on a JDK. cURL requires version 7.76 or newer for `--fail-with-body`; `--data-raw` preserves literal bodies beginning with `@` instead of reading a local file. Generated clients use request timeouts and report HTTP errors. They do not automatically follow redirects; cURL displays the 3xx response, while the other examples fail for review. The generated examples handle UTF-8 text and JSON, not streaming or binary response downloads.

## Verification

After `npm run build:packages`, run `npm run test:snippets`. This requires `curl`, `python3`, and `java` on `PATH` alongside Node.js. A missing runtime fails the check rather than skipping a language. CI runs it as a required source-job step with JDK 21.

The harness starts a loopback-only server on a dynamically allocated port and executes the generated source in all five runtimes. Its 35 cases check bodyless GETs, JSON and raw text request bytes, Unicode, quotes, leading `@`, headers and query strings; JSON/text/204 responses; non-success exits for HTTP errors; and redirects that must not produce another request. It uses fixture credentials only and removes generated source after completion. This is fixture execution, not verification against every API or an arbitrary authored-snippet runner.

The local run used Node.js 24.19.0, Python 3.12.14, cURL 8.14.1 and OpenJDK 21. Browser execution still depends on the destination API's CORS policy. Authentication flow acquisition, file uploads and streaming SDK examples remain separate capabilities.
