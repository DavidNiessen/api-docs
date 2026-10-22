import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { verifyArtifact } from '@api-docs/compiler';
import type { SiteData } from '@api-docs/contracts';
export const headers: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src http: https:; base-uri 'none'; frame-ancestors 'none'",
  'Cache-Control': 'no-cache',
};
export async function prepare(directory: string, mountPath?: string) {
  const root = resolve(directory);
  const manifest = await verifyArtifact(root);
  const files = new Set(Object.keys(manifest.files));
  if (!files.has('site.json'))
    throw new Error('Publication configuration must be listed in the manifest');
  const site = JSON.parse(
    await readFile(join(root, 'site.json'), 'utf8'),
  ) as SiteData;
  const basePath = mountPath ?? site.config.basePath;
  if (basePath !== site.config.basePath)
    throw new Error('Adapter mount path must match the publication basePath');
  /** Accept a decoded local pathname; directory aliases require a listed index. */
  const allowsPath = (pathname: string) => {
    const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    if (
      !/^[a-zA-Z0-9._/-]*$/.test(path) ||
      path
        .split('/')
        .some(
          (part, index, parts) =>
            part.startsWith('.') || (!part && index !== parts.length - 1),
        )
    )
      return false;
    return (
      files.has(path) ||
      files.has(path + (path && !path.endsWith('/') ? '/' : '') + 'index.html')
    );
  };
  return { root, basePath, allowsPath, hasNotFoundPage: files.has('404.html') };
}
