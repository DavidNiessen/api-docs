import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { CommitParser } from 'conventional-commits-parser';
import { gt, gte, inc, parse, prerelease, rcompare, valid } from 'semver';
import { auditReleaseVersions } from './release-versions.mjs';

const exec = promisify(execFile);
const types = new Set([
  'feat',
  'fix',
  'perf',
  'revert',
  'docs',
  'chore',
  'build',
  'ci',
  'test',
  'refactor',
  'style',
]);
const parser = new CommitParser({
  headerPattern: /^(\w+)(?:\(([^)\r\n]+)\))?!?: (\S[^\r\n]*)$/,
  breakingHeaderPattern: /^(\w+)(?:\(([^)\r\n]+)\))?!: (\S[^\r\n]*)$/,
});
export const canonicalVersion = (version) =>
  typeof version === 'string' &&
  !version.includes('+') &&
  valid(version) === version;
const objectId = (value) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export async function git(root, args, allowedFailures = []) {
  try {
    return (await exec('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 }))
      .stdout;
  } catch (error) {
    if (allowedFailures.includes(error.code)) return undefined;
    throw new Error(
      `Git ${args[0]} failed; inspect the repository and supplied local references.`,
      { cause: error },
    );
  }
}
export function parseReleaseCommit({ hash, subject, body = '' }) {
  assert(objectId(hash), 'Invalid commit object ID.');
  assert(
    typeof subject === 'string' &&
      subject.length <= 4096 &&
      typeof body === 'string' &&
      Buffer.byteLength(body) <= 64 * 1024,
    'Commit messages exceed release-note limits.',
  );
  const commit = parser.parse(subject + '\n\n' + body);
  if (!commit.type || !types.has(commit.type.toLowerCase()) || !commit.subject)
    return undefined;
  return {
    hash,
    type: commit.type.toLowerCase(),
    scope: commit.scope ?? undefined,
    description: commit.subject,
    breaking: commit.notes.length > 0,
    notes: commit.notes.map((note) => note.text),
  };
}
/** Suggestions remain explicit proposals; prerelease promotion requires a chosen stable version. */
export function recommendReleaseVersion(
  currentVersion,
  baseVersion,
  commits,
  { initial = false, version } = {},
) {
  assert(canonicalVersion(currentVersion), 'Invalid current version.');
  assert(
    baseVersion === undefined ||
      (canonicalVersion(baseVersion) && gte(currentVersion, baseVersion)),
    'The current version cannot precede the selected release baseline.',
  );
  let bump = initial
    ? 'initial'
    : commits.some((commit) => commit.breaking)
      ? parse(baseVersion ?? currentVersion).major === 0
        ? 'minor'
        : 'major'
      : commits.some((commit) => commit.type === 'feat')
        ? 'minor'
        : commits.some((commit) =>
              ['fix', 'perf', 'revert'].includes(commit.type),
            )
          ? 'patch'
          : 'none';
  let recommendedVersion;
  if (initial) recommendedVersion = currentVersion;
  else if (bump === 'none')
    recommendedVersion =
      baseVersion && gt(currentVersion, baseVersion) ? currentVersion : null;
  else if (prerelease(currentVersion)) {
    recommendedVersion = inc(currentVersion, 'prerelease');
    bump = 'prerelease';
  } else {
    const next = inc(baseVersion ?? currentVersion, bump);
    recommendedVersion = gt(currentVersion, next) ? currentVersion : next;
  }
  assert(
    version === undefined ||
      (canonicalVersion(version) && gte(version, currentVersion)),
    'Choose a canonical target version at or above the declared version.',
  );
  return {
    bump,
    recommendedVersion,
    targetVersion: version ?? recommendedVersion,
  };
}
export function githubRepository(origin) {
  if (!origin) return undefined;
  let path;
  try {
    if (origin.startsWith('git@github.com:'))
      path = origin.slice('git@github.com:'.length);
    else {
      const url = new URL(origin);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'github.com' ||
        url.port ||
        url.search ||
        url.hash
      )
        return undefined;
      path = url.pathname.slice(1);
    }
  } catch {
    return undefined;
  }
  path = path.replace(/\/$/, '').replace(/\.git$/, '');
  return /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(path)
    ? 'https://github.com/' + path
    : undefined;
}
const markdown = (text) =>
  text
    .replace(/[\\`*_{}[\]()#+.!<>|&]/g, (char) =>
      char === '<'
        ? '&lt;'
        : char === '>'
          ? '&gt;'
          : char === '&'
            ? '&amp;'
            : '\\' + char,
    )
    .replace(/[\r\n]+/g, ' ')
    .split('')
    .filter((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
    .join('');
export function renderReleaseNotes({
  targetVersion,
  date,
  commits,
  repository,
  baseTag,
}) {
  if (!targetVersion) return '';
  const lines = [`## ${targetVersion} - ${date}`, ''];
  const groups = [
    ['Breaking changes', (commit) => commit.breaking],
    ['Features', (commit) => !commit.breaking && commit.type === 'feat'],
    [
      'Fixes',
      (commit) => !commit.breaking && ['fix', 'revert'].includes(commit.type),
    ],
    ['Performance', (commit) => !commit.breaking && commit.type === 'perf'],
    ['Documentation', (commit) => !commit.breaking && commit.type === 'docs'],
  ];
  for (const [title, matches] of groups) {
    const entries = commits.filter(matches);
    if (!entries.length) continue;
    lines.push(`### ${title}`, '');
    for (const commit of entries) {
      const link = repository
        ? `[${commit.hash.slice(0, 7)}](${repository}/commit/${commit.hash})`
        : '`' + commit.hash.slice(0, 7) + '`';
      lines.push(
        `- ${commit.scope ? '**' + markdown(commit.scope) + ':** ' : ''}${markdown(commit.description)} (${link})`,
      );
      if (commit.breaking)
        for (const note of commit.notes)
          if (note !== commit.description) lines.push('  ' + markdown(note));
    }
    lines.push('');
  }
  if (lines.length === 2)
    lines.push('Maintenance release; review the selected commit range.', '');
  if (repository)
    lines.push(
      `[Full changelog](${repository}/${baseTag ? 'compare/' + baseTag + '...v' + targetVersion : 'commits/v' + targetVersion})`,
      '',
    );
  return lines.join('\n');
}
export async function createReleasePlan(
  root,
  {
    initial = false,
    since,
    version,
    date = new Date().toISOString().slice(0, 10),
  } = {},
) {
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !date.startsWith('0000') &&
      Number.isFinite(Date.parse(date + 'T00:00:00Z')) &&
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date,
    'Supply a real YYYY-MM-DD release date.',
  );
  assert(!(initial && since), 'Choose --initial or --since, not both.');
  const versions = await auditReleaseVersions(root);
  assert(
    (await git(root, ['rev-parse', '--is-shallow-repository'])).trim() ===
      'false',
    'Release planning requires a full clone with fetched release tags.',
  );
  const sourceCommit = (
    await git(root, ['rev-parse', '--verify', 'HEAD^{commit}'])
  ).trim();
  assert(objectId(sourceCommit), 'Invalid source commit.');
  const sourceWorkingTreeDirty = Boolean(
    (
      await git(root, ['status', '--porcelain', '--untracked-files=all'])
    ).trim(),
  );
  const tags = (
    await git(root, ['tag', '--merged', sourceCommit, '--list', 'v*'])
  )
    .split('\n')
    .filter((tag) => tag.startsWith('v') && canonicalVersion(tag.slice(1)))
    .sort((left, right) => rcompare(left.slice(1), right.slice(1)));
  assert(
    !initial || !tags.length,
    'An initial plan requires no merged release tags; choose a baseline.',
  );
  let baseTag, baseCommit, baseVersion;
  if (since !== undefined) {
    assert(
      typeof since === 'string' &&
        since.length > 0 &&
        since.length <= 1024 &&
        ![...since].some((char) => [0, 10, 13].includes(char.charCodeAt(0))),
      'Invalid release baseline.',
    );
    baseCommit = (
      await git(root, [
        'rev-parse',
        '--verify',
        '--end-of-options',
        since + '^{commit}',
      ])
    ).trim();
    if (tags.includes(since)) {
      baseTag = since;
      baseVersion = since.slice(1);
    }
  } else if (!initial) {
    baseTag = tags[0];
    assert(
      baseTag,
      'No merged release tag found. Supply --initial or --since <local-ref>.',
    );
    baseVersion = baseTag.slice(1);
    baseCommit = (
      await git(root, [
        'rev-parse',
        '--verify',
        '--end-of-options',
        baseTag + '^{commit}',
      ])
    ).trim();
  }
  if (baseCommit) {
    assert(objectId(baseCommit), 'Invalid baseline commit.');
    const ancestor = await git(
      root,
      ['merge-base', '--is-ancestor', baseCommit, sourceCommit],
      [1],
    );
    assert(
      ancestor !== undefined,
      'The baseline must be an ancestor of the selected source.',
    );
  }
  const raw = await git(root, [
    'log',
    '--no-merges',
    '--encoding=UTF-8',
    '--reverse',
    '--max-count=5001',
    '--format=%H%x00%s%x00%b%x00',
    baseCommit ? `${baseCommit}..${sourceCommit}` : sourceCommit,
  ]);
  const fields = raw.split('\0');
  assert(
    fields.pop().trim() === '' &&
      fields.length % 3 === 0 &&
      fields.length / 3 <= 5000,
    'Release history exceeds limits or has invalid framing; narrow the baseline.',
  );
  const commits = [],
    unclassified = [];
  for (let index = 0; index < fields.length; index += 3) {
    const input = {
      hash: fields[index].trim(),
      subject: fields[index + 1],
      body: fields[index + 2],
    };
    const commit = parseReleaseCommit(input);
    if (commit) commits.push(commit);
    else unclassified.push({ hash: input.hash, subject: input.subject });
  }
  const recommendation = recommendReleaseVersion(
    versions.version,
    baseVersion,
    commits,
    { initial, version },
  );
  if (recommendation.targetVersion) {
    const exists = await git(
      root,
      [
        'show-ref',
        '--verify',
        '--quiet',
        `refs/tags/v${recommendation.targetVersion}`,
      ],
      [1],
    );
    assert(
      exists === undefined,
      'The target release tag already exists. Choose a new version.',
    );
  }
  const repository = githubRepository(
    (await git(root, ['remote', 'get-url', 'origin'], [2, 128]))?.trim(),
  );
  const result = {
    schemaVersion: 1,
    sourceCommit,
    sourceWorkingTreeDirty,
    date,
    currentVersion: versions.version,
    javaVersion: versions.javaVersion,
    initial,
    explicitVersion: version !== undefined,
    ...(baseCommit ? { baseCommit } : {}),
    ...(baseTag ? { baseTag } : {}),
    ...(repository ? { repository } : {}),
    ...recommendation,
    commits,
    unclassified,
  };
  return { ...result, notes: renderReleaseNotes(result) };
}
