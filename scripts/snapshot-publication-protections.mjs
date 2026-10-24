import { lstat, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { format, resolveConfig } from 'prettier';
import { protectionApi, protectionRepository } from './lib/protection-api.mjs';
import {
  createPublicationProtectionSnapshot,
  readPublicationProtectionMetadata,
} from './lib/publication-protection.mjs';
import { validatePublicationEnvironment } from './lib/publication-policy.mjs';

assert.equal(
  process.argv.length,
  2,
  'Use snapshot-publication-protections.mjs without arguments.',
);
const root = fileURLToPath(new URL('../', import.meta.url));
const repository = await protectionRepository(root);
const metadata = await readPublicationProtectionMetadata(
  protectionApi(repository),
);
validatePublicationEnvironment(metadata.environment, metadata.policies);
const snapshot = createPublicationProtectionSnapshot(
  repository,
  metadata.branch,
  metadata.tags,
);
const output = fileURLToPath(
  new URL('../publication-protections.json', import.meta.url),
);
try {
  const info = await lstat(output);
  assert(
    info.isFile() && !info.isSymbolicLink(),
    'Protection snapshot must be a regular file.',
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const temporary = output + '-' + randomUUID() + '.tmp';
try {
  await writeFile(
    temporary,
    await format(JSON.stringify(snapshot), {
      ...(await resolveConfig(output)),
      parser: 'json',
    }),
    { flag: 'wx', mode: 0o644 },
  );
  await rename(temporary, output);
} finally {
  await rm(temporary, { force: true });
}
console.log(
  JSON.stringify(
    {
      repository,
      output,
      branchUpdatedAt: snapshot.branch.updated_at,
      tagsUpdatedAt: snapshot.tags.updated_at,
      next: 'Review and commit this snapshot; test a matching new candidate.',
    },
    null,
    2,
  ),
);
