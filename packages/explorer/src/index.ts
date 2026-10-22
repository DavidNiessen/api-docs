import type { Operation, Parameter, SecurityScheme } from '@api-docs/contracts';
export interface RequestInput {
  server: string;
  parameters: Record<string, string>;
  body?: string;
  contentType?: string;
  credentials?: Record<string, string>;
}
export interface PreparedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}
const base64 = (value: string): string =>
  btoa(
    Array.from(new TextEncoder().encode(value), (byte) =>
      String.fromCharCode(byte),
    ).join(''),
  );
const encode = (value: unknown): string => encodeURIComponent(String(value));
function valueFor(raw: string, parameter: Parameter): unknown {
  if (parameter.schema.type === 'array' || parameter.schema.type === 'object') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`${parameter.name} must be valid JSON`);
    }
  }
  return raw;
}
function entries(value: unknown): [string, string][] {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).map(([key, item]) => [key, String(item)])
    : [];
}
function pathValue(value: unknown, parameter: Parameter): string {
  const style = parameter.style ?? 'simple';
  const explode = parameter.explode ?? false;
  const object = entries(value);
  const parts = Array.isArray(value)
    ? value.map(encode)
    : object.length
      ? object.flatMap(([key, item]) =>
          explode
            ? [`${encode(key)}=${encode(item)}`]
            : [encode(key), encode(item)],
        )
      : [encode(value)];
  if (style === 'label') return `.${parts.join(explode ? '.' : ',')}`;
  if (style === 'matrix')
    return explode && (Array.isArray(value) || object.length)
      ? parts
          .map(
            (part) =>
              `;${Array.isArray(value) ? `${encode(parameter.name)}=` : ''}${part}`,
          )
          .join('')
      : `;${encode(parameter.name)}=${parts.join(',')}`;
  if (style !== 'simple') throw new Error(`Unsupported path style: ${style}`);
  return parts.join(',');
}
export function prepareRequest(
  operation: Operation,
  schemes: Record<string, SecurityScheme>,
  input: RequestInput,
): PreparedRequest {
  const base = new URL(input.server);
  if (
    !['https:', 'http:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.hash ||
    base.search
  )
    throw new Error(
      'Server must be an HTTP(S) URL without credentials, a query, or a fragment',
    );
  let path = operation.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { Accept: 'application/json' };
  for (const parameter of operation.parameters) {
    const raw = input.parameters[`${parameter.in}:${parameter.name}`] ?? '';
    if (!raw && parameter.required)
      throw new Error(`${parameter.name} is required`);
    if (!raw) continue;
    const value = valueFor(raw, parameter);
    const object = entries(value);
    if (parameter.in === 'path')
      path = path.replaceAll(
        `{${parameter.name}}`,
        pathValue(value, parameter),
      );
    else if (parameter.in === 'query') {
      const style = parameter.style ?? 'form';
      const explode = parameter.explode ?? true;
      if (style === 'deepObject') {
        if (!object.length)
          throw new Error(`${parameter.name} must be an object`);
        for (const [key, item] of object)
          query.append(`${parameter.name}[${key}]`, item);
      } else if (['form', 'spaceDelimited', 'pipeDelimited'].includes(style)) {
        if (Array.isArray(value)) {
          if (explode && style === 'form')
            for (const item of value)
              query.append(parameter.name, String(item));
          else
            query.append(
              parameter.name,
              value.join(
                style === 'spaceDelimited'
                  ? ' '
                  : style === 'pipeDelimited'
                    ? '|'
                    : ',',
              ),
            );
        } else if (object.length && explode)
          for (const [key, item] of object) query.append(key, item);
        else
          query.append(
            parameter.name,
            object.length ? object.flat().join(',') : String(value),
          );
      } else throw new Error(`Unsupported query style: ${style}`);
    } else if (parameter.in === 'header') {
      if (
        /[\r\n]/.test(raw) ||
        /^(host|cookie|origin|content-length|connection|sec-|proxy-)/i.test(
          parameter.name,
        )
      )
        throw new Error(
          `Header cannot be set by the browser: ${parameter.name}`,
        );
      headers[parameter.name] = Array.isArray(value)
        ? value.join(',')
        : object.length
          ? object
              .flatMap(([key, item]) =>
                parameter.explode ? `${key}=${item}` : [key, item],
              )
              .join(',')
          : String(value);
    } else
      throw new Error(
        'Cookie parameters require a same-origin authenticated session and cannot be set manually in a browser',
      );
  }
  if (/\{[^}]+\}/.test(path)) throw new Error('Unresolved path parameter');
  const url = new URL(base.href.replace(/\/$/, '') + path);
  for (const [key, value] of query) url.searchParams.append(key, value);
  if (operation.security.length) {
    const alternative =
      operation.security.find((requirement) =>
        Object.keys(requirement).every((name) =>
          Boolean(input.credentials?.[name]),
        ),
      ) ??
      operation.security.find(
        (requirement) => Object.keys(requirement).length === 0,
      );
    if (!alternative)
      throw new Error(
        'Provide credentials for one complete authentication alternative',
      );
    for (const name of Object.keys(alternative)) {
      const scheme = schemes[name];
      const credential = input.credentials?.[name];
      if (!scheme || !credential) continue;
      if (/[\r\n]/.test(credential))
        throw new Error('Credentials cannot contain newlines');
      if (scheme.type === 'apiKey' && scheme.in === 'query')
        url.searchParams.set(scheme.name ?? name, credential);
      else if (scheme.type === 'apiKey' && scheme.in === 'header')
        headers[scheme.name ?? name] = credential;
      else if (
        scheme.type === 'http' &&
        scheme.scheme?.toLowerCase() === 'basic'
      )
        headers.Authorization = `Basic ${base64(credential)}`;
      else if (
        scheme.type === 'oauth2' ||
        scheme.type === 'openIdConnect' ||
        (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer')
      )
        headers.Authorization = `Bearer ${credential}`;
      else throw new Error(`Unsupported authentication method: ${name}`);
    }
  }
  const body = input.body?.trim();
  if (body && ['get', 'head'].includes(operation.method))
    throw new Error('GET and HEAD requests cannot have a body in the browser');
  if (!body && operation.requestBody?.required)
    throw new Error('Request body is required');
  if (body) {
    const contentType = input.contentType ?? 'application/json';
    if (contentType.includes('json')) {
      try {
        JSON.parse(body);
      } catch {
        throw new Error('Request body must be valid JSON');
      }
    }
    if (contentType.startsWith('multipart/'))
      throw new Error(
        'Multipart file uploads are not yet supported by this explorer',
      );
    headers['Content-Type'] = contentType;
  }
  return {
    url: url.href,
    method: operation.method.toUpperCase(),
    headers,
    ...(body ? { body } : {}),
  };
}
export function redactRequest(
  request: PreparedRequest,
  credentials: Record<string, string>,
): PreparedRequest {
  const sensitive = Object.values(credentials)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const scrub = (input: string): string => {
    let output = input;
    for (const secret of sensitive) {
      const encodedForm = new URLSearchParams({ value: secret })
        .toString()
        .slice(6);
      for (const representation of [
        secret,
        encodeURIComponent(secret),
        encodedForm,
        base64(secret),
      ])
        output = output.split(representation).join('YOUR_CREDENTIAL');
    }
    return output;
  };
  return {
    url: scrub(request.url),
    method: request.method,
    headers: Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        scrub(value),
      ]),
    ),
    ...(request.body === undefined ? {} : { body: scrub(request.body) }),
  };
}
const shell = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;
export type SnippetLanguage =
  'cURL' | 'JavaScript' | 'TypeScript' | 'Python' | 'Java';
export function generateSnippet(
  request: PreparedRequest,
  language: SnippetLanguage,
): string {
  if (language === 'cURL')
    return [
      `curl --request ${request.method}`,
      `  --url ${shell(request.url)}`,
      ...Object.entries(request.headers).map(
        ([key, value]) => `  --header ${shell(`${key}: ${value}`)}`,
      ),
      ...(request.body ? [`  --data ${shell(request.body)}`] : []),
    ].join(' \\\n');
  if (language === 'JavaScript' || language === 'TypeScript')
    return `const response = await fetch(${JSON.stringify(request.url)}, ${JSON.stringify({ method: request.method, headers: request.headers, ...(request.body ? { body: request.body } : {}) }, null, 2)});\nif (!response.ok) throw new Error(\`HTTP \${response.status}\`);\nconst data${language === 'TypeScript' ? ': unknown' : ''} = await response.json();\nconsole.log(data);`;
  if (language === 'Python')
    return `import json\nimport urllib.request\n\nheaders = json.loads(${JSON.stringify(JSON.stringify(request.headers))})\nrequest = urllib.request.Request(\n    ${JSON.stringify(request.url)},\n    headers=headers,\n    method=${JSON.stringify(request.method)},${request.body ? `\n    data=${JSON.stringify(request.body)}.encode("utf-8"),` : ''}\n)\nwith urllib.request.urlopen(request, timeout=30) as response:\n    print(response.read().decode("utf-8"))`;
  return `import java.net.URI;\nimport java.net.http.*;\nimport java.time.Duration;\n\nclass Example {\n  public static void main(String[] args) throws Exception {\n    var client = HttpClient.newHttpClient();\n    var request = HttpRequest.newBuilder(URI.create(${JSON.stringify(request.url)}))\n        .timeout(Duration.ofSeconds(30))\n${Object.entries(
    request.headers,
  )
    .map(
      ([key, value]) =>
        `        .header(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
    )
    .join(
      '\n',
    )}\n        .method(${JSON.stringify(request.method)}, HttpRequest.BodyPublishers.${request.body ? `ofString(${JSON.stringify(request.body)})` : 'noBody()'})\n        .build();\n    var response = client.send(request, HttpResponse.BodyHandlers.ofString());\n    System.out.println(response.body());\n  }\n}`;
}
