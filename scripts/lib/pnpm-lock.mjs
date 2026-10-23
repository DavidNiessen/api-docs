import assert from 'node:assert/strict';
import { posix } from 'node:path';
import { parse } from 'yaml';
import { readRepositoryFile } from './workspaces.mjs';

/** Audit both manager inputs before release preparation or packaging. */
export async function auditPnpmLock(root, packages) {
  const workspace = parse(
    await readRepositoryFile(root, 'pnpm-workspace.yaml'),
  );
  const lock = parse(
    await readRepositoryFile(root, 'pnpm-lock.yaml', 8 * 1024 * 1024),
  );
  const metadata = packages[0].metadata;
  assert.deepEqual(
    workspace.packages,
    metadata.workspaces,
    'pnpm workspace declarations drift.',
  );
  assert.deepEqual(
    workspace.overrides,
    metadata.overrides,
    'Package-manager override drift.',
  );
  assert.deepEqual(
    lock.overrides,
    workspace.overrides,
    'pnpm lockfile overrides drift.',
  );
  assert(
    lock.lockfileVersion === '9.0' && lock.importers,
    'Unsupported pnpm lockfile.',
  );
  assert(
    workspace.linkWorkspacePackages === true &&
      workspace.preferWorkspacePackages === true,
    'pnpm must prefer local workspace packages.',
  );
  assert.deepEqual(
    Object.keys(lock.importers).sort(),
    packages.map((pkg) => pkg.path || '.').sort(),
    'pnpm lockfile workspace inventory drift.',
  );
  const names = new Map(
    packages.slice(1).map((pkg) => [pkg.metadata.name, pkg.path]),
  );
  for (const pkg of packages) {
    const importer = lock.importers[pkg.path || '.'];
    for (const section of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
    ]) {
      const declared = {
        ...(section === 'dependencies' ? pkg.metadata.peerDependencies : {}),
        ...pkg.metadata[section],
      };
      assert.deepEqual(
        Object.keys(importer[section] ?? {}).sort(),
        Object.keys(declared).sort(),
        `pnpm dependency inventory drift: ${pkg.path || '.'} / ${section}`,
      );
      for (const [name, range] of Object.entries(declared)) {
        const recorded = importer[section][name];
        assert(
          recorded?.specifier === (workspace.overrides?.[name] ?? range),
          `pnpm dependency specifier drift: ${pkg.path || '.'} / ${name}`,
        );
        if (names.has(name))
          assert(
            recorded.version ===
              'link:' + posix.relative(pkg.path || '.', names.get(name)),
            `pnpm workspace link drift: ${pkg.path} / ${name}`,
          );
      }
    }
  }
  return lock;
}
