import assert from 'node:assert/strict';
import { join } from 'node:path';
import { releaseSource, verifyReleaseAssets } from './lib/release-assets.mjs';

assert.equal(
  process.argv.length,
  2,
  'Use verify-release-assets.mjs without arguments.',
);
const context = await releaseSource(process.cwd());
for (const kind of ['npm', 'java', 'container']) {
  const directory = join('.api-docs/release-assets', kind);
  const manifest = await verifyReleaseAssets(directory, context, kind);
  console.log(
    `${kind}: ${manifest.files.length} exact assets bound to ${context.ref}, run ${context.runId}/${context.runAttempt}.`,
  );
}
console.log(
  'Checksums and source bindings verified. Verify producer attestations separately; this is not publication approval.',
);
