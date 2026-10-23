import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessCodeScanning } from './lib/code-scanning.mjs';

const files = process.argv.slice(2);
assert(
  files.length > 0 && files.length <= 8,
  'Supply current CodeQL SARIF files.',
);
assert.equal(new Set(files.map((file) => resolve(file))).size, files.length);
const results = [];
for (const file of files) {
  const info = await lstat(file);
  assert(
    info.isFile() && !info.isSymbolicLink() && info.size <= 64 * 1024 * 1024,
  );
  const bytes = await readFile(file);
  results.push({
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    assessment: assessCodeScanning(JSON.parse(bytes)),
  });
}
const report = {
  schemaVersion: 1,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  passed: results.every((result) => result.assessment.passed),
  results,
};
await mkdir('.api-docs', { recursive: true });
await writeFile(
  '.api-docs/code-scanning-evidence.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
