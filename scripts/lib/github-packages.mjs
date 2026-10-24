import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  assert.match(
    env.GITHUB_PACKAGES_TOKEN ?? '',
    /^[!-~]{1,4096}$/,
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
