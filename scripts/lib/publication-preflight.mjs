import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { validateContainerInventory } from './container-inventory.mjs';
import { validateContainerSecurity } from './container-security.mjs';
import { readRegularFile } from './read-regular-file.mjs';
import { releaseCommand } from './release-command.mjs';
import { validateReleaseContext } from './release-assets.mjs';

export const preflightFiles = [
  'receipt.json',
  'server.cdx.json',
  'server.grype.json',
];
export const bytesSha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

/** A fresh scan binds to the original candidate image, not a replacement rebuild. */
export function assessPublicationPreflight(
  receipt,
  inventoryBytes,
  findingsBytes,
  expected,
  now = Date.now(),
) {
  validateReleaseContext(expected.context);
  for (const key of ['publicationRunId', 'publicationRunAttempt'])
    assert.match(expected[key], /^[1-9][0-9]{0,19}$/);
  assert.equal(expected.inventoryContext.image, expected.image);
  assert.equal(expected.inventoryContext.toolVersion, expected.context.version);
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(
    receipt.purpose,
    expected.purpose ?? 'publication-preflight',
    'Candidate rehearsals cannot authorize publication.',
  );
  assert.equal(receipt.complete, true);
  for (const [key, value] of Object.entries(expected.context))
    assert.equal(
      receipt[key],
      value,
      `Preflight source/candidate differs: ${key}.`,
    );
  for (const key of ['publicationRunId', 'publicationRunAttempt'])
    assert.equal(
      receipt[key],
      expected[key],
      'Preflight belongs to another publication run.',
    );
  assert.equal(receipt.image, expected.image);
  assert.equal(receipt.archiveSha256, expected.archiveSha256);
  assert.equal(receipt.inventorySha256, bytesSha256(inventoryBytes));
  assert.equal(receipt.findingsSha256, bytesSha256(findingsBytes));
  assert.equal(receipt.dependencyAudit?.passed, true);
  assert.equal(receipt.dependencyAudit.lockSha256, expected.lockSha256);
  const audited = Date.parse(receipt.dependencyAudit.auditedAt);
  assert(
    Number.isFinite(audited) &&
      audited <= now + 300_000 &&
      audited >= now - 24 * 60 * 60 * 1000,
    'Dependency audit is stale or invalid. Rerun preflight without rebuilding candidates.',
  );
  const counts = validateContainerInventory(
    JSON.parse(inventoryBytes),
    expected.inventoryContext,
  );
  const assessment = validateContainerSecurity(
    JSON.parse(findingsBytes),
    expected.image,
    now,
  );
  assert.equal(
    assessment.passed,
    true,
    'Current image findings block publication; no waiver applies.',
  );
  assert.deepEqual(receipt.counts, counts);
  assert.deepEqual(receipt.assessment, assessment);
  return { counts, assessment, audit: receipt.dependencyAudit };
}

export async function verifyPublicationPreflight(
  directory,
  expected,
  { run = releaseCommand, now = Date.now() } = {},
) {
  const data = new Map();
  for (const name of preflightFiles)
    data.set(
      name,
      await readRegularFile(join(directory, name), 64 * 1024 * 1024),
    );
  const result = assessPublicationPreflight(
    JSON.parse(data.get('receipt.json')),
    data.get('server.cdx.json'),
    data.get('server.grype.json'),
    expected,
    now,
  );
  for (const name of preflightFiles) {
    let verification;
    try {
      verification = await run(
        'gh',
        [
          'attestation',
          'verify',
          join(directory, name),
          '--repo',
          expected.context.repository,
          '--signer-workflow',
          `${expected.context.repository}/.github/workflows/release-publish.yml`,
          '--source-ref',
          expected.context.ref,
          '--source-digest',
          expected.context.commit,
          '--deny-self-hosted-runners',
          '--format',
          'json',
        ],
        { timeout: 90_000, maxBuffer: 4 * 1024 * 1024 },
      );
    } catch {
      throw new Error(
        `Fresh security producer verification failed for ${name}.`,
      );
    }
    const proof = JSON.parse(verification.stdout);
    assert(proof && typeof proof === 'object' && Object.keys(proof).length > 0);
    result[name] = { sha256: bytesSha256(data.get(name)), proof };
  }
  return result;
}
