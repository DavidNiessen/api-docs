import { createHash } from 'node:crypto';
import { z } from 'zod';
export const REFERENCE_BYTES = 16 * 1024 * 1024;
export const REFERENCE_TIMEOUT = 30_000;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export function canonicalReferenceUrl(value: string): string {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    value !== value.trim() ||
    value.includes('\\') ||
    Array.from(value).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error('Invalid reference source URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid reference source URL');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash ||
    value.includes('#') ||
    url.hostname.includes('*')
  )
    throw new Error(
      'Reference sources require HTTP(S) URLs without credentials or fragments',
    );
  return url.href;
}
const sourceUrl = z
  .string()
  .max(4096)
  .transform((value, ctx) => {
    try {
      return canonicalReferenceUrl(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid reference source URL' });
      return z.NEVER;
    }
  });
const source = z.object({ url: sourceUrl, sha256: hash }).strict();
const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    root: sourceUrl,
    sources: z.array(source).min(1).max(9),
  })
  .strict();
export interface ReferencePolicy {
  schemaVersion: 1;
  root: string;
  sources: { url: string; sha256: string }[];
}
export function parseReferencePolicy(input: unknown): ReferencePolicy {
  const value = policySchema.safeParse(input);
  if (!value.success) throw new Error('Invalid pinned reference policy');
  const policy = value.data;
  if (
    new Set(policy.sources.map((source) => source.url)).size !==
      policy.sources.length ||
    !policy.sources.some((source) => source.url === policy.root)
  )
    throw new Error(
      'Reference policy needs distinct sources including the root',
    );
  return policy;
}
export interface ReferenceDocument {
  url: string;
  path: string;
  sha256: string;
  bytes: number;
}
export interface ReferenceManifest {
  schemaVersion: 1;
  root: string;
  documents: ReferenceDocument[];
  digest: string;
}
export function referenceDigest(
  manifest: Pick<ReferenceManifest, 'root' | 'documents'>,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: 1,
        root: manifest.root,
        documents: manifest.documents.map(({ url, path, sha256, bytes }) => ({
          url,
          path,
          sha256,
          bytes,
        })),
      }),
    )
    .digest('hex');
}
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    root: sourceUrl,
    documents: z
      .array(
        z
          .object({
            url: sourceUrl,
            path: z.string().regex(/^source-[0-8]\.yaml$/),
            sha256: hash,
            bytes: z.number().int().min(0).max(REFERENCE_BYTES),
          })
          .strict(),
      )
      .min(1)
      .max(9),
    digest: hash,
  })
  .strict();
export function parseReferenceManifest(input: unknown): ReferenceManifest {
  const value = manifestSchema.safeParse(input);
  if (!value.success) throw new Error('Invalid reference snapshot manifest');
  const manifest = value.data;
  if (
    manifest.documents[0]?.url !== manifest.root ||
    manifest.documents.some(
      (document, index) => document.path !== `source-${index}.yaml`,
    ) ||
    new Set(manifest.documents.map((document) => document.url)).size !==
      manifest.documents.length ||
    manifest.documents.reduce((sum, document) => sum + document.bytes, 0) >
      REFERENCE_BYTES ||
    referenceDigest(manifest) !== manifest.digest
  )
    throw new Error('Reference snapshot manifest integrity failed');
  return manifest;
}
