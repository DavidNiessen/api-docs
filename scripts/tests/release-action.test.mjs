import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  readFile,
  writeFile,
  mkdtemp,
  mkdir,
  rm,
  lstat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { parse } from 'yaml';

const exec = promisify(execFile);
const action = parse(
  await readFile(
    new URL(
      '../../.github/actions/prepare-release/action.yml',
      import.meta.url,
    ),
    'utf8',
  ),
);
const script = action.runs.steps[0].run;
const defaults = {
  API_DOCS_CANDIDATE_VERSION: '0.2.0',
  API_DOCS_RELEASE_DATE: '2026-10-22',
  API_DOCS_INITIAL_RELEASE: 'true',
  API_DOCS_RELEASE_BASELINE: '',
  API_DOCS_APPLY_RELEASE: 'false',
};
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-release-action-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('release action rejects ambiguous boolean and baseline inputs before invoking tools', async (t) => {
  const root = await fixture(t);
  for (const fields of [
    { API_DOCS_INITIAL_RELEASE: 'yes' },
    { API_DOCS_APPLY_RELEASE: 'yes' },
    { API_DOCS_INITIAL_RELEASE: 'true', API_DOCS_RELEASE_BASELINE: 'HEAD' },
  ]) {
    await assert.rejects(
      exec('bash', ['-c', script], {
        cwd: root,
        env: { ...process.env, ...defaults, ...fields },
      }),
      (error) => error.code === 1 && error.stdout.includes('::error::'),
    );
    await assert.rejects(
      lstat(join(root, '.api-docs')),
      (error) => error.code === 'ENOENT',
    );
  }
});
test('release action preserves input argument boundaries and never evaluates shell syntax from inputs', async (t) => {
  const root = await fixture(t),
    bin = join(root, 'bin'),
    log = join(root, 'argv.jsonl');
  await mkdir(bin);
  await writeFile(
    join(bin, 'node'),
    '#!' +
      process.execPath +
      '\n' +
      `require('node:fs').appendFileSync(process.env.ARGUMENT_LOG,JSON.stringify(process.argv.slice(2))+'\\n');\n`,
    { mode: 0o700 },
  );
  const version = '1.2.3; touch INJECTED',
    baseline = 'HEAD $(touch INJECTED)';
  await exec('bash', ['-c', script], {
    cwd: root,
    env: {
      ...process.env,
      ...defaults,
      PATH: bin + delimiter + process.env.PATH,
      ARGUMENT_LOG: log,
      API_DOCS_CANDIDATE_VERSION: version,
      API_DOCS_INITIAL_RELEASE: 'false',
      API_DOCS_RELEASE_BASELINE: baseline,
    },
  });
  const calls = (await readFile(log, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.equal(calls.length, 2);
  assert.equal(calls[0][calls[0].indexOf('--version') + 1], version);
  assert.equal(calls[0][calls[0].indexOf('--since') + 1], baseline);
  assert(!calls[0].includes('--initial'));
  assert(!calls[1].includes('--apply'));
  await assert.rejects(
    lstat(join(root, 'INJECTED')),
    (error) => error.code === 'ENOENT',
  );
});
