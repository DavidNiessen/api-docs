import {
  mkdir,
  writeFile,
  readFile,
  cp,
  rename,
  rm,
  stat,
  open,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  compileProject,
  safeOutput,
  writeManifest,
  verifyArtifact,
} from '@api-docs/compiler';
import { guideHref, operationHref } from '@api-docs/contracts';
import type { SiteData } from '@api-docs/contracts';
import { renderDocument } from '@api-docs/reader/render';
import { createSearchIndex } from '@api-docs/search';
export interface BuildOptions {
  config?: string;
  output?: string;
  trustPlugins?: boolean;
}
export async function buildSite(
  root: string,
  options: BuildOptions = {},
): Promise<{ directory: string; site: SiteData }> {
  const project = resolve(root);
  const site = await compileProject(
    project,
    options.config ?? 'docs.config.yaml',
    { trustPlugins: options.trustPlugins ?? false },
  );
  const directory = await safeOutput(
    project,
    options.output ?? '.api-docs/site',
  );
  const stage = await safeOutput(project, `.api-docs/build-${randomUUID()}`);
  const previous = await safeOutput(
    project,
    `.api-docs/previous-${randomUUID()}`,
  );
  const lockPath = join(dirname(directory), '.build.lock');
  const lock = await open(lockPath, 'wx').catch(() => {
    throw new Error(
      'Another build is active. If a process crashed, inspect and remove .api-docs/.build.lock before retrying.',
    );
  });
  try {
    const assets = fileURLToPath(
      new URL(
        './client/assets',
        import.meta.resolve('@api-docs/reader/render'),
      ),
    );
    await cp(assets, join(stage, 'assets'), { recursive: true });
    const pages = new Map<string, string>([
      ['/', site.guides[0]?.title ?? site.config.name],
    ]);
    for (const guide of site.guides) pages.set(guideHref(guide), guide.title);
    for (const api of site.apis)
      for (const operation of api.operations)
        pages.set(operationHref(api, operation), operation.summary);
    for (const [path, title] of pages) {
      const destination = join(stage, path, 'index.html');
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, renderDocument(site, path, { title }));
    }
    await writeFile(
      join(stage, '404.html'),
      renderDocument(site, '/not-found/', {
        title: 'Page not found',
        status: 404,
      }),
    );
    await writeFile(join(stage, 'site.json'), JSON.stringify(site));
    await writeFile(
      join(stage, 'search.json'),
      JSON.stringify(createSearchIndex(site)),
    );
    for (const [from, to] of Object.entries(site.config.redirects)) {
      if (pages.has(from) || pages.has(`${from}/`))
        throw new Error(`Redirect overwrites an existing page: ${from}`);
      const target = to.endsWith('/') ? to : `${to}/`;
      if (!pages.has(target))
        throw new Error(`Redirect destination is not a page: ${to}`);
      const destination = join(stage, from, 'index.html');
      await mkdir(dirname(destination), { recursive: true });
      const href = site.config.basePath + target;
      await writeFile(
        destination,
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${href}"><title>Page moved</title></head><body><a href="${href}">Continue to the new page</a></body></html>`,
      );
    }
    await writeFile(join(stage, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    await writeManifest(stage, site, [...pages.keys()]);
    await verifyArtifact(stage);
    await rm(previous, { recursive: true });
    await rename(directory, previous);
    try {
      await rename(stage, directory);
    } catch (error) {
      await rename(previous, directory);
      throw error;
    }
    await rm(previous, { recursive: true });
    return { directory, site };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    // Preserve a remaining backup if restoring the prior publication failed.
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}
export async function createStaticServer(directory: string, basePath?: string) {
  const root = resolve(directory);
  await stat(join(root, 'index.html'));
  const site = JSON.parse(
    await readFile(join(root, 'site.json'), 'utf8'),
  ) as SiteData;
  const prefix = basePath ?? site.config.basePath;
  const app = Fastify({ logger: false, bodyLimit: 1024 });
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src http: https:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
  });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => ({ status: 'ready' }));
  await app.register(fastifyStatic, {
    root,
    prefix: `${prefix}/`,
    index: ['index.html'],
    dotfiles: 'deny',
    maxAge: 0,
    redirect: true,
  });
  app.setNotFoundHandler(async (_request, reply) => {
    reply.code(404).type('text/html');
    return await readFile(join(root, '404.html'), 'utf8');
  });
  return app;
}
