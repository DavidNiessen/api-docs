import assert from 'node:assert/strict';
import { releaseSource } from './lib/release-assets.mjs';

assert.equal(
  process.argv.length,
  2,
  'Use check-release-source.mjs without arguments.',
);
const context = await releaseSource(process.cwd());
console.log(
  `Clean release source: ${context.repository} ${context.ref} ${context.commit}.`,
);
