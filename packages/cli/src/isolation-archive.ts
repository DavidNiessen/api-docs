import { mkdir, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { Parser } from 'tar';
import type { ReadEntry } from 'tar';

function archivePath(value: string, directory: boolean): string | undefined {
  let path = value;
  while (path.startsWith('./')) path = path.slice(2);
  if (directory) path = path.replace(/\/$/, '');
  if (directory && (path === '' || path === '.')) return undefined;
  if (
    !path ||
    path.length > 4096 ||
    path.includes('\\') ||
    Array.from(path).some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) ||
    path.startsWith('/') ||
    /^[a-z]:/i.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Unsafe isolated archive path');
  return path;
}

/** Never lets an archive library create files, links, permissions or ownership. */
export async function extractIsolatedArchive(
  input: Readable,
  target: string,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<string[]> {
  signal?.throwIfAborted();
  const parser = new Parser({
    strict: true,
    maxMetaEntrySize: 64 * 1024,
    brotli: false,
    zstd: false,
  });
  const names = new Set<string>(),
    files: string[] = [];
  const active = new Set<ReadEntry>(),
    pending = new Set<Promise<void>>();
  let wireBytes = 0,
    declaredBytes = 0,
    actualBytes = 0,
    entries = 0,
    eof = false;
  let first = Buffer.alloc(0),
    checked = false,
    failure: Error | undefined;
  let rejectEnd: (error: Error) => void = () => {};
  let work = Promise.resolve();
  const complete = new Promise<void>((resolve, reject) => {
    rejectEnd = reject;
    parser.once('end', resolve);
  });
  void complete.catch(() => {});
  function fail() {
    if (failure) return;
    failure = new Error(
      'Isolated output archive failed bounded file verification',
    );
    for (const entry of active) entry.destroy(failure);
    input.destroy(failure);
    parser.abort(failure);
    rejectEnd(failure);
  }
  async function entryFile(entry: ReadEntry) {
    active.add(entry);
    try {
      if (
        ++entries > 50_000 ||
        !['File', 'Directory'].includes(entry.type) ||
        entry.linkpath ||
        !Number.isSafeInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > 64 * 1024 * 1024
      )
        throw new Error('Invalid isolated archive entry');
      const extra = { ...entry.extended, ...entry.globalExtended };
      const metadata = new Set([
        'path',
        'size',
        'mtime',
        'atime',
        'ctime',
        'uid',
        'gid',
        'uname',
        'gname',
        'linkpath',
        'dev',
        'ino',
        'nlink',
        'charset',
        'comment',
        'global',
        'mode',
      ]);
      if (Object.keys(extra).some((key) => !metadata.has(key)))
        throw new Error('Sparse archives are unsupported');
      const directory = entry.type === 'Directory';
      if (directory && entry.size !== 0)
        throw new Error('Invalid archive directory');
      const path = archivePath(entry.path, directory);
      if (path === undefined) {
        entry.resume();
        return;
      }
      if (names.has(path)) throw new Error('Duplicate archive path');
      names.add(path);
      const destination = join(target, path);
      if (directory) {
        await mkdir(destination, { recursive: true, mode: 0o700 });
        entry.resume();
        return;
      }
      declaredBytes += entry.size;
      if (declaredBytes > maxBytes)
        throw new Error('Isolated output exceeds its byte limit');
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      const file = await open(destination, 'wx', 0o600);
      let size = 0;
      try {
        for await (const chunk of entry) {
          signal?.throwIfAborted();
          size += chunk.length;
          actualBytes += chunk.length;
          if (size > entry.size || actualBytes > maxBytes)
            throw new Error('Archive entry exceeds its declared size');
          await file.writeFile(chunk);
        }
        if (size !== entry.size) throw new Error('Truncated archive entry');
      } finally {
        await file.close();
      }
      files.push(path);
    } finally {
      active.delete(entry);
    }
  }
  parser.on('eof', () => {
    eof = true;
  });
  parser.on('error', fail);
  parser.on('ignoredEntry', fail);
  parser.on('entry', (entry: ReadEntry) => {
    entry.on('error', fail);
    // Zero-length entries can end before their asynchronous file creation does.
    // Serialize filesystem work so an archive cannot open thousands of files at once.
    const task = work.then(() => {
      if (failure) throw failure;
      return entryFile(entry);
    });
    work = task.catch(() => {});
    pending.add(task);
    void task.then(
      () => pending.delete(task),
      () => {
        pending.delete(task);
        fail();
      },
    );
  });
  const abort = () => fail();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for await (const chunk of input) {
      signal?.throwIfAborted();
      wireBytes += chunk.length;
      if (wireBytes > maxBytes + 64 * 1024 * 1024)
        throw new Error('Archive framing exceeds its byte limit');
      let data = Buffer.from(chunk);
      if (!checked) {
        first = Buffer.concat([first, data]);
        if (first.length < 4) continue;
        if (
          (first[0] === 0x1f && first[1] === 0x8b) ||
          first.readUInt32LE(0) === 0xfd2fb528
        )
          throw new Error('Compressed output archives are unsupported');
        checked = true;
        data = first;
        first = Buffer.alloc(0);
      }
      const flowing = parser.write(data);
      if (failure) throw failure;
      if (!flowing && !eof) {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            parser.removeListener('drain', ready);
            parser.removeListener('eof', ready);
            parser.removeListener('error', error);
          };
          const ready = () => {
            cleanup();
            resolve();
          };
          const error = () => {
            cleanup();
            reject(failure ?? new Error('Archive parser failed'));
          };
          parser.once('drain', ready);
          parser.once('eof', ready);
          parser.once('error', error);
        });
      }
    }
    parser.end();
    await complete;
    await Promise.all(pending);
    if (failure || !checked || !eof)
      throw new Error('Incomplete output archive');
    return files;
  } catch {
    fail();
    await Promise.allSettled(pending);
    throw failure;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
