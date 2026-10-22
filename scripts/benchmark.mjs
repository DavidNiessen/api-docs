import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildSite } from '@api-docs/cli';
import { createSearchIndex, search } from '@api-docs/search';
const count = Number(process.argv[2] ?? 10000);
if (!Number.isInteger(count) || count < 100 || count > 10000)
  throw new Error('Choose 100–10000 operations');
const root = resolve('.api-docs/benchmark', String(Date.now()));
await mkdir(root, { recursive: true });
const paths = {};
const schemas = {};
for (let index = 0; index < count; index++) {
  const name = `Resource${index}`;
  schemas[name] = {
    type: 'object',
    properties: {
      id: { type: 'string', example: 'resource_123' },
      name: { type: 'string' },
      active: { type: 'boolean' },
      score: { type: 'number' },
    },
  };
  paths[`/resources/${index}`] = {
    get: {
      operationId: `resource-${index}`,
      summary: `Retrieve resource ${index}`,
      description: `Retrieve the details of resource ${index} in your workspace.`,
      tags: [`Resources ${index % 10}`],
      responses: {
        200: {
          description: 'Resource details',
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/${name}` },
            },
          },
        },
      },
    },
  };
}
await writeFile(
  resolve(root, 'openapi.json'),
  JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Scale fixture', version: 'v1' },
    paths,
    components: { schemas },
  }),
);
await writeFile(
  resolve(root, 'docs.config.yaml'),
  'name: Scale fixture\nspecs:\n  - id: scale\n    path: openapi.json\n',
);
const start = performance.now();
const built = await buildSite(root);
const duration = performance.now() - start;
const index = createSearchIndex(built.site);
const samples = [];
for (let query = 0; query < 100; query++) {
  const start = performance.now();
  if (!search(index, `resource ${query}`).length)
    throw new Error('Benchmark query returned no results');
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const page = await readFile(
  resolve(built.directory, 'api/scale/v1/resource-9999/index.html').replace(
    'resource-9999',
    `resource-${count - 1}`,
  ),
);
const report = {
  operations: count,
  schemaNodes: count * 5,
  fullBuildSeconds: +(duration / 1000).toFixed(2),
  peakRssMiB: +(process.resourceUsage().maxRSS / 1024).toFixed(1),
  searchP95Ms: +samples[94].toFixed(2),
  sampleCount: samples.length,
  endpointHtmlKiB: +(page.length / 1024).toFixed(1),
  node: process.version,
  vcpusAvailable: (await import('node:os')).availableParallelism(),
};
await writeFile(
  resolve('.api-docs/benchmark-report.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
if (
  report.fullBuildSeconds > 120 ||
  report.peakRssMiB > 2048 ||
  report.searchP95Ms > 100
)
  process.exitCode = 1;
