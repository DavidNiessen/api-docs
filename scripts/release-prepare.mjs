import { parseArgs } from 'node:util';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prepareRelease } from './lib/release-prepare.mjs';

try {
  const { values } = parseArgs({
    options: {
      plan: { type: 'string' },
      apply: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help)
    console.log(`Usage: npm run --silent release:prepare -- --plan <json-file> [--apply]

Verify a reviewed release plan against its clean source checkout.
Default: stage and audit proposed metadata without changing repository files.
--apply updates npm/lock/runtime/Java versions and CHANGELOG.md for Git review.
No commands install packages, commit, tag, push or publish.
Keep the plan outside the checkout, or in its ignored .api-docs directory.`);
  else {
    if (!values.plan || (await stat(values.plan)).size > 16 * 1024 * 1024)
      throw new Error('Supply a release --plan JSON file of at most 16 MiB.');
    const plan = JSON.parse(await readFile(values.plan, 'utf8'));
    console.log(
      JSON.stringify(
        await prepareRelease(
          fileURLToPath(new URL('../', import.meta.url)),
          plan,
          { apply: values.apply },
        ),
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Release preparation failed.',
  );
  process.exitCode = 1;
}
