import type { Operation, Schema, SecurityScheme } from '@api-docs/contracts';
import {
  encodeValue,
  serializeParameters,
  setRequestHeader,
} from './parameters.js';
import { isJsonMediaType } from '@api-docs/contracts';
export interface RequestInput {
  server: string;
  parameters: Record<string, string>;
  body?: string;
  contentType?: string;
  accept?: string;
  credentials?: Record<string, string>;
  schemas?: Record<string, Schema>;
  openapiVersion?: string | undefined;
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
export function prepareRequest(
  operation: Operation,
  schemes: Record<string, SecurityScheme>,
  input: RequestInput,
): PreparedRequest {
  if (operation.kind && operation.kind !== 'endpoint')
    throw new Error(
      'Webhooks and callbacks are inbound events and cannot be executed in the API explorer',
    );
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
  const serialized = serializeParameters(
    operation.parameters,
    input.parameters,
    input,
  );
  const query = serialized.query;
  const response = operation.responses.find((item) => /^2/.test(item.status));
  const accept =
    input.accept ?? Object.keys(response?.content ?? {})[0] ?? '*/*';
  if (/[\r\n]/.test(accept))
    throw new Error('Response format cannot contain newlines');
  const headers: Record<string, string> = { ...serialized.headers };
  setRequestHeader(headers, 'Accept', accept);
  for (const [name, value] of Object.entries(serialized.paths))
    path = path.replaceAll(`{${name}}`, value);
  if (path.split('/').some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment)))
    throw new Error('Path parameters cannot resolve to URL dot segments');
  if (/\{[^}]+\}/.test(path)) throw new Error('Unresolved path parameter');
  const url = new URL(base.href.replace(/\/$/, '') + path);
  if (operation.security.length) {
    const alternative =
      operation.security.find(
        (requirement) =>
          Object.keys(requirement).length > 0 &&
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
      if (scheme.type === 'apiKey' && scheme.in === 'query') {
        const key = scheme.name ?? name;
        for (let i = query.length - 1; i >= 0; i--)
          if (query[i]!.name === key) query.splice(i, 1);
        query.push({ name: key, value: encodeValue(credential) });
      } else if (scheme.type === 'apiKey' && scheme.in === 'header')
        setRequestHeader(headers, scheme.name ?? name, credential);
      else if (
        scheme.type === 'http' &&
        scheme.scheme?.toLowerCase() === 'basic'
      )
        setRequestHeader(
          headers,
          'Authorization',
          `Basic ${base64(credential)}`,
        );
      else if (
        scheme.type === 'oauth2' ||
        scheme.type === 'openIdConnect' ||
        (scheme.type === 'http' && scheme.scheme?.toLowerCase() === 'bearer')
      )
        setRequestHeader(headers, 'Authorization', `Bearer ${credential}`);
      else throw new Error(`Unsupported authentication method: ${name}`);
    }
  }
  const body = input.body;
  if (body && ['get', 'head'].includes(operation.method))
    throw new Error('GET and HEAD requests cannot have a body in the browser');
  if (!body && operation.requestBody?.required)
    throw new Error('Request body is required');
  if (body) {
    const contentType = input.contentType ?? 'application/json';
    if (isJsonMediaType(contentType)) {
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
    setRequestHeader(headers, 'Content-Type', contentType);
  }
  url.search = query
    .map(({ name, value }) => `${encodeValue(name)}=${value}`)
    .join('&');
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
        encodeValue(secret),
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
export { generateSnippet } from './snippets.js';
export type { SnippetLanguage } from './snippets.js';
export {
  oauthUrl,
  resolveOAuthEndpoint,
  calculatePkceChallenge,
  createPkceTransaction,
  exchangePkceCode,
} from './oauth.js';
export type {
  OAuthClient,
  PkceTransaction,
  OAuthAccessToken,
} from './oauth.js';
