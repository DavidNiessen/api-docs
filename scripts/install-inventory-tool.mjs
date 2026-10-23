import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, link, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { x as extract } from 'tar';
import { scanner, sha256, verifyScanner } from './lib/container-inventory.mjs';

assert(
  process.platform === 'linux' && process.arch === 'x64',
  'The pinned scanner currently supports Linux x64',
);
const parent = resolve('.api-docs/tools', `syft-${scanner.version}`);
const executable = join(parent, 'syft');
await mkdir(parent, { recursive: true });
try {
  await verifyScanner(executable);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const temporary = await mkdtemp(join(parent, '.download-'));
  try {
    const archive = join(temporary, 'syft.tar.gz');
    await promisify(execFile)(
      'curl',
      [
        '--fail',
        '--show-error',
        '--location',
        '--proto',
        '=https',
        '--proto-redir',
        '=https',
        '--max-time',
        '90',
        '--max-filesize',
        String(64 * 1024 * 1024),
        '--retry',
        '3',
        '--retry-max-time',
        '120',
        '--output',
        archive,
        `https://github.com/anchore/syft/releases/download/v${scanner.version}/syft_${scanner.version}_linux_amd64.tar.gz`,
      ],
      { timeout: 150000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(
      await sha256(archive),
      scanner.archiveSha256,
      'Scanner archive integrity check failed',
    );
    await extract({
      file: archive,
      cwd: temporary,
      strict: true,
      filter: (path, entry) => path === 'syft' && entry.type === 'File',
    });
    const extracted = join(temporary, 'syft');
    await verifyScanner(extracted);
    await chmod(extracted, 0o755);
    try {
      await link(extracted, executable);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await verifyScanner(executable);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
console.log(executable);
