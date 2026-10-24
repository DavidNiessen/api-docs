import assert from 'node:assert/strict';
import { releaseSource } from './lib/release-assets.mjs';

assert(
  process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === '--publication'),
  'Use check-release-source.mjs [--publication].',
);
const context = await releaseSource(
  process.cwd(),
  process.env,
  process.argv[2] ? { workflow: 'release-publish.yml' } : undefined,
);
console.log(
  `Clean release source: ${context.repository} ${context.ref} ${context.commit}.`,
);
