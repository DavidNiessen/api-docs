import express from 'express';
import type { RequestHandler, Router } from 'express';
import { headers, prepare } from './shared.js';
export interface ExpressDocsOptions {
  directory: string;
  mountPath?: string;
  authenticate?: RequestHandler;
}
export async function createExpressDocs(
  options: ExpressDocsOptions,
): Promise<{ router: Router; mountPath: string; root: string }> {
  const { root, basePath, allowsPath, hasNotFoundPage } = await prepare(
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
  const notFound: RequestHandler = (_request, response) => {
    response.status(404);
    if (hasNotFoundPage) response.sendFile('404.html', { root });
    else response.type('text/plain').send('Not found');
  };
  router.use((request, response, next) => {
    let path: string;
    try {
      path = decodeURIComponent(request.path);
    } catch {
      return notFound(request, response, next);
    }
    if (!allowsPath(path)) return notFound(request, response, next);
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
  router.use(notFound);
  return { router, mountPath: basePath || '/', root };
}
