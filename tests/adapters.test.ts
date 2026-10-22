import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import express from 'express';
import Fastify from 'fastify';
import { createExpressDocs } from '@api-docs/node/express';
import { apiDocsPlugin } from '@api-docs/node/fastify';
import { buildSite } from '@api-docs/cli';
let directory: string;
const server = Fastify();
beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-adapter-'));
  await cp(resolve('examples/demo'), root, {
    recursive: true,
    filter: (path) => !path.includes('.api-docs'),
  });
  const config = join(root, 'docs.config.yaml');
  await writeFile(
    config,
    (await readFile(config, 'utf8')) + '\nbasePath: /docs\n',
  );
  directory = (await buildSite(root)).directory;
});
afterAll(async () => {
  await server.close();
});
describe('framework adapters', () => {
  it('mounts Fastify docs at a subpath and applies authentication to every asset', async () => {
    await server.register(apiDocsPlugin, {
      directory,
      authenticate: async (request, reply) => {
        if (request.headers.authorization !== 'Bearer fixture')
          return reply.code(401).send({ error: 'Authentication required' });
      },
    });
    expect((await server.inject('/docs/assets/reader.js')).statusCode).toBe(
      401,
    );
    const response = await server.inject({
      url: '/docs/guides/introduction/',
      headers: { authorization: 'Bearer fixture' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('/docs/assets/reader.js');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
  it('mounts Express docs behind host middleware and rejects mismatched paths', async () => {
    await expect(
      createExpressDocs({ directory, mountPath: '/wrong' }),
    ).rejects.toThrow(/basePath/);
    const app = express();
    const docs = await createExpressDocs({
      directory,
      authenticate: (request, response, next) => {
        if (request.headers.authorization !== 'Bearer fixture')
          response.sendStatus(401);
        else next();
      },
    });
    app.use(docs.mountPath, docs.router);
    const listener = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => listener.once('listening', resolve));
    const address = listener.address();
    if (!address || typeof address === 'string')
      throw new Error('No TCP listener');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(base + '/docs/search.json')).status).toBe(401);
      const page = await fetch(base + '/docs/guides/quickstart/', {
        headers: { authorization: 'Bearer fixture' },
      });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('Quickstart');
    } finally {
      await new Promise<void>((resolve, reject) =>
        listener.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
