import type { ApiDocument, Operation, Schema, SiteData } from './index.js';
import { guideHref, operationHref } from './index.js';
import { localeRoute } from './locale.js';
import { lifecycleContext } from './lifecycle-pages.js';
export function normalizePagePath(path: string): string {
  return path.replace(/\/index\.html$/, '/') || '/';
}
function schemaSubset(
  api: ApiDocument,
  operation: Operation | undefined,
): Record<string, Schema> {
  if (!operation) return {};
  const schemas: Record<string, Schema> = Object.create(null) as Record<
    string,
    Schema
  >;
  const queue: unknown[] = [operation];
  const visited = new WeakSet<object>();
  let nodes = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const item = queue[cursor];
    if (!item || typeof item !== 'object' || visited.has(item)) continue;
    visited.add(item);
    if (++nodes > 100_000)
      throw new Error('Operation schema graph exceeds its node budget');
    const object = item as Record<string, unknown>;
    if (typeof object.$ref === 'string' && object.$ref.startsWith('#/')) {
      const key = Object.hasOwn(api.schemas, object.$ref)
        ? object.$ref
        : object.$ref.startsWith('#/components/schemas/')
          ? object.$ref
              .slice('#/components/schemas/'.length)
              .replace(/~1/g, '/')
              .replace(/~0/g, '~')
          : object.$ref;
      if (Object.hasOwn(api.schemas, key) && !Object.hasOwn(schemas, key)) {
        schemas[key] = api.schemas[key]!;
        queue.push(api.schemas[key]);
      }
    }
    queue.push(...Object.values(object));
  }
  return schemas;
}
function navigationOperation(operation: Operation): Operation {
  return {
    ...(operation.kind ? { kind: operation.kind } : {}),
    id: operation.id,
    slug: operation.slug,
    method: operation.method,
    path: operation.path,
    summary: operation.summary,
    description: '',
    tags: operation.tags,
    deprecated: operation.deprecated,
    parameters: [],
    responses: [],
    security: [],
    servers: [],
    source: '',
  };
}
/** Only route-relevant content is serialized. Bounded navigation stays useful on very large APIs. */
export function createPageData(site: SiteData, inputPath: string): SiteData {
  const path = normalizePagePath(inputPath);
  if (site.pagePath === path) return site;
  const contentPath = localeRoute(site.config, path).contentPath;
  const activeGuide =
    site.guides.find((guide) => guideHref(guide) === contentPath) ??
    (contentPath === '/' ? site.guides[0] : undefined);
  const activeApi =
    site.apis.find((api) =>
      api.operations.some(
        (operation) => operationHref(api, operation) === contentPath,
      ),
    ) ?? site.apis[0];
  const activeOperation =
    activeApi?.operations.find(
      (operation) => operationHref(activeApi, operation) === contentPath,
    ) ??
    (contentPath === '/' && !site.guides.length
      ? activeApi?.operations[0]
      : undefined);
  const apis = site.apis
    .filter((api, index) => index < 16 || api === activeApi)
    .map((api) => {
      const counts = new Map<string, number>();
      const operations = api.operations
        .filter((operation, index) => {
          const tag = operation.tags[0] ?? 'Endpoints';
          const count = counts.get(tag) ?? 0;
          counts.set(tag, count + 1);
          return operation === activeOperation || (index < 200 && count < 20);
        })
        .map((operation) =>
          operation === activeOperation
            ? operation
            : navigationOperation(operation),
        );
      return {
        ...api,
        operations,
        schemas: schemaSubset(
          api,
          api === activeApi ? activeOperation : undefined,
        ),
        securitySchemes:
          api === activeApi && activeOperation ? api.securitySchemes : {},
        diagnostics: [],
      };
    });
  const navigationTotal =
    site.navigationTotal ??
    site.guides.length +
      site.apis.reduce((total, api) => total + api.operations.length, 0);
  return {
    ...site,
    pagePath: path,
    lifecycle: lifecycleContext(
      site,
      contentPath === '/' && activeApi && activeOperation
        ? operationHref(activeApi, activeOperation)
        : contentPath,
    ),
    assetMetadata: [],
    navigationTotal,
    navigationTruncated:
      site.navigationTruncated ||
      navigationTotal >
        Math.min(site.guides.length, 100) +
          apis.reduce((total, api) => total + api.operations.length, 0),
    apis,
    guides: site.guides
      .filter((guide, index) => index < 100 || guide === activeGuide)
      .map((guide) =>
        guide === activeGuide
          ? guide
          : {
              ...guide,
              links: [],
              anchors: [],
              sourceBytes: 0,
              html: '',
              text: '',
              headings: [],
            },
      ),
    diagnostics: [],
    config: {
      ...site.config,
      plugins: [],
      specs: site.config.specs.filter((spec) =>
        apis.some((api) => api.id === spec.id),
      ),
    },
  };
}
