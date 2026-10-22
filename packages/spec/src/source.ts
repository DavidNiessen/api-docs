import { open, realpath } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
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
  const [base, target] = await Promise.all([
    realpath(root),
    realpath(resolve(root, path)),
  ]);
  const local = relative(base, target);
  if (local === '..' || local.startsWith(`..${sep}`) || local.startsWith(sep))
    throw new Error(`Path escapes the project: ${path}`);
  return target;
}
/** Bound reads before allocating the entire input, including files that grow after stat. */
export async function readBoundedFile(
  filename: string,
  limit = 16 * 1024 * 1024,
): Promise<Buffer> {
  const file = await open(filename, 'r');
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
  return document.toJS({ maxAliasCount: 50 }) as unknown;
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
