import { fileURLToPath } from 'node:url';
import { auditReleaseVersions } from './lib/release-versions.mjs';

const args = process.argv.slice(2);
if (args.some((arg) => !['--release', '--json'].includes(arg)))
  throw new Error('Use check-versions.mjs [--release] [--json].');
const report = await auditReleaseVersions(
  fileURLToPath(new URL('../', import.meta.url)),
  { release: args.includes('--release') },
);
console.log(
  args.includes('--json')
    ? JSON.stringify(report, null, 2)
    : `Version ${report.version}: ${report.nodePackages} npm packages and ${report.javaPoms} Java POMs aligned (${report.mode}).`,
);
