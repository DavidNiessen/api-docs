import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { inc, prerelease } from 'semver';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  canonicalVersion,
  createReleasePlan,
  git,
  githubRepository,
  parseReleaseCommit,
  recommendReleaseVersion,
  renderReleaseNotes,
} from '../lib/release-plan.mjs';
import {
  BASE_VERSION,
  fixture,
  gitFixture as repository,
  fixtureGit as g,
} from './helpers/release-fixture.mjs';

const hash = 'a'.repeat(40);
const commit = (subject, body = '') =>
  parseReleaseCommit({ hash, subject, body });
const addCommit = (root, subject, body) =>
  g(root, [
    'commit',
    '--allow-empty',
    '-m',
    subject,
    ...(body ? ['-m', body] : []),
  ]);

test('canonical SemVer excludes ambiguous versions and build metadata', () => {
  for (const value of ['0.1.0', '1.2.3-rc.1', '2.0.0'])
    assert(canonicalVersion(value));
  for (const value of ['v1.0.0', '01.0.0', '1.0', '1.0.0+local', '', null])
    assert(!canonicalVersion(value));
});
test('parses scoped commits, bang changes and multiline breaking footers', () => {
  assert.deepEqual(commit('feat(reader)!: replace layouts'), {
    hash,
    type: 'feat',
    scope: 'reader',
    description: 'replace layouts',
    breaking: true,
    notes: ['replace layouts'],
  });
  const parsed = commit(
    'fix: align routes',
    'BREAKING CHANGE: migrate the old routes\n\nKeep the migration guide.\n\nSigned-off-by: Example <test@example.test>',
  );
  assert.equal(parsed.breaking, true);
  assert.deepEqual(parsed.notes, [
    'migrate the old routes\n\nKeep the migration guide.',
  ]);
  assert.equal(commit('docs: update instructions').breaking, false);
  for (const value of [
    'Merge branch test',
    'unknown: unsupported type',
    'feat: ',
  ])
    assert.equal(commit(value), undefined);
  assert.throws(
    () => parseReleaseCommit({ hash: 'bad', subject: 'feat: value' }),
    /object ID/,
  );
  assert.throws(() => commit('feat: value', 'a'.repeat(65537)), /limits/);
});
for (const [current, base, subject, expected, bump] of [
  ['1.2.3', '1.2.3', 'feat: new feature', '1.3.0', 'minor'],
  ['1.2.3', '1.2.3', 'fix: repair request', '1.2.4', 'patch'],
  ['1.2.3', '1.2.3', 'perf: accelerate search', '1.2.4', 'patch'],
  ['1.2.3', '1.2.3', 'revert: undo a change', '1.2.4', 'patch'],
  ['1.2.3', '1.2.3', 'feat!: replace API', '2.0.0', 'major'],
  ['0.2.3', '0.2.3', 'feat!: replace API', '0.3.0', 'minor'],
  ['0.3.0', '0.2.3', 'feat: already prepared', '0.3.0', 'minor'],
  ['1.3.0-rc.2', '1.2.3', 'feat: next candidate', '1.3.0-rc.3', 'prerelease'],
  ['1.2.3', '1.2.3', 'docs: change examples', null, 'none'],
])
  test(`version recommendation: ${subject} on ${current}`, () => {
    assert.deepEqual(
      recommendReleaseVersion(current, base, [commit(subject)]),
      { bump, recommendedVersion: expected, targetVersion: expected },
    );
  });
test('initial and explicit versions remain reviewable, prereleases never promote implicitly', () => {
  assert.equal(
    recommendReleaseVersion('0.1.0', undefined, [commit('feat!: new API')], {
      initial: true,
    }).targetVersion,
    '0.1.0',
  );
  assert.equal(
    recommendReleaseVersion(
      '1.0.0-rc.1',
      '0.9.0',
      [commit('feat: stabilize')],
      { version: '1.0.0' },
    ).targetVersion,
    '1.0.0',
  );
  assert.equal(
    recommendReleaseVersion('0.2.0', '0.1.0', [commit('chore: metadata')])
      .targetVersion,
    '0.2.0',
  );
  assert.throws(
    () => recommendReleaseVersion('1.0.0', '2.0.0', []),
    /cannot precede/,
  );
  assert.throws(
    () => recommendReleaseVersion('1.0.0', undefined, [], { version: '0.9.0' }),
    /at or above/,
  );
});
test('GitHub links strip credentials and exclude unsupported origins', () => {
  for (const origin of [
    'https://github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
    'https://secret:credential@github.com/owner/repo.git',
  ])
    assert.equal(githubRepository(origin), 'https://github.com/owner/repo');
  for (const origin of [
    'https://github.com.evil.test/owner/repo',
    'file:///tmp/repo',
    'https://github.com/owner/repo?token=private',
    undefined,
  ])
    assert.equal(githubRepository(origin), undefined);
});
test('release notes group changes and escape Markdown, HTML and scope text', () => {
  const notes = renderReleaseNotes({
    targetVersion: '1.0.0',
    date: '2026-10-22',
    repository: 'https://github.com/owner/repo',
    baseTag: 'v0.9.0',
    commits: [
      commit('feat(ui): add <script> [link](https://evil.test)'),
      commit('fix: repair API'),
      commit('perf: reduce memory'),
      commit('docs: explain usage'),
      commit('chore!: new config', 'BREAKING CHANGE: migrate <config>'),
    ],
  });
  for (const name of [
    'Breaking changes',
    'Features',
    'Fixes',
    'Performance',
    'Documentation',
  ])
    assert(notes.includes('### ' + name));
  assert(!notes.includes('<script>'));
  assert(notes.includes('&lt;script&gt;'));
  assert(notes.includes('\\[link\\]\\(https://evil\\.test\\)'));
  assert(
    notes.includes('https://github.com/owner/repo/compare/v0.9.0...v1.0.0'),
  );
  assert.equal(renderReleaseNotes({ targetVersion: null }), '');
});
test('initial plans use real Git history, report unclassified messages and never mutate the checkout', async (t) => {
  const root = await repository(t);
  await addCommit(root, 'feat(reader): add playground');
  await addCommit(root, 'Original bootstrap message');
  await g(root, [
    'remote',
    'add',
    'origin',
    'https://user:private-value@github.com/owner/repo.git',
  ]);
  const before = await git(root, [
    'status',
    '--porcelain',
    '--untracked-files=all',
  ]);
  const lock = await readFile(join(root, 'package-lock.json'), 'utf8');
  const plan = await createReleasePlan(root, {
    initial: true,
    date: '2026-10-22',
  });
  assert.equal(plan.currentVersion, BASE_VERSION);
  assert.equal(plan.targetVersion, BASE_VERSION);
  assert.equal(plan.sourceWorkingTreeDirty, false);
  assert.equal(plan.commits.length, 2);
  assert.equal(plan.unclassified.length, 1);
  assert.equal(plan.repository, 'https://github.com/owner/repo');
  assert(!JSON.stringify(plan).includes('private-value'));
  assert(plan.notes.includes('add playground'));
  assert.deepEqual(
    await createReleasePlan(root, { initial: true, date: '2026-10-22' }),
    plan,
  );
  assert.equal(
    await git(root, ['status', '--porcelain', '--untracked-files=all']),
    before,
  );
  assert.equal(await readFile(join(root, 'package-lock.json'), 'utf8'), lock);
  assert.equal((await git(root, ['tag', '--list'])).trim(), '');
});
test('plans select the highest merged SemVer tag and report later commits only', async (t) => {
  const root = await repository(t);
  await g(root, ['tag', '-a', 'v' + BASE_VERSION, '-m', 'test baseline']);
  await g(root, ['tag', 'v0.0.0']);
  await addCommit(root, 'fix(cli): repair output');
  const plan = await createReleasePlan(root, { date: '2026-10-22' });
  assert.equal(plan.baseTag, 'v' + BASE_VERSION);
  assert.equal(plan.commits.length, 1);
  assert.equal(
    plan.targetVersion,
    inc(BASE_VERSION, prerelease(BASE_VERSION) ? 'prerelease' : 'patch'),
  );
  assert(plan.notes.includes('/compare/') === false); // No origin means no invented hosting links.
  await assert.rejects(
    createReleasePlan(root, { initial: true }),
    /requires no merged/,
  );
  const since = await createReleasePlan(root, {
    since: 'v' + BASE_VERSION,
    date: '2026-10-22',
  });
  assert.equal(since.baseTag, plan.baseTag);
  assert.equal(since.sourceCommit, plan.sourceCommit);
});
test('missing baselines, invalid dates and ref arguments fail without mutation', async (t) => {
  const root = await repository(t);
  await assert.rejects(createReleasePlan(root), /No merged release tag/);
  for (const date of ['2026-02-30', '0000-01-01', '2026-2-01'])
    await assert.rejects(
      createReleasePlan(root, { initial: true, date }),
      /real YYYY/,
    );
  await assert.rejects(
    createReleasePlan(root, { initial: true, since: 'HEAD' }),
    /not both/,
  );
  for (const since of ['', 'HEAD\nmain', '--help'])
    await assert.rejects(createReleasePlan(root, { since }));
  assert.equal((await git(root, ['status', '--porcelain'])).trim(), '');
});
test('explicit ancestor refs work and unrelated or existing target refs fail', async (t) => {
  const root = await repository(t);
  const base = (await git(root, ['rev-parse', 'HEAD'])).trim();
  await addCommit(root, 'feat: add API');
  const plan = await createReleasePlan(root, { since: base });
  assert.equal(plan.baseCommit, base);
  assert.equal(plan.baseTag, undefined);
  assert.equal(plan.commits.length, 1);
  const source = plan.sourceCommit;
  await g(root, ['checkout', '--orphan', 'other']);
  await g(root, ['commit', '-m', 'chore: unrelated root']);
  const other = (await git(root, ['rev-parse', 'HEAD'])).trim();
  await g(root, ['checkout', '--detach', source]);
  await assert.rejects(
    createReleasePlan(root, { since: other }),
    /must be an ancestor/,
  );
  await g(root, ['tag', 'v' + plan.targetVersion, other]);
  await assert.rejects(
    createReleasePlan(root, { since: base, version: plan.targetVersion }),
    /already exists/,
  );
});
test('dirty metadata is reported and a changed distribution fails before planning', async (t) => {
  const root = await repository(t);
  await writeFile(join(root, 'untracked.txt'), 'local work');
  assert.equal(
    (await createReleasePlan(root, { initial: true })).sourceWorkingTreeDirty,
    true,
  );
  const path = join(root, 'packages/contracts/package.json'),
    data = JSON.parse(await readFile(path, 'utf8'));
  data.version = inc(BASE_VERSION, 'major');
  await writeFile(path, JSON.stringify(data));
  await assert.rejects(
    createReleasePlan(root, { initial: true }),
    /version drift/,
  );
});
test('shallow repositories are rejected rather than inferring an incomplete release history', async (t) => {
  const source = await repository(t),
    parent = await fixture(t),
    root = join(parent, 'clone');
  await mkdir(root);
  await git(parent, ['clone', '--depth=1', 'file://' + source, root]);
  await assert.rejects(
    createReleasePlan(root, { initial: true }),
    /full clone/,
  );
});

test('an empty tagged range proposes no release and produces no notes', async (t) => {
  const root = await repository(t);
  await g(root, ['tag', 'v' + BASE_VERSION]);
  const plan = await createReleasePlan(root, { date: '2026-10-22' });
  assert.equal(plan.bump, 'none');
  assert.equal(plan.targetVersion, null);
  assert.equal(plan.notes, '');
  assert.deepEqual(plan.commits, []);
});
test('command help and errors have usable output and preserve failure exit codes', async () => {
  const exec = promisify(execFile),
    cli = fileURLToPath(new URL('../release-plan.mjs', import.meta.url));
  const help = await exec(process.execPath, [cli, '--help']);
  assert(help.stdout.includes('never edits files'));
  for (const args of [['--initial', '--date', '2026-02-30'], ['--unknown']])
    await assert.rejects(
      exec(process.execPath, [cli, ...args]),
      (error) =>
        error.code === 1 &&
        error.stderr.length > 0 &&
        !error.stderr.includes('at file:'),
    );
});
