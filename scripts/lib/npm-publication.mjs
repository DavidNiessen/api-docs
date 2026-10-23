import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { npmPublicationOrder } from './publication-policy.mjs';
import { readRegularFile } from './read-regular-file.mjs';
import { releaseRequest } from './release-http.mjs';
import { verifyReleaseAssets } from './release-assets.mjs';
import { readWorkspacePackages } from './workspaces.mjs';

const exec = promisify(execFile);
const registry = 'https://registry.npmjs.org';
const digest = (bytes, algorithm, encoding = 'hex') =>
  createHash(algorithm).update(bytes).digest(encoding);

/** Compare public registry bytes, not only a version string or registry metadata. */
export async function inspectNpmVersion(
  pkg,
  { request = releaseRequest } = {},
) {
  assert.match(pkg.name, /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/);
  assert.match(pkg.version, /^[0-9][a-zA-Z0-9.-]{0,99}$/);
  assert.match(pkg.sha256, /^[a-f0-9]{64}$/);
  assert.match(pkg.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert(
    Number.isSafeInteger(pkg.bytes) &&
      pkg.bytes > 0 &&
      pkg.bytes <= 64 * 1024 * 1024,
  );
  const result = await request(
    `${registry}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`,
  );
  if (result.status === 404) return { exists: false };
  assert.equal(
    result.status,
    200,
    `Cannot inspect npm publication ${pkg.name}.`,
  );
  const metadata = JSON.parse(result.bytes.toString('utf8'));
  assert.equal(metadata.name, pkg.name);
  assert.equal(metadata.version, pkg.version);
  assert.equal(
    metadata.dist?.integrity,
    pkg.integrity,
    `Existing npm version has different bytes: ${pkg.name}.`,
  );
  assert.equal(
    metadata.dist.attestations?.provenance?.predicateType,
    'https://slsa.dev/provenance/v1',
    'Published npm provenance is missing.',
  );
  const provenance = new URL(metadata.dist.attestations.url);
  assert.equal(provenance.origin, registry);
  assert(
    !provenance.username &&
      !provenance.password &&
      !provenance.hash &&
      !provenance.search,
  );
  const url = new URL(metadata.dist.tarball);
  assert.equal(
    url.origin,
    registry,
    'npm tarball must come from the public npm registry.',
  );
  assert(!url.username && !url.password && !url.hash && !url.search);
  const archive = await request(url.href, { maximum: pkg.bytes });
  assert.equal(archive.status, 200);
  assert.equal(archive.bytes.length, pkg.bytes);
  assert.equal(
    digest(archive.bytes, 'sha256'),
    pkg.sha256,
    'Public npm archive differs from the tested candidate.',
  );
  assert.equal(
    `sha512-${digest(archive.bytes, 'sha512', 'base64')}`,
    pkg.integrity,
  );
  return {
    exists: true,
    tarball: url.href,
    provenance: provenance.href,
    sha256: pkg.sha256,
    integrity: pkg.integrity,
  };
}

export async function loadNpmPublication(root, context, plan) {
  assert.equal(
    plan.policyApproved,
    true,
    'Source policy does not approve publishing.',
  );
  for (const key of [
    'repository',
    'commit',
    'ref',
    'version',
    'runId',
    'runAttempt',
  ])
    assert.equal(plan[key], context[key]);
  assert(['next', 'latest'].includes(plan.npm.tag));
  const directory = join(root, '.api-docs/release-assets/npm');
  await verifyReleaseAssets(directory, context, 'npm');
  const report = JSON.parse(
    await readRegularFile(join(directory, 'manifest.json')),
  );
  assert.equal(report.commit, context.commit);
  assert.equal(report.sourceWorkingTreeDirty, false);
  const metadata = (await readWorkspacePackages(root))
    .filter((pkg) => pkg.path && pkg.metadata.private !== true)
    .map((pkg) => pkg.metadata);
  const names = metadata.map((pkg) => pkg.name).sort();
  assert.deepEqual([...plan.npm.packages].sort(), names);
  assert.deepEqual(report.packages.map((pkg) => pkg.name).sort(), names);
  for (const pkg of report.packages) {
    assert.equal(pkg.version, context.version);
    assert.equal(
      pkg.filename,
      `${pkg.name.replace(/^@/, '').replace('/', '-')}-${context.version}.tgz`,
    );
    const bytes = await readRegularFile(
      join(directory, pkg.filename),
      64 * 1024 * 1024,
    );
    assert.equal(bytes.length, pkg.bytes);
    assert.equal(digest(bytes, 'sha256'), pkg.sha256);
    assert.equal(`sha512-${digest(bytes, 'sha512', 'base64')}`, pkg.integrity);
  }
  return {
    directory,
    packages: npmPublicationOrder(metadata).map((name) =>
      report.packages.find((pkg) => pkg.name === name),
    ),
    tag: plan.npm.tag,
  };
}

/** All immutable versions are preflighted before the first write; retries never overwrite. */
export async function publishNpmArchives(
  candidate,
  {
    request = releaseRequest,
    run = (file, args, options) => exec(file, args, options),
    env = process.env,
    receiptPath,
  } = {},
) {
  assert(['next', 'latest'].includes(candidate.tag));
  const states = [];
  for (const pkg of candidate.packages)
    states.push(await inspectNpmVersion(pkg, { request }));
  const privateRoot = await mkdtemp(
    join(tmpdir(), 'api-docs-npm-publication-'),
  );
  const receipt = { schemaVersion: 1, complete: false, packages: [] };
  const retain = async () => {
    if (receiptPath)
      await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {
        mode: 0o600,
      });
  };
  try {
    const userconfig = join(privateRoot, 'npmrc');
    // npm expands this reference itself. A token value never enters a file or command argument.
    await writeFile(
      userconfig,
      env.NPM_TOKEN ? '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n' : '',
      { flag: 'wx', mode: 0o600 },
    );
    for (const [index, pkg] of candidate.packages.entries()) {
      if (!states[index].exists) {
        assert(
          env.NPM_TOKEN ||
            (env.ACTIONS_ID_TOKEN_REQUEST_URL &&
              env.ACTIONS_ID_TOKEN_REQUEST_TOKEN),
          'npm requires trusted publishing or a bootstrap token.',
        );
        try {
          await run(
            'npm',
            [
              'publish',
              join(candidate.directory, pkg.filename),
              '--ignore-scripts',
              '--access',
              'public',
              '--provenance',
              '--tag',
              candidate.tag,
              '--registry',
              registry,
              '--userconfig',
              userconfig,
              '--cache',
              join(privateRoot, 'cache'),
            ],
            {
              cwd: privateRoot,
              env,
              timeout: 180_000,
              maxBuffer: 4 * 1024 * 1024,
            },
          );
        } catch {
          throw new Error(
            `npm publication failed for ${pkg.name}. Inspect retained receipts and public registry state before retrying; completed versions are immutable.`,
          );
        }
      }
      const result = await inspectNpmVersion(pkg, { request });
      assert(
        result.exists,
        `Published npm version is not yet publicly available: ${pkg.name}. Retry verification; do not rebuild.`,
      );
      receipt.packages.push({
        name: pkg.name,
        version: pkg.version,
        reused: states[index].exists,
        ...result,
      });
      await retain();
    }
    receipt.complete = true;
    await retain();
    return receipt;
  } finally {
    await retain();
    await rm(privateRoot, { recursive: true, force: true });
  }
}

export async function writeNpmPublicationReceiptDirectory(root) {
  const directory = join(root, '.api-docs/publication');
  await mkdir(directory, { recursive: true });
  return join(directory, 'npm-result.json');
}
