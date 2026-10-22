import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  currentConsumerResults,
  javaEnvironment,
  mavenArguments,
  sanitizeJavaLog,
} from '../lib/java-consumers.mjs';

test('consumer Maven arguments require bounded arrays and preserve the inherited environment', () => {
  assert.deepEqual(mavenArguments(), []);
  assert.deepEqual(mavenArguments('["--settings","a path/settings.xml"]'), [
    '--settings',
    'a path/settings.xml',
  ]);
  for (const value of [
    '{}',
    'false',
    '[5]',
    JSON.stringify(Array(33).fill('argument')),
  ])
    assert.throws(() => mavenArguments(value));
  const original = { PATH: '/original/bin', RETAINED_VALUE: 'fixture' };
  const result = javaEnvironment('/tmp/jdk-home', original);
  assert.equal(result.RETAINED_VALUE, 'fixture');
  assert.equal(result.JAVA_HOME, '/tmp/jdk-home');
  assert(result.PATH.endsWith('/original/bin'));
  assert.deepEqual(original, {
    PATH: '/original/bin',
    RETAINED_VALUE: 'fixture',
  });
});

test('consumer logs omit credentials and Java option dumps while retaining public diagnostics', () => {
  const text =
    'Picked up JAVA_TOOL_OPTIONS: -Dhidden=private-option\nNOTE: Picked up JDK_JAVA_OPTIONS: hidden\npublic diagnostic fixture-env-secret fixture-argument-secret\n';
  const result = sanitizeJavaLog(
    text,
    { SERVICE_TOKEN: 'fixture-env-secret' },
    ['-Dservice.password=fixture-argument-secret'],
  );
  for (const secret of [
    'fixture-env-secret',
    'fixture-argument-secret',
    'private-option',
    'JDK_JAVA_OPTIONS',
  ])
    assert(!result.includes(secret));
  assert(result.includes('public diagnostic'));
});

test('installed consumers require both fresh nonzero JUnit suites without failures or skips', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'api-docs-junit-consumer-'));
  const publication = join(
    directory,
    'TEST-io.apidocs.consumer.PackagedPublicationTest.xml',
  );
  const host = join(directory, 'TEST-io.apidocs.consumer.MvcConsumerTest.xml');
  const summary = (tests, failures = 0, errors = 0, skipped = 0) =>
    `<testsuite tests="${tests}" failures="${failures}" errors="${errors}" skipped="${skipped}"></testsuite>`;
  try {
    await assert.rejects(currentConsumerResults(directory, 'MvcConsumerTest'));
    await writeFile(publication, summary(1));
    await assert.rejects(currentConsumerResults(directory, 'MvcConsumerTest'));
    await writeFile(host, summary(1));
    const passed = await currentConsumerResults(directory, 'MvcConsumerTest');
    assert.equal(passed.length, 2);
    assert.equal(
      passed.reduce((sum, entry) => sum + entry.tests, 0),
      2,
    );
    for (const invalid of [
      summary(0),
      summary(1, 1),
      summary(1, 0, 1),
      summary(1, 0, 0, 1),
      '<testsuite tests="1"/>',
    ]) {
      await writeFile(host, invalid);
      await assert.rejects(
        currentConsumerResults(directory, 'MvcConsumerTest'),
      );
    }
    await writeFile(host, summary(1));
    await assert.rejects(
      currentConsumerResults(directory, 'ReactiveConsumerTest'),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
