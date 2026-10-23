import { open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { parseDocument } from 'yaml';

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
  const chosenRoot = resolve(root),
    base = await realpath(chosenRoot),
    chosenTarget = resolve(chosenRoot, path);
  let requested = relative(chosenRoot, chosenTarget);
  // Accept either spelling of an explicitly selected symlink root, then resolve
  // from its canonical directory so a changed root alias cannot redirect the lookup.
  if (
    requested === '..' ||
    requested.startsWith('..' + sep) ||
    isAbsolute(requested)
  ) {
    requested = relative(base, chosenTarget);
    if (
      requested === '..' ||
      requested.startsWith('..' + sep) ||
      isAbsolute(requested)
    )
      throw new Error(`Path escapes the project: ${path}`);
  }
  const candidate = resolve(base, requested);
  if (candidate === base) return base;
  // Verify the actual lookup path as well as its relative spelling. Keep the
  // separator on the root prefix so a sibling with the same name cannot match.
  if (!candidate.startsWith(base.endsWith(sep) ? base : base + sep))
    throw new Error(`Path escapes the project: ${path}`);
  const target = await realpath(candidate);
  const local = relative(base, target);
  if (local === '..' || local.startsWith('..' + sep) || isAbsolute(local))
    throw new Error(`Path escapes the project: ${path}`);
  return target;
}
/** Bound reads before allocating the entire input, including files that grow after stat. */
export async function readBoundedFile(
  filename: string,
  limit = 16 * 1024 * 1024,
): Promise<Buffer> {
  const file = await open(
    filename,
    constants.O_RDONLY |
      (constants.O_NONBLOCK ?? 0) |
      (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new Error(`Input must be a regular file: ${filename}`);
    if (info.size > limit)
      throw new Error(`Input exceeds ${limit} bytes: ${filename}`);
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit - total + 1));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit)
        throw new Error(`Input exceeds ${limit} bytes: ${filename}`);
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await file.close();
  }
}
export async function readTextFile(
  filename: string,
  limit = 16 * 1024 * 1024,
): Promise<string> {
  return new TextDecoder('utf-8', { fatal: true }).decode(
    await readBoundedFile(filename, limit),
  );
}
export function parseSource(source: string, filename: string): unknown {
  if (Buffer.byteLength(source) > 16 * 1024 * 1024)
    throw new Error(`Input exceeds 16 MiB: ${filename}`);
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length)
    throw new Error(
      `${filename}: ${document.errors.map((error) => error.message).join('; ')}`,
    );
  if (document.warnings.length)
    throw new Error(`${filename}: unsupported YAML syntax or tag`);
  // Maps retain key types until collisions and non-JSON keys can be rejected.
  const parsed: unknown = document.toJS({ maxAliasCount: 50, mapAsMap: true });
  const ancestors = new Set<object>();
  let nodes = 0,
    bytes = 0;
  const charge = (size: number) => {
    bytes += size;
    if (bytes > 64 * 1024 * 1024)
      throw new Error(`${filename}: expanded JSON exceeds 64 MiB`);
  };
  const stringBytes = (value: string) =>
    Buffer.byteLength(JSON.stringify(value));
  const convert = (value: unknown, depth: number): unknown => {
    if (++nodes > 1_000_000)
      throw new Error(`${filename}: expanded JSON exceeds 1000000 nodes`);
    if (depth > 128)
      throw new Error(`${filename}: input exceeds 128 levels of nesting`);
    if (
      value === null ||
      typeof value === 'boolean' ||
      typeof value === 'string'
    ) {
      charge(
        typeof value === 'string'
          ? stringBytes(value)
          : value === null
            ? 4
            : value
              ? 4
              : 5,
      );
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      charge(JSON.stringify(value).length);
      return value;
    }
    if (
      typeof value !== 'object' ||
      (!Array.isArray(value) && !(value instanceof Map))
    )
      throw new Error(`${filename}: input contains a non-JSON value`);
    if (ancestors.has(value))
      throw new Error(
        `${filename}: cyclic YAML aliases are not supported; use $ref`,
      );
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        charge(2 + Math.max(0, value.length - 1));
        return value.map((item) => convert(item, depth + 1));
      }
      charge(2 + Math.max(0, value.size - 1) + value.size);
      const result: Record<string, unknown> = {};
      for (const [key, child] of value) {
        if (
          typeof key !== 'string' &&
          !(typeof key === 'number' && Number.isFinite(key))
        )
          throw new Error(
            `${filename}: mapping keys must be strings or finite numbers`,
          );
        const name = String(key);
        if (Object.hasOwn(result, name))
          throw new Error(
            `${filename}: mapping keys collide after JSON conversion`,
          );
        charge(stringBytes(name));
        Object.defineProperty(result, name, {
          value: convert(child, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  };
  return convert(parsed, 0);
}
export const pointerEscape = (segment: string): string =>
  segment.replace(/~/g, '~0').replace(/\//g, '~1');
export function pointerValue(document: unknown, ref: string): unknown {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported reference: ${ref}`);
  let value: unknown = document;
  for (const raw of decodeURIComponent(ref.slice(2)).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key))
      throw new Error(`Unresolved reference: ${ref}`);
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function resolvePointer(
  document: unknown,
  value: unknown,
  chain = new Set<string>(),
): Record<string, unknown> {
  const object = record(value);
  if (typeof object.$ref !== 'string') return object;
  if (chain.has(object.$ref))
    throw new Error(`Circular non-schema reference: ${object.$ref}`);
  if (chain.size >= 64) throw new Error('Reference chain exceeds 64 links');
  const next = new Set(chain).add(object.$ref);
  return {
    ...resolvePointer(document, pointerValue(document, object.$ref), next),
    ...Object.fromEntries(
      Object.entries(object).filter(([key]) => key !== '$ref'),
    ),
  };
}
