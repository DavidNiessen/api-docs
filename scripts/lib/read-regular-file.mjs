import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

/** Inspect and read one descriptor, refusing symlinks, special files and growing input. */
export async function readRegularFile(
  path,
  maximum = 1024 * 1024,
  message = 'Invalid or excessive regular file.',
) {
  assert(
    Number.isSafeInteger(maximum) && maximum > 0 && maximum <= 64 * 1024 * 1024,
  );
  const file = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const metadata = await file.stat();
    assert(metadata.isFile() && metadata.size <= maximum, message);
    const chunks = [];
    let total = 0;
    for (;;) {
      const buffer = Buffer.allocUnsafe(
        Math.min(64 * 1024, maximum - total + 1),
      );
      const { bytesRead } = await file.read(buffer);
      if (!bytesRead) return Buffer.concat(chunks, total);
      total += bytesRead;
      assert(total <= maximum, message);
      chunks.push(buffer.subarray(0, bytesRead));
    }
  } finally {
    await file.close();
  }
}
