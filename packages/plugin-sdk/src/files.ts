import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
export interface PluginInput {
  path: string;
  digest: string;
}
export async function pluginFile(
  root: string,
  input: string,
): Promise<{ filename: string; metadata: PluginInput; bytes: number }> {
  if (!input || input.includes('\0'))
    throw new Error('Invalid plugin input path');
  const filename = await realpath(resolve(root, input));
  const path = relative(root, filename);
  if (
    path === '..' ||
    path.startsWith('../') ||
    path.startsWith('..\\') ||
    isAbsolute(path)
  )
    throw new Error('Plugin input escapes project directory');
  const file = await open(
    filename,
    constants.O_RDONLY |
      (constants.O_NONBLOCK ?? 0) |
      (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 16 * 1024 * 1024)
      throw new Error(
        'Plugin inputs must be regular files smaller than 16 MiB',
      );
    const hash = createHash('sha256');
    let size = 0;
    for await (const chunk of file.createReadStream()) {
      size += chunk.length;
      if (size > 16 * 1024 * 1024)
        throw new Error('Plugin input grew beyond 16 MiB');
      hash.update(chunk);
    }
    return {
      filename,
      bytes: size,
      metadata: {
        path: path.split('\\').join('/'),
        digest: hash.digest('hex'),
      },
    };
  } finally {
    await file.close();
  }
}
export const pluginDigest = (inputs: PluginInput[]) =>
  createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
