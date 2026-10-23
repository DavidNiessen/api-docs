import assert from 'node:assert/strict';
import { glob, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { readRegularFile } from './read-regular-file.mjs';

export async function readRepositoryFile(root, path, maximum = 1024 * 1024) {
  const canonical = await realpath(root);
  const file = await realpath(join(canonical, path));
  const local = relative(canonical, file);
  assert(
    local && local !== '..' && !local.startsWith('..' + sep),
    'Repository metadata must stay inside the checkout.',
  );
  return (
    await readRegularFile(
      file,
      maximum,
      `Invalid or excessive repository metadata: ${path}`,
    )
  ).toString('utf8');
}
export async function readWorkspacePackages(root) {
  const metadata = JSON.parse(await readRepositoryFile(root, 'package.json'));
  assert(
    Array.isArray(metadata.workspaces) &&
      metadata.workspaces.length > 0 &&
      metadata.workspaces.length <= 100,
    'Declare a nonempty workspace array.',
  );
  assert(
    metadata.workspaces.every(
      (pattern) =>
        typeof pattern === 'string' &&
        /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*(?:\/\*)?$/.test(pattern),
    ),
    'Unsupported workspace pattern. Use checkout-local paths with an optional final /*.',
  );
  const paths = new Set();
  for await (const path of glob(
    metadata.workspaces.map((pattern) => pattern + '/package.json'),
    { cwd: root },
  )) {
    paths.add(path.split(sep).join('/'));
    assert(paths.size <= 1000, 'Too many workspace packages.');
  }
  assert(paths.size > 0, 'No workspace packages found.');
  const packages = [{ path: '', metadata }];
  for (const path of [...paths].sort())
    packages.push({
      path: path.slice(0, -'/package.json'.length),
      metadata: JSON.parse(await readRepositoryFile(root, path)),
    });
  const names = new Set();
  for (const pkg of packages) {
    assert(
      typeof pkg.metadata.name === 'string' &&
        /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(pkg.metadata.name),
      'Invalid workspace package name.',
    );
    assert(!names.has(pkg.metadata.name), 'Duplicate workspace package name.');
    assert(
      pkg.metadata.private === undefined ||
        typeof pkg.metadata.private === 'boolean',
      'Package private flags must be booleans.',
    );
    names.add(pkg.metadata.name);
  }
  return packages;
}
