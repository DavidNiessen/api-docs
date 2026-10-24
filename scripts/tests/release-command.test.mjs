import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseCommand } from '../lib/release-command.mjs';
import { runSigningTool } from '../lib/maven-publication.mjs';

test('release commands deliver binary input and close unused stdin without losing output', async () => {
  const input = Buffer.from([0, 1, 2, 255]);
  const result = await releaseCommand(
    process.execPath,
    ['-e', "process.stdin.on('data',chunk=>process.stdout.write(chunk));"],
    { input, encoding: 'buffer', timeout: 10_000 },
  );
  assert.deepEqual(result.stdout, input);
  const empty = await releaseCommand(
    process.execPath,
    ['-e', "process.stdout.write('done');"],
    { timeout: 10_000 },
  );
  assert.equal(empty.stdout, 'done');
});

test('a child that exits before consuming a large input rejects safely and signing diagnostics remain redacted', async () => {
  const input = Buffer.alloc(4 * 1024 * 1024, 120);
  for (let attempt = 0; attempt < 4; attempt++)
    await assert.rejects(
      releaseCommand(process.execPath, ['-e', 'process.exit(1)'], {
        input,
        timeout: 10_000,
      }),
    );
  await assert.rejects(
    runSigningTool(
      process.execPath,
      [
        '-e',
        "process.stderr.write('private fixture diagnostic'); process.exit(1)",
      ],
      { input },
    ),
    (error) =>
      /signing command failed/.test(error.message) &&
      !error.message.includes('private fixture diagnostic'),
  );
});
