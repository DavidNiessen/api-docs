import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { ArtifactManifest } from '@api-docs/contracts';
import { record } from '@api-docs/spec';
export const digest = (source: string | Buffer): string =>
  createHash('sha256').update(source).digest('hex');
export function artifactIdentity(
  manifest: Omit<ArtifactManifest, 'artifactDigest'>,
): string {
  return digest(
    JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      compilerVersion: manifest.compilerVersion,
      inputDigest: manifest.inputDigest,
      files: Object.fromEntries(
        Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b)),
      ),
      routes: manifest.routes,
      diagnostics: manifest.diagnostics,
      plugins: manifest.plugins ?? [],
    }),
  );
}
const hash = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const string = (value: unknown, limit: number) =>
  typeof value === 'string' && value.length > 0 && value.length <= limit;
const safePath = (value: string) =>
  value.length <= 4096 &&
  /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(value) &&
  value.split('/').every((part) => part.length > 0 && !part.startsWith('.'));
/** Parse identity-bearing metadata before any path is trusted or cached. */
export function parseArtifactManifest(value: unknown): ArtifactManifest {
  const manifest = record(value),
    files = record(manifest.files);
  const keys = new Set([
    'schemaVersion',
    'compilerVersion',
    'inputDigest',
    'artifactDigest',
    'files',
    'routes',
    'diagnostics',
    'plugins',
  ]);
  if (
    Object.keys(manifest).some((key) => !keys.has(key)) ||
    manifest.schemaVersion !== 1 ||
    !string(manifest.compilerVersion, 128) ||
    !hash(manifest.inputDigest) ||
    !hash(manifest.artifactDigest) ||
    !manifest.files ||
    typeof manifest.files !== 'object' ||
    Array.isArray(manifest.files) ||
    Object.keys(files).length > 200_000 ||
    Object.entries(files).some(
      ([path, value]) => !safePath(path) || !hash(value),
    ) ||
    !Array.isArray(manifest.routes) ||
    manifest.routes.length > 100_000 ||
    manifest.routes.some(
      (route) =>
        typeof route !== 'string' ||
        (route !== '/' &&
          (!route.startsWith('/') ||
            !safePath(route.slice(1).replace(/\/$/, '')))),
    ) ||
    new Set(manifest.routes).size !== manifest.routes.length ||
    !Array.isArray(manifest.diagnostics) ||
    manifest.diagnostics.length > 10_000 ||
    manifest.diagnostics.some((value) => {
      const item = record(value);
      return (
        !string(item.code, 200) ||
        !['warning', 'error'].includes(String(item.severity)) ||
        !string(item.message, 12_000) ||
        (item.source !== undefined && !string(item.source, 4096))
      );
    }) ||
    !Array.isArray(manifest.plugins) ||
    manifest.plugins.length > 32 ||
    manifest.plugins.some((value) => {
      const plugin = record(value);
      return (
        !string(plugin.name, 214) ||
        !string(plugin.version, 128) ||
        (plugin.sourceDigest !== undefined && !hash(plugin.sourceDigest)) ||
        (plugin.inputs !== undefined &&
          (!Array.isArray(plugin.inputs) ||
            plugin.inputs.length > 129 ||
            plugin.inputs.some((value) => {
              const item = record(value);
              return !string(item.path, 4096) || !hash(item.digest);
            })))
      );
    })
  )
    throw new Error('Invalid artifact manifest metadata');
  const result = manifest as unknown as ArtifactManifest;
  if (artifactIdentity(result) !== result.artifactDigest)
    throw new Error('Artifact manifest identity mismatch');
  return result;
}
/** Streaming verification bounds memory and rejects files that change size during the read. */
export async function digestFile(filename: string): Promise<string> {
  const file = await open(
    filename,
    constants.O_RDONLY |
      (constants.O_NONBLOCK ?? 0) |
      (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const info = await file.stat();
    if (!info.isFile())
      throw new Error('Artifact entries must be regular files');
    const hash = createHash('sha256');
    let bytes = 0;
    if (info.size <= 1024 * 1024) {
      const buffer = Buffer.allocUnsafe(info.size + 1);
      while (bytes < buffer.length) {
        const { bytesRead } = await file.read(
          buffer,
          bytes,
          buffer.length - bytes,
        );
        if (!bytesRead) break;
        bytes += bytesRead;
      }
      if (bytes !== info.size)
        throw new Error('Artifact file changed size during verification');
      return hash.update(buffer.subarray(0, bytes)).digest('hex');
    }
    for await (const chunk of file.createReadStream({
      autoClose: false,
      highWaterMark: 64 * 1024,
    })) {
      bytes += chunk.length;
      if (bytes > info.size)
        throw new Error('Artifact file grew during verification');
      hash.update(chunk);
    }
    if (bytes !== info.size)
      throw new Error('Artifact file changed size during verification');
    return hash.digest('hex');
  } finally {
    await file.close();
  }
}
