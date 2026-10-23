import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  scanner,
  validateContainerInventory,
  verifyScanner,
} from '../lib/container-inventory.mjs';

const image = 'sha256:' + 'a'.repeat(64);
const context = {
  image,
  toolVersion: '0.2.0',
  packages: ['@example/server', '@example/contracts'],
  nodeRange: '>=24.19.0 <25',
};
const npm = (name, version) => ({
  name,
  version,
  purl: `pkg:npm/${encodeURIComponent(name)}@${version}`,
});
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.7',
  metadata: {
    component: { type: 'container', name: 'sha256', version: image.slice(7) },
    tools: { components: [{ name: scanner.name, version: scanner.version }] },
  },
  components: [
    npm('@example/server', '0.2.0'),
    npm('@example/contracts', '0.2.0'),
    npm('fastify', '5.12.7'),
    npm('pg', '8.23.1'),
    { name: 'libc6', version: '2.36', purl: 'pkg:deb/debian/libc6@2.36' },
    { name: 'node', version: '24.19.0', purl: 'pkg:generic/node@24.19.0' },
    { name: '/app/LICENSE', type: 'file' },
  ],
  dependencies: [{ ref: 'server', dependsOn: ['fastify'] }],
};
test('accepts a version-matched image inventory with OS, runtime and all declared application packages', () => {
  assert.deepEqual(validateContainerInventory(bom, context), {
    npm: 4,
    deb: 1,
    files: 1,
  });
});
test('rejects a source inventory, mismatched image or stale scanner', () => {
  for (const change of [
    (report) => {
      report.metadata.component.type = 'application';
    },
    (report) => {
      report.metadata.component.version = 'b'.repeat(64);
    },
    (report) => {
      report.metadata.tools.components[0].version = '1.54.0';
    },
    (report) => {
      report.specVersion = '1.6';
    },
  ]) {
    const report = structuredClone(bom);
    change(report);
    assert.throws(() => validateContainerInventory(report, context));
  }
});
test('rejects empty inventories, missing OS/runtime dependencies and unsupported Node runtimes', () => {
  for (const name of [
    'libc6',
    'pg',
    'fastify',
    'node',
    '@example/server',
    '@example/contracts',
  ]) {
    const report = structuredClone(bom);
    report.components = report.components.filter((item) => item.name !== name);
    assert.throws(() => validateContainerInventory(report, context));
  }
  for (const change of [
    (report) => {
      report.components = [];
    },
    (report) => {
      report.dependencies = [];
    },
    (report) => {
      report.components.find((item) => item.name === 'node').version = '22.0.0';
    },
  ]) {
    const report = structuredClone(bom);
    change(report);
    assert.throws(() => validateContainerInventory(report, context));
  }
});
test('rejects stale or conflicting application versions even when other component identities match', () => {
  const stale = structuredClone(bom);
  stale.components[0].version = '0.1.0';
  assert.throws(() => validateContainerInventory(stale, context));
  const duplicate = structuredClone(bom);
  duplicate.components.push(npm('@example/contracts', '0.1.0'));
  assert.throws(() => validateContainerInventory(duplicate, context));
});
test('does not accept a named component without its package identity', () => {
  const report = structuredClone(bom);
  delete report.components[0].purl;
  assert.throws(() => validateContainerInventory(report, context));
});
test('rejects a modified executable and executable symlinks before execution', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-scanner-integrity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'scanner');
  await writeFile(path, 'unverified scanner');
  await assert.rejects(verifyScanner(path), /integrity check failed/);
  const link = join(root, 'linked');
  await symlink(path, link);
  await assert.rejects(verifyScanner(link), /regular file/);
});
