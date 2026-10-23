import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { inc } from 'semver';
import { gitFixture, BASE_VERSION } from './tests/helpers/release-fixture.mjs';
import { createReleasePlan } from './lib/release-plan.mjs';
import { prepareRelease } from './lib/release-prepare.mjs';

const cleanup = [];
try {
  const root = await gitFixture({
    after(fn) {
      cleanup.push(fn);
    },
  });
  const plan = await createReleasePlan(root, {
    initial: true,
    date: '2026-10-23',
    version: inc(BASE_VERSION, 'minor'),
  });
  await prepareRelease(root, plan, { apply: true });
  const before = await readFile(root + '/pnpm-lock.yaml', 'utf8');
  await promisify(execFile)(
    'pnpm',
    [
      'install',
      '--lockfile-only',
      '--frozen-lockfile',
      '--ignore-scripts',
      '--store-dir',
      root + '/.pnpm-store',
    ],
    { cwd: root, timeout: 60000 },
  );
  assert.equal(
    await readFile(root + '/pnpm-lock.yaml', 'utf8'),
    before,
    'pnpm rewrote prepared release metadata.',
  );
  console.log(
    'Prepared release retains its canonical frozen pnpm lockfile with registry policy checks.',
  );
} finally {
  for (const remove of cleanup.reverse()) await remove();
}
