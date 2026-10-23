import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { releaseRequest } from '../lib/release-http.mjs';
import {
  inspectMavenPublication,
  inspectMavenPublicKey,
  mavenPublicationFiles,
  publishCentralBundle,
  runSigningTool,
  signMavenBundle,
  verifyGpgStatus,
} from '../lib/maven-publication.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.from(
  'local cryptographic fixture; never a real Maven artifact',
);
const files = mavenPublicationFiles(
  { version: '0.2.0-rc.1' },
  'dev.niessen',
).map((file) => ({ ...file, bytes: bytes.length, sha256: digest(bytes) }));
const response = (value, status = 200) => ({
  status,
  bytes: Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
});

test('Maven layout contains the parent, both binaries, POMs and source/Javadoc archives without traversal', () => {
  assert.equal(files.length, 9);
  assert.equal(new Set(files.map((entry) => entry.name)).size, 9);
  assert(
    files.every(
      (entry) =>
        entry.path.startsWith('dev/niessen/') &&
        entry.path.includes('/0.2.0-rc.1/'),
    ),
  );
  for (const group of ['../escape', 'owner/escape', 'dev..niessen'])
    assert.throws(() => mavenPublicationFiles({ version: '0.2.0' }, group));
  assert.throws(() =>
    mavenPublicationFiles({ version: '../../escape' }, 'dev.niessen'),
  );
});

test('Maven reuse requires every actual public file to match and refuses partial/conflicting coordinates', async () => {
  const candidate = { files };
  assert.equal(
    (
      await inspectMavenPublication(candidate, {
        request: async () => response(bytes),
      })
    ).exists,
    true,
  );
  assert.equal(
    (
      await inspectMavenPublication(candidate, {
        request: async () => response('', 404),
      })
    ).exists,
    false,
  );
  let reads = 0;
  await assert.rejects(
    inspectMavenPublication(candidate, {
      request: async () =>
        ++reads === 1 ? response(bytes) : response('', 404),
    }),
    /partially visible/,
  );
  await assert.rejects(
    inspectMavenPublication(candidate, {
      request: async () => response(Buffer.alloc(bytes.length)),
    }),
    /differs/,
  );
  await assert.rejects(
    inspectMavenPublication(candidate, {
      request: async () => response('', 403),
    }),
    /Cannot inspect/,
  );
});

test('a missing small Maven file can return a bounded larger HTML error page without being mistaken for corruption', async () => {
  assert(bytes.length < 1024);
  const state = await inspectMavenPublication(
    { files },
    {
      request: (url, options) =>
        releaseRequest(url, {
          ...options,
          fetchImpl: async () =>
            new Response('x'.repeat(1024), { status: 404 }),
        }),
    },
  );
  assert.equal(state.exists, false);
});

test('actual ephemeral OpenPGP signatures bind the exact copied Maven bytes and checksum bundle', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ad-mav-'));
  t.after(async () => {
    try {
      await runSigningTool('gpgconf', [
        '--homedir',
        root,
        '--kill',
        'gpg-agent',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  const run = (args, input) =>
    runSigningTool('gpg', ['--homedir', root, '--batch', '--no-tty', ...args], {
      input,
    });
  await run([
    '--pinentry-mode',
    'loopback',
    '--passphrase',
    '',
    '--quick-generate-key',
    'Local Release Fixture <release@example.test>',
    'ed25519',
    'sign',
    '0',
  ]);
  const listed = await run([
    '--with-colons',
    '--fingerprint',
    '--list-secret-keys',
  ]);
  const fingerprint = listed.stdout
    .split('\n')
    .find((line) => line.startsWith('fpr:'))
    .split(':')[9];
  const key = await run(['--armor', '--export-secret-keys', fingerprint]);
  const publicKey = await run(['--armor', '--export', fingerprint]);
  assert.equal(
    (await inspectMavenPublicKey(Buffer.from(publicKey.stdout), fingerprint))
      .fingerprint,
    fingerprint,
  );
  await assert.rejects(
    inspectMavenPublicKey(Buffer.from(publicKey.stdout), 'A'.repeat(40)),
    /disagree/,
  );
  await assert.rejects(
    inspectMavenPublicKey(Buffer.from(key.stdout), fingerprint),
    /public signing key/,
  );
  for (const file of files) await writeFile(join(root, file.name), bytes);
  const output = join(root, 'result');
  const bundle = await signMavenBundle(
    { directory: root, files, fingerprint },
    output,
    { env: { ...process.env, MAVEN_SIGNING_KEY: key.stdout } },
  );
  assert.equal(bundle.fingerprint, fingerprint);
  const listing = await runSigningTool('unzip', ['-Z1', bundle.archive]);
  assert.equal(listing.stdout.trim().split('\n').length, 90);
  assert(!listing.stdout.includes('signing-public-key'));
  for (const file of files) {
    const path = join(output, 'bundle', file.path);
    assert.deepEqual(await readFile(path), bytes);
    assert.equal(
      (await readFile(path + '.sha256', 'utf8')).trim(),
      digest(bytes),
    );
    const verified = await run([
      '--status-fd',
      '1',
      '--verify',
      path + '.asc',
      path,
    ]);
    verifyGpgStatus(verified.stdout, fingerprint);
    for (const state of ['EXPSIG', 'EXPKEYSIG', 'REVKEYSIG'])
      assert.throws(
        () =>
          verifyGpgStatus(
            verified.stdout + `\n[GNUPG:] ${state} fixture\n`,
            fingerprint,
          ),
        /Expired/,
      );
  }
  const first = join(output, 'bundle', files[0].path);
  await writeFile(first, 'tampered after signing');
  await assert.rejects(
    run(['--verify', first + '.asc', first]),
    /signing command failed/,
  );
  assert(!bundle.publicKey.includes('PRIVATE'));
  await assert.rejects(
    signMavenBundle(
      { directory: root, files, fingerprint: 'A'.repeat(40) },
      join(root, 'wrong-key'),
      { env: { ...process.env, MAVEN_SIGNING_KEY: key.stdout } },
    ),
  );
  assert.throws(() =>
    verifyGpgStatus(`[GNUPG:] VALIDSIG ${'B'.repeat(40)} 1 2 3`, fingerprint),
  );
  await access(bundle.publicKey);
});

test('Central publication validates before publishing and retains a credential-free deployment receipt', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ad-central-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, 'bundle.zip');
  await writeFile(archive, bytes);
  const bundle = {
    archive,
    sha256: digest(bytes),
    fingerprint: 'A'.repeat(40),
  };
  const deploymentId = '28570f16-da32-4c14-bd2e-c1acc0782365';
  const states = [
    'PENDING',
    'VALIDATING',
    'VALIDATED',
    'PUBLISHING',
    'PUBLISHED',
  ];
  const events = [];
  const receiptPath = join(root, 'receipt.json');
  const result = await publishCentralBundle(bundle, {
    version: '0.2.0',
    token: 'dW5pdDp0ZXN0',
    receiptPath,
    wait: async () => {},
    request: async (url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer dW5pdDp0ZXN0');
      if (url.includes('/upload?')) {
        assert(url.includes('publishingType=USER_MANAGED'));
        assert(options.body instanceof FormData);
        events.push('upload');
        return response(deploymentId, 201);
      }
      if (url.includes('/status?')) {
        const deploymentState = states.shift();
        events.push(deploymentState);
        return response({ deploymentId, deploymentState });
      }
      assert(url.endsWith('/deployment/' + deploymentId));
      assert.equal(events.at(-1), 'VALIDATED');
      events.push('publish');
      return response('', 204);
    },
  });
  assert.equal(result.complete, true);
  assert.deepEqual(events, [
    'upload',
    'PENDING',
    'VALIDATING',
    'VALIDATED',
    'publish',
    'PUBLISHING',
    'PUBLISHED',
  ]);
  const retained = await readFile(receiptPath, 'utf8');
  assert(retained.includes(deploymentId));
  assert(!retained.includes('dW5pdDp0ZXN0'));
});

test('Central failed validation never publishes or deletes the deployment and leaves its ID for recovery', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'ad-central-fail-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, 'bundle.zip');
  await writeFile(archive, bytes);
  const receiptPath = join(root, 'receipt.json');
  const deploymentId = '28570f16-da32-4c14-bd2e-c1acc0782365';
  await assert.rejects(
    publishCentralBundle(
      { archive, sha256: digest(bytes), fingerprint: 'A'.repeat(40) },
      {
        version: '0.2.0',
        token: 'dW5pdDp0ZXN0',
        receiptPath,
        wait: async () => {},
        request: async (url, options) => {
          assert.equal(options.method, 'POST');
          if (url.includes('/upload?')) return response(deploymentId, 201);
          assert(url.includes('/status?'));
          return response({
            deploymentId,
            deploymentState: 'FAILED',
            errors: ['private remote diagnostic intentionally omitted'],
          });
        },
      },
    ),
    /Central rejected/,
  );
  const receipt = JSON.parse(await readFile(receiptPath));
  assert.equal(receipt.complete, false);
  assert.equal(receipt.deploymentId, deploymentId);
  assert(!JSON.stringify(receipt).includes('private remote diagnostic'));
});
