import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { satisfies } from 'semver';
import { readWorkspacePackages } from './workspaces.mjs';

export const scanner = Object.freeze({
  name: 'syft',
  version: '1.55.0',
  archiveSha256:
    'bb65249542db5fedeeb4d3f9b018b75e7264dbfbbb10486f044581a92f90490d',
  executableSha256:
    '64c9631c3560336c55c549df0de08cd577d02399c9de807ac390960a4ed5c351',
});
export async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyScanner(path, expected = scanner) {
  const info = await lstat(path);
  assert(
    info.isFile() && !info.isSymbolicLink(),
    'Scanner must be a regular file',
  );
  assert.equal(
    await sha256(path),
    expected.executableSha256,
    'Scanner integrity check failed',
  );
}
export async function requireCompleteInventory(directory) {
  assert((await lstat(directory)).isDirectory(), 'Invalid inventory directory');
  try {
    await lstat(join(directory, '.incomplete'));
    assert.fail('Container inventory is incomplete');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function inventoryContext(image, toolVersion) {
  const workspace = await readWorkspacePackages(process.cwd());
  return {
    image,
    toolVersion,
    packages: workspace.map((pkg) => pkg.metadata.name),
    nodeRange: workspace[0].metadata.engines.node,
  };
}

/** Verify the subject and real OS/runtime/application inventory, not a source lockfile. */
export function validateContainerInventory(
  bom,
  { image, toolVersion, packages, nodeRange },
) {
  assert.match(image, /^sha256:[a-f0-9]{64}$/);
  assert.equal(bom.bomFormat, 'CycloneDX');
  assert.equal(bom.specVersion, '1.7');
  assert.equal(bom.metadata.component.type, 'container');
  assert.equal(bom.metadata.component.name, 'sha256');
  assert.equal(
    bom.metadata.component.version,
    image.slice(7),
    'Wrong inventoried image',
  );
  assert(
    bom.metadata.tools.components.some(
      (tool) => tool.name === scanner.name && tool.version === scanner.version,
    ),
    'Wrong inventory scanner',
  );
  assert(Array.isArray(bom.components) && bom.components.length > 0);
  assert(Array.isArray(bom.dependencies) && bom.dependencies.length > 0);
  const counts = { npm: 0, deb: 0, apk: 0, files: 0 };
  for (const component of bom.components) {
    if (component.purl?.startsWith('pkg:npm/')) counts.npm++;
    if (component.purl?.startsWith('pkg:deb/')) counts.deb++;
    if (component.purl?.startsWith('pkg:apk/')) counts.apk++;
    if (component.type === 'file') counts.files++;
  }
  assert(
    counts.npm > 0 && counts.deb + counts.apk > 0,
    'Missing application or operating-system packages',
  );
  for (const name of packages) {
    const entries = bom.components.filter(
      (component) =>
        component.name === name && component.purl?.startsWith('pkg:npm/'),
    );
    assert(entries.length > 0, `Missing application package ${name}`);
    assert(
      entries.every((component) => component.version === toolVersion),
      `Stale application package ${name}`,
    );
  }
  for (const name of ['fastify', 'pg'])
    assert(
      bom.components.some(
        (component) =>
          component.name === name &&
          component.purl?.startsWith('pkg:npm/') &&
          typeof component.version === 'string' &&
          component.version.length > 0,
      ),
      `Missing runtime dependency ${name}`,
    );
  assert(
    bom.components.some(
      (component) =>
        component.name === 'node' &&
        component.purl?.startsWith('pkg:generic/node@') &&
        satisfies(component.version, nodeRange),
    ),
    'Missing or unsupported Node runtime',
  );
  return counts;
}
