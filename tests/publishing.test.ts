import { describe, expect, it } from 'vitest';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { renderMarkdown } from '@api-docs/content';
import { verifyArtifact } from '@api-docs/compiler';
import { buildSite, createStaticServer } from '@api-docs/cli';
describe('static publishing', () => {
  it('sanitizes active content and creates stable heading links', async () => {
    const output = await renderMarkdown(
      '## Safe heading\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))',
    );
    expect(output.html).not.toContain('<script');
    expect(output.html).not.toContain('href="javascript:');
    expect(output.headings[0]?.id).toBe('heading-safe-heading');
  });
  it('builds deterministic verified output and serves real routes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'api-docs-build-'));
    await cp(resolve('examples/demo'), root, {
      recursive: true,
      filter: (path) => !path.includes('.api-docs'),
    });
    const first = await buildSite(root);
    const manifest1 = await verifyArtifact(first.directory);
    await buildSite(root);
    const manifest2 = await verifyArtifact(first.directory);
    expect(manifest2.files).toEqual(manifest1.files);
    const server = await createStaticServer(first.directory);
    try {
      const page = await server.inject('/api/orbit/v1/create-project/');
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain('Create a project');
      expect(page.headers['content-security-policy']).toContain(
        "script-src 'self'",
      );
      expect((await server.inject('/missing/')).statusCode).toBe(404);
    } finally {
      await server.close();
    }
    const path = join(first.directory, 'index.html');
    await writeFile(path, (await readFile(path, 'utf8')) + 'tampered');
    await expect(verifyArtifact(first.directory)).rejects.toThrow(/checksum/);
  });
  it('does not write outside protected build output', async () => {
    await expect(
      buildSite(resolve('examples/demo'), { output: 'guides' }),
    ).rejects.toThrow(/output/);
  });
});
