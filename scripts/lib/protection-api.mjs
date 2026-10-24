import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { githubPackageRegistries } from './github-packages.mjs';

const exec = promisify(execFile);
export async function protectionRepository(root) {
  const { stdout } = await exec(
    'gh',
    ['repo', 'view', '--json', 'nameWithOwner'],
    { cwd: root, timeout: 30000 },
  );
  const repository = JSON.parse(stdout).nameWithOwner;
  githubPackageRegistries(repository);
  return repository;
}
export function protectionApi(repository) {
  githubPackageRegistries(repository);
  return async (path) => {
    try {
      const { stdout } = await exec(
        'gh',
        [
          'api',
          '--hostname',
          'github.com',
          `repos/${repository}${path ? '/' + path : ''}`,
        ],
        { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
      );
      return JSON.parse(stdout);
    } catch {
      throw new Error(
        `Cannot read GitHub protection metadata: ${path}. Check repository access.`,
      );
    }
  };
}
