import { readFile, realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { parseDocument } from 'yaml';
import { methods, slugify } from '@api-docs/contracts';
import type {
  ApiDocument,
  Diagnostic,
  Media,
  Operation,
  Parameter,
  Schema,
  SecurityScheme,
} from '@api-docs/contracts';
export { configSchema, parseConfig } from './config.js';

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
export async function confinedPath(
  root: string,
  path: string,
): Promise<string> {
  const [base, target] = await Promise.all([
    realpath(root),
    realpath(resolve(root, path)),
  ]);
  const local = relative(base, target);
  if (local === '..' || local.startsWith(`..${sep}`) || local.startsWith(sep))
    throw new Error(`Path escapes the project: ${path}`);
  return target;
}
export function parseSource(source: string, filename: string): unknown {
  if (Buffer.byteLength(source) > 16 * 1024 * 1024)
    throw new Error(`Input exceeds 16 MiB: ${filename}`);
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error(
      `${filename}: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  return document.toJS({ maxAliasCount: 50 }) as unknown;
}
function resolvePointer(
  document: unknown,
  value: unknown,
  chain: Set<string> = new Set(),
): Record<string, unknown> {
  const object = record(value);
  if (typeof object.$ref !== 'string') return object;
  if (!object.$ref.startsWith('#/')) return object;
  if (chain.has(object.$ref)) return object;
  const next = new Set(chain).add(object.$ref);
  const resolved: unknown = object.$ref
    .slice(2)
    .split('/')
    .reduce<unknown>(
      (node, segment) =>
        record(node)[segment.replace(/~1/g, '/').replace(/~0/g, '~')],
      document,
    );
  return {
    ...resolvePointer(document, resolved, next),
    ...Object.fromEntries(
      Object.entries(object).filter(([key]) => key !== '$ref'),
    ),
  };
}
function content(document: unknown, input: unknown): Record<string, Media> {
  return Object.fromEntries(
    Object.entries(record(input)).map(([type, value]) => {
      const media = resolvePointer(document, value);
      return [
        type,
        {
          schema: record(media.schema),
          ...(media.example === undefined ? {} : { example: media.example }),
          ...(media.examples === undefined
            ? {}
            : { examples: record(media.examples) }),
        },
      ];
    }),
  );
}
function servers(input: unknown, fallback: string[]): string[] {
  const result = array(input)
    .map((item) => {
      const server = record(item);
      return text(server.url).replace(/\{([^}]+)\}/g, (_, name: string) =>
        text(record(record(server.variables)[name]).default),
      );
    })
    .filter(Boolean);
  return result.length ? result : fallback;
}
export async function loadSpec(
  root: string,
  input: { id: string; path: string; version?: string },
): Promise<ApiDocument> {
  const filename = await confinedPath(root, input.path);
  const parsed = record(
    parseSource(await readFile(filename, 'utf8'), input.path),
  );
  if (!/^3\.(0|1)\.\d+$/.test(text(parsed.openapi)))
    throw new Error(
      `${input.path}: supported versions are OpenAPI 3.0.x and 3.1.x`,
    );
  let files = 0;
  const parser = new SwaggerParser();
  const bundled = await parser.bundle(
    filename,
    parsed as unknown as typeof parser.api,
    {
      resolve: {
        http: false,
        file: {
          order: 100,
          canRead: true,
          read: async (file: { url: string }) => {
            if (++files > 128)
              throw new Error('Reference limit exceeded (128 files)');
            if (/^[a-z]+:/i.test(file.url))
              throw new Error(
                'Remote references are disabled; vendor the referenced file locally',
              );
            const path = await confinedPath(root, file.url);
            if ((await stat(path)).size > 16 * 1024 * 1024)
              throw new Error('Reference exceeds 16 MiB');
            return JSON.stringify(
              parseSource(await readFile(path, 'utf8'), relative(root, path)),
            );
          },
        },
      },
    },
  );
  const document = record(bundled);
  const info = record(document.info);
  if (
    !text(info.title) ||
    !text(info.version) ||
    (!document.paths && !document.webhooks)
  )
    throw new Error(
      `${input.path}: info.title, info.version and paths or webhooks are required`,
    );
  const diagnostics: Diagnostic[] = [];
  const rootServers = servers(document.servers, []);
  const operations: Operation[] = [];
  const slugs = new Set<string>();
  for (const [path, rawPathItem] of Object.entries(record(document.paths))) {
    if (!path.startsWith('/'))
      throw new Error(`${input.path}: path must start with /: ${path}`);
    const pathItem = resolvePointer(document, rawPathItem);
    for (const method of methods) {
      if (!pathItem[method]) continue;
      const operation = record(pathItem[method]);
      const id = text(operation.operationId, `${method}-${path}`);
      let slug = slugify(id);
      if (slugs.has(slug)) slug = slugify(`${id}-${method}-${path}`);
      if (slugs.has(slug))
        throw new Error(`Duplicate operation route: ${slug}`);
      slugs.add(slug);
      const parametersByKey = new Map<string, Parameter>();
      for (const item of [
        ...array(pathItem.parameters),
        ...array(operation.parameters),
      ]) {
        const parameter = resolvePointer(document, item);
        const location = text(parameter.in);
        if (!['path', 'query', 'header', 'cookie'].includes(location))
          throw new Error(`${id}: unsupported parameter location ${location}`);
        const p: Parameter = {
          name: text(parameter.name),
          in: location as Parameter['in'],
          required: parameter.required === true || location === 'path',
          description: text(parameter.description),
          schema: record(parameter.schema),
          ...(typeof parameter.style === 'string'
            ? { style: parameter.style }
            : {}),
          ...(typeof parameter.explode === 'boolean'
            ? { explode: parameter.explode }
            : {}),
          ...(parameter.example === undefined
            ? {}
            : { example: parameter.example }),
        };
        if (!p.name) throw new Error(`${id}: parameter name is required`);
        parametersByKey.set(`${location}:${p.name}`, p);
      }
      const responses = Object.entries(record(operation.responses)).map(
        ([status, rawResponse]) => {
          const response = resolvePointer(document, rawResponse);
          return {
            status,
            description: text(response.description),
            content: content(document, response.content),
            headers: record(response.headers),
          };
        },
      );
      if (!responses.length)
        throw new Error(`${id}: at least one response is required`);
      if (!operation.description)
        diagnostics.push({
          code: 'operation-description',
          severity: 'warning',
          message: `${method.toUpperCase()} ${path} has no description`,
          source: input.path,
        });
      if (operation.callbacks)
        diagnostics.push({
          code: 'callbacks',
          severity: 'warning',
          message: `${id}: callbacks are preserved in the source spec; callback rendering is not yet supported`,
          source: input.path,
        });
      const requestBody = resolvePointer(document, operation.requestBody);
      operations.push({
        id,
        slug,
        path,
        method,
        summary: text(operation.summary, id),
        description: text(operation.description),
        tags: array(operation.tags).filter(
          (tag): tag is string => typeof tag === 'string',
        ),
        deprecated: operation.deprecated === true,
        parameters: [...parametersByKey.values()],
        ...(operation.requestBody
          ? {
              requestBody: {
                required: requestBody.required === true,
                description: text(requestBody.description),
                content: content(document, requestBody.content),
              },
            }
          : {}),
        responses,
        security: array(operation.security ?? document.security).map(
          (value) => record(value) as Record<string, string[]>,
        ),
        servers: servers(
          operation.servers,
          servers(pathItem.servers, rootServers),
        ),
        source: `${input.path}#/paths/${path.replace(/~/g, '~0').replace(/\//g, '~1')}/${method}`,
      });
    }
  }
  if (document.webhooks)
    diagnostics.push({
      code: 'webhooks',
      severity: 'warning',
      message:
        'Webhooks are preserved in the source spec; dedicated webhook pages are not yet supported',
      source: input.path,
    });
  return {
    id: input.id,
    version: input.version ?? text(info.version),
    title: text(info.title),
    description: text(info.description),
    source: input.path,
    operations,
    schemas: record(record(document.components).schemas) as Record<
      string,
      Schema
    >,
    securitySchemes: record(
      record(document.components).securitySchemes,
    ) as Record<string, SecurityScheme>,
    diagnostics,
    servers: rootServers,
  };
}

export { resolveSchema, exampleFor } from '@api-docs/contracts';
