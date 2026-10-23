import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseSource } from './lib/release-assets.mjs';
import { readRegularFile } from './lib/read-regular-file.mjs';
import { releaseRequest } from './lib/release-http.mjs';
import {
  inspectMavenPublication,
  loadMavenPublication,
  mavenRegistry,
  runSigningTool,
  verifyGpgStatus,
} from './lib/maven-publication.mjs';
import {
  javaEnvironment,
  prepareJavaPublications,
  testJavaConsumers,
} from './lib/java-consumers.mjs';

assert.equal(process.argv.length, 2);
const root = process.cwd();
const source = await releaseSource(root, process.env, {
  workflow: 'release-publish.yml',
});
const plan = JSON.parse(
  await readRegularFile(join(root, '.api-docs/publication/plan.json')),
);
const context = { ...source, runId: plan.runId, runAttempt: plan.runAttempt };
const accepted = await loadMavenPublication(root, context, plan);
assert(
  (await inspectMavenPublication(accepted)).exists,
  'Maven Central propagation is incomplete. Retry public verification after publication appears.',
);
const output = join(root, '.api-docs/published-consumers/maven');
await mkdir(output, { recursive: true });
const privateRoot = await mkdtemp(join(tmpdir(), 'ad-public-mvn-'));
const home = join(privateRoot, 'gnupg');
await mkdir(home, { mode: 0o700 });
const gpg = (args, input) =>
  runSigningTool('gpg', ['--homedir', home, '--batch', '--no-tty', ...args], {
    input,
  });
try {
  // The reviewed public key stays in source. No publisher secret or private key is needed here.
  const key = await readRegularFile(
    join(root, 'release-signing-key.asc'),
    1024 * 1024,
  );
  assert(key.toString().startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----'));
  await gpg(['--import'], key);
  for (const file of accepted.files) {
    const signature = await releaseRequest(
      `${mavenRegistry}/${file.path}.asc`,
      { maximum: 1024 * 1024 },
    );
    assert.equal(
      signature.status,
      200,
      'Public Maven detached signature is missing.',
    );
    const target = join(output, file.name);
    await writeFile(
      target,
      await readRegularFile(
        join(accepted.directory, file.name),
        64 * 1024 * 1024,
      ),
      { flag: 'wx' },
    );
    await writeFile(target + '.asc', signature.bytes, { flag: 'wx' });
    const verified = await gpg([
      '--status-fd',
      '1',
      '--verify',
      target + '.asc',
      target,
    ]);
    verifyGpgStatus(verified.stdout, accepted.fingerprint);
    await writeFile(target + '.verification.txt', verified.stdout, {
      flag: 'wx',
    });
  }
  const report = JSON.parse(
    await readRegularFile(join(accepted.directory, 'report.json')),
  );
  const candidate = {
    output,
    report: {
      ...report,
      consumers: [],
      passed: false,
      signaturesVerified: true,
      published: true,
      freshRegistryConsumer: true,
    },
    environment: javaEnvironment(process.env.JAVA_HOME),
    maven:
      process.env.JAVA_CONSUMER_MAVEN ?? join(root, 'integrations/java/mvnw'),
    // A fresh Maven repository guarantees project coordinates resolve from Central, not a local build.
    args: ['-Dmaven.repo.local=' + join(privateRoot, 'empty-m2')],
  };
  await prepareJavaPublications(candidate);
  await testJavaConsumers(candidate, { expectedJava: 21 });
  assert.equal(candidate.report.consumers.length, 2);
  assert(
    candidate.report.consumers.every(
      (entry) => entry.passed && entry.offlineCompilationPassed,
    ),
  );
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        ...context,
        passed: true,
        fingerprint: accepted.fingerprint,
        checks: [
          'public-central-archive-hashes',
          'public-detached-signatures',
          'fresh-maven-repository',
          'installed-mvc-and-webflux',
          'offline-consumer-compilation',
        ],
        files: accepted.files,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log(
    'Public Maven bytes, signatures, fresh MVC/WebFlux consumers and offline compilation passed.',
  );
} finally {
  try {
    await runSigningTool('gpgconf', ['--homedir', home, '--kill', 'gpg-agent']);
  } finally {
    await rm(privateRoot, { recursive: true, force: true });
  }
}
