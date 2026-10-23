import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  inspectNpmVersion,
  loadNpmPublication,
} from './lib/npm-publication.mjs';
import { releaseSource } from './lib/release-assets.mjs';
import { readRegularFile } from './lib/read-regular-file.mjs';

assert.equal(process.argv.length, 2);
const root = process.cwd();
const source = await releaseSource(root, process.env, {
  workflow: 'release-publish.yml',
});
const plan = JSON.parse(
  await readRegularFile(join(root, '.api-docs/publication/plan.json')),
);
const context = { ...source, runId: plan.runId, runAttempt: plan.runAttempt };
const candidate = await loadNpmPublication(root, context, plan);
for (const pkg of candidate.packages)
  assert(
    (await inspectNpmVersion(pkg)).exists,
    `Public npm package is missing: ${pkg.name}.`,
  );
const consumer = await mkdtemp(join(tmpdir(), 'api-docs-public-npm-consumer-'));
const destination = join(root, '.api-docs/published-consumers/npm');
await mkdir(destination, { recursive: true });
const exec = promisify(execFile);
const metadata = JSON.parse(await readRegularFile(join(root, 'package.json')));
const config = [
  '--registry',
  'https://registry.npmjs.org',
  '--cache',
  join(consumer, 'empty-cache'),
  '--userconfig',
  join(consumer, 'npmrc'),
];
const run = (file, args, timeout = 180_000) =>
  exec(file, args, {
    cwd: consumer,
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: '' },
  });
try {
  await writeFile(join(consumer, 'npmrc'), '', { mode: 0o600, flag: 'wx' });
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'api-docs-public-registry-consumer',
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: {
          ...Object.fromEntries(
            candidate.packages.map((pkg) => [pkg.name, pkg.version]),
          ),
          express: metadata.devDependencies.express,
          fastify: metadata.devDependencies.fastify,
        },
        devDependencies: Object.fromEntries(
          ['typescript', '@types/node', '@types/express'].map((name) => [
            name,
            metadata.devDependencies[name],
          ]),
        ),
        overrides: metadata.overrides,
      },
      null,
      2,
    ),
  );
  await run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...config,
  ]);
  const lockBytes = await readFile(join(consumer, 'package-lock.json'));
  const lock = JSON.parse(lockBytes);
  for (const pkg of candidate.packages) {
    const installed = lock.packages[`node_modules/${pkg.name}`];
    assert.equal(installed?.version, pkg.version);
    assert.equal(installed.integrity, pkg.integrity);
    assert.equal(
      new URL(installed.resolved).origin,
      'https://registry.npmjs.org',
    );
    assert.notEqual(
      installed.link,
      true,
      'Registry acceptance cannot use workspace links.',
    );
  }
  const signatures = await run('npm', ['audit', 'signatures', ...config]);
  await writeFile(
    join(destination, 'signature-verification.txt'),
    signatures.stdout,
  );
  await run('npm', ['audit', '--audit-level=moderate', ...config], 60_000);
  await run('npm', [
    'ci',
    '--offline',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    ...config,
  ]);
  await cp(
    join(root, 'scripts/fixtures/npm-consumer.mjs'),
    join(consumer, 'smoke.mjs'),
  );
  const smoke = await run(process.execPath, ['smoke.mjs'], 90_000);
  await writeFile(join(destination, 'consumer-output.txt'), smoke.stdout);
  await writeFile(join(destination, 'package-lock.json'), lockBytes);
  const sbom = await run(
    'npm',
    ['sbom', '--sbom-format', 'cyclonedx', '--omit', 'dev', ...config],
    60_000,
  );
  assert.equal(JSON.parse(sbom.stdout).bomFormat, 'CycloneDX');
  await writeFile(join(destination, 'sbom.cdx.json'), sbom.stdout);
  await writeFile(
    join(destination, 'result.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        ...context,
        passed: true,
        packages: candidate.packages.length,
        checks: [
          'fresh-empty-cache-public-registry-install',
          'registry-archive-hashes',
          'registry-signatures-and-provenance',
          'dependency-audit',
          'offline-lockfile-reinstall',
          'public-types-cli-and-authenticated-adapters',
        ],
        packageHashes: candidate.packages.map(
          ({ name, version, sha256, integrity }) => ({
            name,
            version,
            sha256,
            integrity,
          }),
        ),
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log(
    'Fresh public npm consumer, signatures, provenance, audit and offline reinstall passed.',
  );
} finally {
  await rm(consumer, { recursive: true, force: true });
}
