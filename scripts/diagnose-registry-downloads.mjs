import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import {
  githubPackageHeaders,
  githubPackageRegistries,
} from './lib/github-packages.mjs';

// Read-only observations. Never print request headers, response bodies or signed redirect URLs.
const repository = process.env.GITHUB_REPOSITORY;
const registry = githubPackageRegistries(repository);
const version = process.env.DIAGNOSTIC_VERSION;
assert.match(version ?? '', /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/);
const observations = [];
async function observe(address, kind, label, metadata = false) {
  const url = new URL(address);
  assert.equal(url.origin, new URL(registry[kind]).origin);
  assert(!url.username && !url.password && !url.hash && !url.search);
  try {
    const response = await fetch(url, {
      headers: githubPackageHeaders(kind),
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    const location = response.headers.get('location');
    const target = location ? new URL(location, url) : null;
    observations.push({
      label,
      status: response.status,
      redirectOrigin: target?.origin ?? null,
      redirectHasQuery: target ? Boolean(target.search) : false,
    });
    if (metadata && response.status === 200) {
      const text = await response.text();
      assert(text.length <= 16 * 1024 * 1024);
      return JSON.parse(text);
    }
    await response.body?.cancel();
  } catch (error) {
    const code = error.cause?.code;
    observations.push({
      label,
      error: error instanceof Error ? error.name : 'unknown',
      code:
        typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code)
          ? code
          : null,
    });
  }
}
const name = `${registry.scope}/contracts`;
const metadata = await observe(
  `${registry.npm}/${encodeURIComponent(name)}`,
  'npm',
  'npm-metadata',
  true,
);
const archive = metadata?.versions?.[version]?.dist?.tarball;
if (typeof archive === 'string') await observe(archive, 'npm', 'npm-archive');
await observe(
  `${registry.maven}/dev/niessen/api-docs-parent/${version}/api-docs-parent-${version}.pom`,
  'maven',
  'maven-parent',
);
const report = JSON.stringify({ repository, version, observations }, null, 2);
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `\n\`\`\`json\n${report}\n\`\`\`\n`,
  );
