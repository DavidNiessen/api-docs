import { renderDocument } from '@api-docs/reader/render';
import { expect, it } from 'vitest';
import { createPageData, normalizePagePath } from '@api-docs/contracts';
import type { SiteData } from '@api-docs/contracts';
import { compileProject } from '@api-docs/compiler';
import { resolve } from 'node:path';
it('bounds navigation and sends only the active operation and reachable schemas', async () => {
  const site = await compileProject(resolve('examples/demo'));
  const api = site.apis[0]!;
  const template = api.operations[0]!;
  api.operations = Array.from({ length: 10_000 }, (_, index) => ({
    ...template,
    id: `operation-${index}`,
    slug: `operation-${index}`,
    description: 'Private route-specific detail '.repeat(10),
    responses: [
      {
        status: '200',
        description: 'OK',
        headers: {},
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Project' },
          },
        },
      },
    ],
  }));
  api.schemas.Unrelated = {
    type: 'object',
    description: 'Do not send this schema to unrelated routes',
  };
  const page: SiteData = createPageData(site, '/api/orbit/v1/operation-9999/');
  expect(page.apis[0]!.operations.length).toBeLessThanOrEqual(21);
  expect(
    page.apis[0]!.operations.find(
      (operation) => operation.id === 'operation-9999',
    )?.description,
  ).toBe('Private route-specific detail '.repeat(10));
  expect(page.apis[0]!.schemas).toHaveProperty('Project');
  expect(page.apis[0]!.schemas).not.toHaveProperty('Unrelated');
  expect(JSON.stringify(page).length).toBeLessThan(50_000);
  expect(normalizePagePath('/docs/index.html')).toBe('/docs/');
});

it('HTML-safe bootstrap data round-trips markup without changing its content', async () => {
  const site = await compileProject(resolve('examples/demo'));
  site.config.description = '</script><script>alert(1)</script>';
  const document = renderDocument(site, '/');
  const json = /id="docs-data">([\s\S]*?)<\/script>/.exec(document)?.[1];
  expect(json).toBeDefined();
  expect(json).not.toContain('<');
  const parsed = JSON.parse(json!) as SiteData;
  expect(parsed.config.description).toBe(site.config.description);
  expect(parsed.guides[0]!.html).toBe(site.guides[0]!.html);
});
