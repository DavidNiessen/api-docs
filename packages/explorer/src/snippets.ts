import type { PreparedRequest } from './index.js';
import { generateMultipartSnippet } from './multipart-snippets.js';
import { fetchHeaderEntries } from './parameters.js';

const shell = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
export type SnippetLanguage =
  'cURL' | 'JavaScript' | 'TypeScript' | 'Python' | 'Java';
export function generateSnippet(
  request: PreparedRequest,
  language: SnippetLanguage,
): string {
  if (request.multipart) return generateMultipartSnippet(request, language);
  if (language === 'cURL')
    return [
      `curl --silent --show-error --fail-with-body --max-time 30 --request ${shell(request.method)}`,
      `  --url ${shell(request.url)}`,
      ...Object.entries(request.headers).map(
        ([key, value]) =>
          `  --header ${shell(/^[\t ]*$/.test(value) ? `${key};` : `${key}: ${value}`)}`,
      ),
      ...(request.body ? [`  --data-raw ${shell(request.body)}`] : []),
    ].join(' \\\n');
  if (language === 'JavaScript' || language === 'TypeScript')
    return `const response = await fetch(${JSON.stringify(request.url)}, {\n  ...${JSON.stringify({ method: request.method, redirect: 'error', ...(request.body ? { body: request.body } : {}) }, null, 2)},\n  headers: ${JSON.stringify(fetchHeaderEntries(request.headers), null, 2)},\n  signal: AbortSignal.timeout(30_000)\n});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst text = await response.text();\nconst data${language === 'TypeScript' ? ': unknown' : ''} = text && /(?:\\/|\\+)json(?:;|$)/i.test(response.headers.get('content-type') ?? '') ? JSON.parse(text) : (text || null);\nconsole.log(data);`;
  if (language === 'Python')
    return `import json\nimport urllib.request\n\nclass NoRedirect(urllib.request.HTTPRedirectHandler):\n    def redirect_request(self, req, fp, code, msg, headers, newurl):\n        return None\n\nopener = urllib.request.build_opener(NoRedirect)\nheaders = json.loads(${JSON.stringify(JSON.stringify(request.headers))})\nrequest = urllib.request.Request(\n    ${JSON.stringify(request.url)},\n    headers=headers,\n    method=${JSON.stringify(request.method)},${request.body ? `\n    data=${JSON.stringify(request.body)}.encode("utf-8"),` : ''}\n)\nwith opener.open(request, timeout=30) as response:\n    print(response.read().decode("utf-8"))`;
  return `import java.net.URI;\nimport java.net.http.*;\nimport java.time.Duration;\n\nclass Example {\n  public static void main(String[] args) throws Exception {\n    var client = HttpClient.newHttpClient();\n    var request = HttpRequest.newBuilder(URI.create(${JSON.stringify(request.url)}))\n        .timeout(Duration.ofSeconds(30))\n${Object.entries(
    request.headers,
  )
    .map(
      ([key, value]) =>
        `        .header(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
    )
    .join(
      '\n',
    )}\n        .method(${JSON.stringify(request.method)}, HttpRequest.BodyPublishers.${request.body ? `ofString(${JSON.stringify(request.body)})` : 'noBody()'})\n        .build();\n    var response = client.send(request, HttpResponse.BodyHandlers.ofString());\n    if (response.statusCode() < 200 || response.statusCode() >= 300) throw new java.io.IOException("HTTP " + response.statusCode());\n    System.out.println(response.body());\n  }\n}`;
}
