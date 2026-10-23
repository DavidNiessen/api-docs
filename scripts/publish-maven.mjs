import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readRegularFile } from './lib/read-regular-file.mjs';
import { releaseSource } from './lib/release-assets.mjs';
import {
  inspectMavenPublication,
  loadMavenPublication,
  publishCentralBundle,
  signMavenBundle,
} from './lib/maven-publication.mjs';

assert.equal(process.argv.length, 2);
const root = process.cwd();
const source = await releaseSource(root, process.env, {
  workflow: 'release-publish.yml',
});
const plan = JSON.parse(
  await readRegularFile(join(root, '.api-docs/publication/plan.json')),
);
assert.equal(plan.publicationRunId, source.runId);
assert.equal(plan.publicationRunAttempt, source.runAttempt);
assert(plan.environmentProtection?.reviewers > 0);
assert.equal(plan.environmentProtection.tagPolicy, 'v*');
const context = { ...source, runId: plan.runId, runAttempt: plan.runAttempt };
const candidate = await loadMavenPublication(root, context, plan);
const output = join(root, '.api-docs/publication/maven');
await mkdir(output, { recursive: true });
const state = await inspectMavenPublication(candidate);
if (state.exists) {
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        ...context,
        complete: true,
        reused: true,
        files: candidate.files,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
} else {
  const bundle = await signMavenBundle(candidate, output);
  await publishCentralBundle(bundle, {
    version: source.version,
    token: process.env.MAVEN_CENTRAL_TOKEN,
    receiptPath: join(output, 'result.json'),
  });
}
assert.deepEqual(
  await releaseSource(root, process.env, { workflow: 'release-publish.yml' }),
  source,
);
console.log(
  'Maven publication is complete. Independent public signature/download and fresh consumer acceptance remain required.',
);
