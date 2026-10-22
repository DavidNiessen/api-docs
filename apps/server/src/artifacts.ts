import { artifactIdentity } from '@api-docs/compiler';
import { confinedPath, readTextFile } from '@api-docs/spec';
import type { ArtifactManifest } from '@api-docs/contracts';
interface CachedPublication {
  readonly directory: string;
  readonly hasFile: (path: string) => boolean;
}
/** Cache immutable metadata only. Project permissions and active pointers are never cached here. */
export class PublicationManifestCache {
  private readonly entries = new Map<
    string,
    { value: CachedPublication; bytes: number }
  >();
  private readonly pending = new Map<string, Promise<CachedPublication>>();
  private bytes = 0;
  constructor(
    private readonly root: string,
    private readonly maxBytes = 32 * 1024 * 1024,
    private readonly maxEntries = 16,
  ) {
    if (
      !Number.isSafeInteger(maxBytes) ||
      !Number.isSafeInteger(maxEntries) ||
      maxBytes < 1 ||
      maxEntries < 1
    )
      throw new Error('Publication cache budgets must be positive integers');
  }
  stats() {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      pending: this.pending.size,
    };
  }
  async get(id: string): Promise<CachedPublication> {
    if (!/^[a-f0-9]{64}$/.test(id))
      throw new Error('Invalid artifact identity');
    const cached = this.entries.get(id);
    if (cached) {
      this.entries.delete(id);
      this.entries.set(id, cached);
      return cached.value;
    }
    const pending = this.pending.get(id);
    if (pending) return await pending;
    if (this.pending.size >= 64)
      throw new Error('Publication metadata load capacity exceeded');
    const loading = this.load(id);
    this.pending.set(id, loading);
    try {
      return await loading;
    } finally {
      this.pending.delete(id);
    }
  }
  private async load(id: string): Promise<CachedPublication> {
    const directory = await confinedPath(this.root, id);
    const source = await readTextFile(
      await confinedPath(directory, 'manifest.json'),
    );
    const bytes = Buffer.byteLength(source);
    if (bytes > this.maxBytes)
      throw new Error('Publication manifest exceeds cache budget');
    const manifest = JSON.parse(source) as ArtifactManifest;
    if (
      manifest.schemaVersion !== 1 ||
      !manifest.files ||
      Array.isArray(manifest.files) ||
      !Array.isArray(manifest.routes) ||
      manifest.artifactDigest !== id ||
      artifactIdentity(manifest) !== id ||
      Object.values(manifest.files).some(
        (hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash),
      )
    )
      throw new Error('Invalid publication manifest identity');
    const files = new Set(Object.keys(manifest.files));
    const value = Object.freeze({
      directory,
      hasFile: (path: string) => files.has(path),
    });
    while (
      this.entries.size >= this.maxEntries ||
      this.bytes + bytes > this.maxBytes
    ) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.bytes -= this.entries.get(oldest)!.bytes;
      this.entries.delete(oldest);
    }
    this.entries.set(id, { value, bytes });
    this.bytes += bytes;
    return value;
  }
}
