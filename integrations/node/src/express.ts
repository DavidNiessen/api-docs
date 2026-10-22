import express from 'express';
import type { RequestHandler } from 'express';
import { headers, prepare } from './shared.js';
export interface ExpressDocsOptions {
  directory: string;
  mountPath?: string;
  authenticate?: RequestHandler;
}
export async function createExpressDocs(options: ExpressDocsOptions) {
  const { root, basePath } = await prepare(
    options.directory,
    options.mountPath,
  );
  const router = express.Router();
  if (options.authenticate) router.use(options.authenticate);
  router.use((_request, response, next) => {
    for (const [key, value] of Object.entries(headers))
      response.setHeader(key, value);
    next();
  });
  router.use(
    express.static(root, {
      dotfiles: 'deny',
      etag: true,
      maxAge: 0,
      redirect: true,
      fallthrough: true,
    }),
  );
  router.use((_request, response) => {
    response.status(404).sendFile('404.html', { root });
  });
  return { router, mountPath: basePath || '/', root };
}
