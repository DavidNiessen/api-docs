import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { clearJavaResults, readJavaResults } from './lib/java-results.mjs';

const java = fileURLToPath(new URL('../integrations/java/', import.meta.url));
if (process.argv[2] === '--clear') {
  assert.equal(process.argv.length, 3);
  await clearJavaResults(java);
  console.log('Removed generated Java test reports before execution.');
} else {
  assert.equal(
    process.argv.length,
    2,
    'Use --clear before Maven and no arguments afterwards.',
  );
  const suites = await readJavaResults(java);
  console.log(
    `Java checks passed: ${suites.reduce((total, suite) => total + suite.tests, 0)} tests across ${suites.length} suites, no failures or skips.`,
  );
}
