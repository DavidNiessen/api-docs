import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { buildSite, createStaticServer } from '@api-docs/cli';
import { parse } from 'yaml';

const root = new URL(
  '../.api-docs/lifecycle-browser-fixture/',
  import.meta.url,
);
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await cp(new URL('../examples/lifecycle/', import.meta.url), root, {
  recursive: true,
  filter: (path) => !path.includes('.api-docs'),
});
const file = new URL('v1.yaml', root);
const spec = parse(await readFile(file, 'utf8'));
for (let index = 0; index < 52; index++)
  spec.paths[`/legacy/${index}`] = {
    get: {
      operationId: `zzLegacy${index}`,
      summary: `Legacy resource ${index}`,
      tags: ['Legacy'],
      deprecated: true,
      'x-api-docs-lifecycle': {
        sunsetOn: '2027-06-01',
        migrationUrl: '/guides/migration/#heading-update-your-client',
      },
      responses: { 200: { description: 'OK' } },
    },
  };
await writeFile(file, JSON.stringify(spec));
const built = await buildSite(root.pathname);
const server = await createStaticServer(built.directory);
await server.listen({ host: '127.0.0.1', port: 4176 });
