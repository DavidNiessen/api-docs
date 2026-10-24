import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseCommand } from './release-command.mjs';

export const githubNpmRegistry = 'https://npm.pkg.github.com';

/** Coordinates are bound to the source repository, never an arbitrary credential destination. */
export function githubPackageRegistries(repository) {
  assert.match(
    repository,
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/,
  );
  const [owner, name] = repository.toLowerCase().split('/');
  return {
    scope: '@' + owner,
    npm: githubNpmRegistry,
    maven: `https://maven.pkg.github.com/${owner}/${name}`,
  };
}

export function githubPackageHeaders(kind, env = process.env) {
  assert(
    typeof env.GITHUB_PACKAGES_TOKEN === 'string' &&
      /^[!-~]{1,4096}$/.test(env.GITHUB_PACKAGES_TOKEN),
    'A GitHub Packages token is required.',
  );
  if (kind === 'npm')
    return { Authorization: 'Bearer ' + env.GITHUB_PACKAGES_TOKEN };
  assert.equal(kind, 'maven');
  assert.match(
    env.GITHUB_ACTOR ?? '',
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}(?:\[bot\])?$/,
    'A GitHub username is required.',
  );
  return {
    Authorization:
      'Basic ' +
      Buffer.from(env.GITHUB_ACTOR + ':' + env.GITHUB_PACKAGES_TOKEN).toString(
        'base64',
      ),
  };
}

export function validateGitHubNpmVisibility(metadata, name, repository) {
  const { scope } = githubPackageRegistries(repository);
  assert(name.startsWith(scope + '/'));
  assert.equal(metadata.package_type, 'npm');
  assert([name, name.slice(scope.length + 1)].includes(metadata.name));
  assert.equal(
    metadata.repository?.full_name,
    repository,
    'Connect the GitHub npm package to its source repository.',
  );
  assert.equal(
    metadata.visibility,
    'public',
    `Set ${name} visibility to Public in GitHub Packages settings, then rerun all publication jobs.`,
  );
  return { name, repository, visibility: 'public' };
}

export async function githubPackageRepository(
  repository,
  { run = releaseCommand } = {},
) {
  githubPackageRegistries(repository);
  let result;
  try {
    result = await run(
      'gh',
      ['api', '--hostname', 'github.com', `repos/${repository}`],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
  } catch {
    throw new Error(
      'Cannot inspect the distribution repository. Check repository read access.',
    );
  }
  const metadata = JSON.parse(result.stdout);
  assert.equal(metadata.full_name, repository);
  assert.equal(
    metadata.private,
    false,
    'Open source distribution acceptance requires a public source repository.',
  );
  assert(['User', 'Organization'].includes(metadata.owner?.type));
  assert.equal(
    metadata.owner.login.toLowerCase(),
    repository.split('/')[0].toLowerCase(),
  );
  return {
    repository,
    visibility: 'public',
    ownerKind: metadata.owner.type === 'Organization' ? 'orgs' : 'users',
  };
}

export async function githubNpmVisibility(
  name,
  repository,
  { run = releaseCommand } = {},
) {
  const { scope } = githubPackageRegistries(repository);
  assert(name.startsWith(scope + '/'));
  const [owner] = repository.split('/');
  const { ownerKind } = await githubPackageRepository(repository, { run });
  let result;
  try {
    result = await run(
      'gh',
      [
        'api',
        '--hostname',
        'github.com',
        `${ownerKind}/${owner}/packages/npm/${encodeURIComponent(name.slice(scope.length + 1))}`,
      ],
      { timeout: 60_000, maxBuffer: 1024 * 1024 },
    );
  } catch {
    throw new Error(
      'Cannot verify GitHub package visibility. Grant the workflow read access to the repository-linked package.',
    );
  }
  return validateGitHubNpmVisibility(
    JSON.parse(result.stdout),
    name,
    repository,
  );
}

/** Maven expands environment references itself; credential values never enter settings files. */
export async function githubMavenConfiguration(repository, env = process.env) {
  githubPackageHeaders('maven', env);
  const registry = githubPackageRegistries(repository).maven;
  const directory = await mkdtemp(join(tmpdir(), 'ad-gh-maven-'));
  const settings = join(directory, 'settings.xml');
  await writeFile(
    settings,
    '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"><servers><server><id>github</id>' +
      '<username>${env.GITHUB_ACTOR}</username><password>${env.GITHUB_PACKAGES_TOKEN}</password>' +
      '</server></servers><profiles><profile><id>github-packages</id><repositories><repository>' +
      '<id>github</id><url>' +
      registry +
      '</url><releases><enabled>true</enabled></releases>' +
      '<snapshots><enabled>false</enabled></snapshots></repository></repositories></profile></profiles>' +
      '<activeProfiles><activeProfile>github-packages</activeProfile></activeProfiles></settings>\n',
    { flag: 'wx', mode: 0o600 },
  );
  return {
    directory,
    registry,
    args: [
      '--settings',
      settings,
      '-Dmaven.repo.local=' + join(directory, 'empty-m2'),
    ],
  };
}
