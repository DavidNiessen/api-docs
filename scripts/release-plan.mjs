import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createReleasePlan } from './lib/release-plan.mjs';

try {
  const { values } = parseArgs({
    options: {
      initial: { type: 'boolean' },
      since: { type: 'string' },
      version: { type: 'string' },
      date: { type: 'string' },
      notes: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(`Usage: npm run --silent release:plan -- [options]

Read-only release proposal; never edits files, creates tags or publishes.

  --initial          First release, retaining the declared distribution version
  --since <ref>      Local ancestor baseline instead of the highest merged v* tag
  --version <value>  Explicit canonical SemVer target for maintainer review
  --date YYYY-MM-DD  Reproducible notes date (default: current UTC date)
  --notes            Print Markdown notes instead of the JSON plan

Use a full clone with fetched tags. Review dirty state, unclassified commits,
version recommendations and migration notes before preparing a release.`);
  } else {
    const report = await createReleasePlan(
      fileURLToPath(new URL('../', import.meta.url)),
      values,
    );
    console.log(values.notes ? report.notes : JSON.stringify(report, null, 2));
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'Release planning failed.',
  );
  process.exitCode = 1;
}
