import SwaggerParser from '@apidevtools/swagger-parser';
import { parseSource, record, text } from './source.js';
import { canonicalReferenceUrl } from './reference-manifest.js';

/** RAM-only resolution: no file/HTTP fallback and no URI-rebasing schema keywords. */
export async function bundleReferenceSources(
  root: string,
  sources: ReadonlyMap<string, Buffer>,
  override?: string,
): Promise<unknown> {
  const parsed = new Map<string, string>();
  let expanded = 0,
    nodes = 0;
  let api: unknown;
  for (const [url, bytes] of sources) {
    const source =
      url === root && override !== undefined
        ? override
        : new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const value = parseSource(source, 'pinned-reference');
    const json = JSON.stringify(value);
    expanded += Buffer.byteLength(json);
    if (expanded > 64 * 1024 * 1024)
      throw new Error('Reference graph expanded budget exceeded');
    const queue: unknown[] = [value];
    for (let index = 0; index < queue.length; index++) {
      const item = queue[index];
      if (++nodes > 1_000_000)
        throw new Error('Reference graph node budget exceeded');
      if (!item || typeof item !== 'object') continue;
      for (const [key, child] of Object.entries(item)) {
        if (
          [
            '$id',
            '$anchor',
            '$dynamicAnchor',
            '$dynamicRef',
            '$recursiveRef',
          ].includes(key) &&
          typeof child === 'string'
        )
          throw new Error(
            'URI rebasing, anchors and dynamic references are not supported by pinned snapshots',
          );
        if (key === '$ref' && typeof child === 'string') {
          if (child.length > 8192) throw new Error('Invalid pinned reference');
          let target: URL;
          try {
            target = new URL(child, url);
          } catch {
            throw new Error('Invalid pinned reference');
          }
          const fragment = decodeURIComponent(target.hash.slice(1));
          if (fragment && (!fragment.startsWith('/') || fragment.length > 4096))
            throw new Error('Pinned references require JSON Pointer fragments');
          target.hash = '';
          if (!sources.has(canonicalReferenceUrl(target.href)))
            throw new Error('Reference is not listed in the approved snapshot');
        }
        queue.push(child);
      }
    }
    parsed.set(url, json);
    if (url === root) api = value;
  }
  if (!/^3\.(0|1)\.\d+$/.test(text(record(api).openapi)))
    throw new Error('Unsupported pinned OpenAPI version');
  const parser = new SwaggerParser();
  const bundled = await parser.bundle(root, api as typeof parser.api, {
    resolve: {
      file: false,
      http: {
        order: 1,
        canRead: () => true,
        read: (file: { url: string }) => {
          const value = parsed.get(canonicalReferenceUrl(file.url));
          if (value === undefined) throw new Error('Unlisted reference');
          return value;
        },
      },
    },
  });
  const validator = new SwaggerParser();
  await validator.validate(root, structuredClone(bundled), {
    resolve: { external: false, http: false, file: false },
    dereference: { circular: 'ignore' },
  });
  return bundled;
}
