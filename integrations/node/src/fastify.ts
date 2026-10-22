import type { FastifyPluginAsync, onRequestHookHandler } from 'fastify';
import fastifyStatic from '@fastify/static';
import { headers, prepare } from './shared.js';
export interface FastifyDocsOptions {
  directory: string;
  mountPath?: string;
  authenticate?: onRequestHookHandler;
}
export const apiDocsPlugin: FastifyPluginAsync<FastifyDocsOptions> = async (
  app,
  options,
) => {
  const { root, basePath, allowsPath, hasNotFoundPage } = await prepare(
    options.directory,
    options.mountPath,
  );
  if (options.authenticate) app.addHook('onRequest', options.authenticate);
  app.addHook('onSend', async (_request, reply) => {
    for (const [key, value] of Object.entries(headers))
      reply.header(key, value);
  });
  await app.register(fastifyStatic, {
    root,
    prefix: `${basePath}/`,
    index: ['index.html'],
    dotfiles: 'deny',
    maxAge: 0,
    redirect: true,
    allowedPath: (pathname) => allowsPath(pathname),
  });
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404);
    return hasNotFoundPage
      ? reply.sendFile('404.html')
      : reply.type('text/plain').send('Not found');
  });
};
