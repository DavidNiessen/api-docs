import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { verifyArtifact } from '@api-docs/compiler';
import { confinedPath } from '@api-docs/spec';
import { can, ConflictError } from '@api-docs/domain';
import type { Principal, Project, Repository, Role } from '@api-docs/domain';
import type { SiteData } from '@api-docs/contracts';
import { equalSecret, registerOidc, tokenHash } from './oidc.js';
import type { OidcOptions } from './oidc.js';
declare module 'fastify' {
  interface FastifyRequest {
    principal: Principal | undefined;
  }
}
export interface ServerOptions {
  repository: Repository;
  artifactRoot: string;
  rootToken: string;
  publicUrl: string;
  insecureDevelopment?: boolean;
  oidc?: OidcOptions;
  studioRoot?: string;
}
function fail(statusCode: number, message: string): never {
  throw Object.assign(new Error(message), { statusCode });
}
const id = { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,100}$' };
const roleSchema = {
  type: 'string',
  enum: ['viewer', 'editor', 'publisher', 'admin'],
};
const artifactSchema = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const body = (properties: Record<string, unknown>, required: string[]) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
export async function createServer(options: ServerOptions) {
  if (options.rootToken.length < 32)
    throw new Error('ROOT_TOKEN must contain at least 32 characters');
  const publicUrl = new URL(options.publicUrl);
  if (
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash ||
    publicUrl.username ||
    publicUrl.password ||
    (publicUrl.protocol !== 'https:' &&
      !(
        options.insecureDevelopment &&
        publicUrl.protocol === 'http:' &&
        ['127.0.0.1', 'localhost'].includes(publicUrl.hostname)
      ))
  )
    throw new Error(
      'PUBLIC_URL must be an HTTPS origin; explicit insecure development only permits loopback HTTP',
    );
  const repository = options.repository;
  await repository.initialize();
  await mkdir(options.artifactRoot, { recursive: true });
  const app = Fastify({
    logger: {
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
      ],
      level: process.env.LOG_LEVEL ?? 'warn',
    },
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });
  app.decorateRequest('principal', undefined);
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (request) =>
      !request.url.startsWith('/api/') &&
      !request.url.startsWith('/auth/') &&
      !request.headers.authorization &&
      !request.headers.cookie,
  });
  app.addHook('onRequest', async (request) => {
    const authorization = request.headers.authorization;
    if (authorization) {
      if (!authorization.startsWith('Bearer ') || authorization.length > 1024)
        fail(401, 'Invalid bearer token');
      const raw = authorization.slice(7);
      if (equalSecret(raw, options.rootToken))
        request.principal = { subject: 'root', root: true };
      else {
        const token = await repository.token(tokenHash(raw));
        if (!token) fail(401, 'Invalid or expired bearer token');
        request.principal = {
          subject: token.subject,
          root: false,
          tokenProjectId: token.projectId,
          tokenRole: token.role,
        };
      }
    } else if (request.cookies.docs_session) {
      const subject = await repository.session(
        tokenHash(request.cookies.docs_session),
      );
      if (
        subject?.startsWith('$root:') &&
        equalSecret(subject.slice(6), tokenHash(options.rootToken))
      )
        request.principal = { subject: 'root', root: true };
      else if (subject?.startsWith('$token:')) {
        const token = await repository.token(subject.slice(7));
        if (token)
          request.principal = {
            subject: token.subject,
            root: false,
            tokenProjectId: token.projectId,
            tokenRole: token.role,
          };
      } else if (subject) request.principal = { subject, root: false };
    }
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.cookies.docs_session &&
      !authorization &&
      request.headers.origin !== publicUrl.origin
    )
      fail(403, 'Mutation origin does not match PUBLIC_URL');
  });
  app.addHook('onSend', async (request, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY');
    reply.header(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src ${request.url.startsWith('/docs/') ? 'http: https:' : "'self'"}; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
    );
    reply.header('Cache-Control', 'no-store');
    if (publicUrl.protocol === 'https:')
      reply.header('Strict-Transport-Security', 'max-age=31536000');
  });
  app.setErrorHandler((error, _request, reply) => {
    const typed = error as Error & {
      statusCode?: number;
      validation?: unknown;
    };
    const status =
      typed instanceof ConflictError
        ? 409
        : typed.validation
          ? 400
          : (typed.statusCode ?? 500);
    if (status >= 500) app.log.error({ type: typed.name }, 'Request failed');
    reply.code(status).send({
      error:
        status < 500 ? typed.message : 'The request could not be completed',
    });
  });
  const needProject = async (
    request: FastifyRequest,
    projectId: string,
    role: Role,
  ): Promise<Project> => {
    const project = await repository.project(projectId);
    if (!project) fail(404, 'Project not found');
    const assigned = request.principal
      ? await repository.role(project.id, request.principal.subject)
      : undefined;
    if (!can(request.principal, project, assigned, role))
      fail(request.principal ? 403 : 401, 'Project access denied');
    return project;
  };
  const requireRoot = (request: FastifyRequest) => {
    if (!request.principal?.root)
      fail(403, 'Operator authentication is required');
  };
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const healthy = await repository.healthy();
    return reply
      .code(healthy ? 200 : 503)
      .send({ status: healthy ? 'ready' : 'unavailable' });
  });
  app.get('/api/me', async (request) => ({
    subject: request.principal?.subject ?? null,
    operator: request.principal?.root ?? false,
    oidc: Boolean(options.oidc),
  }));
  app.post('/auth/token', async (request, reply) => {
    if (
      !request.principal ||
      !request.headers.authorization?.startsWith('Bearer ')
    )
      fail(401, 'Bearer authentication required');
    const credential = request.headers.authorization.slice(7);
    const session = randomBytes(32).toString('base64url');
    const subject = request.principal.root
      ? `$root:${tokenHash(options.rootToken)}`
      : `$token:${tokenHash(credential)}`;
    await repository.createSession(
      tokenHash(session),
      subject,
      new Date(Date.now() + 3_600_000),
    );
    reply.setCookie('docs_session', session, {
      path: '/',
      httpOnly: true,
      secure: publicUrl.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 3600,
    });
    return { status: 'signed-in' };
  });
  app.post('/auth/logout', async (request, reply) => {
    if (request.cookies.docs_session)
      await repository.deleteSession(tokenHash(request.cookies.docs_session));
    reply.clearCookie('docs_session', { path: '/' });
    return { status: 'signed-out' };
  });
  if (options.oidc)
    await registerOidc(
      app,
      repository,
      options.oidc,
      publicUrl.origin,
      options.insecureDevelopment ?? false,
    );
  app.get('/api/projects', async (request) => {
    if (!request.principal) fail(401, 'Authentication required');
    const projects = await repository.projects();
    const result = [];
    for (const project of projects) {
      const assigned = await repository.role(
        project.id,
        request.principal.subject,
      );
      if (
        can(
          request.principal,
          { ...project, visibility: 'private' },
          assigned,
          'viewer',
        )
      )
        result.push(project);
    }
    return result;
  });
  app.post<{
    Body: { slug: string; name: string; visibility: 'public' | 'private' };
  }>(
    '/api/projects',
    {
      schema: {
        body: body(
          {
            slug: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,62}$' },
            name: { type: 'string', minLength: 1, maxLength: 100 },
            visibility: { type: 'string', enum: ['public', 'private'] },
          },
          ['slug', 'name', 'visibility'],
        ),
      },
    },
    async (request, reply) => {
      requireRoot(request);
      return reply.code(201).send(
        await repository.createProject({
          ...request.body,
          subject: request.principal!.subject,
        }),
      );
    },
  );
  app.get<{ Params: { project: string } }>(
    '/api/projects/:project/publications',
    async (request) => {
      const project = await needProject(
        request,
        request.params.project,
        'publisher',
      );
      return repository.publications(project.id);
    },
  );
  app.get<{ Params: { project: string } }>(
    '/api/projects/:project/audit',
    async (request) => {
      const project = await needProject(
        request,
        request.params.project,
        'admin',
      );
      return repository.audit(project.id);
    },
  );
  app.put<{
    Params: { project: string };
    Body: { subject: string; role: Role | null };
  }>(
    '/api/projects/:project/roles',
    {
      schema: {
        body: body(
          {
            subject: { type: 'string', minLength: 1, maxLength: 1000 },
            role: { anyOf: [roleSchema, { type: 'null' }] },
          },
          ['subject', 'role'],
        ),
      },
    },
    async (request) => {
      const project = await needProject(
        request,
        request.params.project,
        'admin',
      );
      await repository.setRole(
        project.id,
        request.body.subject,
        request.body.role,
        request.principal!.subject,
      );
      return { status: 'updated' };
    },
  );
  app.post<{ Params: { project: string }; Body: { artifactId: string } }>(
    '/api/projects/:project/artifacts',
    { schema: { body: body({ artifactId: artifactSchema }, ['artifactId']) } },
    async (request) => {
      const project = await needProject(
        request,
        request.params.project,
        'publisher',
      );
      const directory = await confinedPath(
        options.artifactRoot,
        request.body.artifactId,
      );
      const manifest = await verifyArtifact(directory);
      const site = JSON.parse(
        await readFile(join(directory, 'site.json'), 'utf8'),
      ) as SiteData;
      if (site.config.basePath !== `/docs/${project.slug}`)
        fail(400, `Build this project with basePath /docs/${project.slug}`);
      if (manifest.artifactDigest !== request.body.artifactId)
        fail(400, 'Artifact directory must match its artifact digest');
      await repository.registerArtifact(
        project.id,
        request.body.artifactId,
        request.principal!.subject,
      );
      return { artifactId: request.body.artifactId, status: 'verified' };
    },
  );
  app.post<{
    Params: { project: string };
    Body: {
      artifactId: string;
      expectedPublicationId: string | null;
      idempotencyKey: string;
    };
  }>(
    '/api/projects/:project/publications',
    {
      schema: {
        body: body(
          {
            artifactId: artifactSchema,
            expectedPublicationId: {
              anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
            },
            idempotencyKey: { type: 'string', minLength: 1, maxLength: 100 },
          },
          ['artifactId', 'expectedPublicationId', 'idempotencyKey'],
        ),
      },
    },
    async (request, reply) => {
      const project = await needProject(
        request,
        request.params.project,
        'publisher',
      );
      await verifyArtifact(
        await confinedPath(options.artifactRoot, request.body.artifactId),
      );
      return reply
        .code(201)
        .send(
          await repository.publish(
            project.id,
            request.body.artifactId,
            request.body.expectedPublicationId,
            request.body.idempotencyKey,
            request.principal!.subject,
          ),
        );
    },
  );
  app.post<{
    Params: { project: string };
    Body: { label: string; role: Role; expiresInDays: number };
  }>(
    '/api/projects/:project/tokens',
    {
      schema: {
        body: body(
          {
            label: { type: 'string', minLength: 1, maxLength: 80 },
            role: roleSchema,
            expiresInDays: { type: 'integer', minimum: 1, maximum: 90 },
          },
          ['label', 'role', 'expiresInDays'],
        ),
      },
    },
    async (request, reply) => {
      const project = await needProject(
        request,
        request.params.project,
        'admin',
      );
      const token = `dpt_${randomBytes(32).toString('base64url')}`;
      const tokenId = await repository.createToken(
        project.id,
        tokenHash(token),
        request.body.label,
        request.body.role,
        new Date(Date.now() + request.body.expiresInDays * 86_400_000),
        request.principal!.subject,
      );
      return reply.code(201).send({
        id: tokenId,
        token,
        note: 'Copy now. The token is stored only as a hash.',
      });
    },
  );
  app.delete<{ Params: { project: string; token: string } }>(
    '/api/projects/:project/tokens/:token',
    {
      schema: {
        params: body(
          { project: id, token: { type: 'string', format: 'uuid' } },
          ['project', 'token'],
        ),
      },
    },
    async (request) => {
      const project = await needProject(
        request,
        request.params.project,
        'admin',
      );
      await repository.revokeToken(
        project.id,
        request.params.token,
        request.principal!.subject,
      );
      return { status: 'revoked' };
    },
  );
  await app.register(fastifyStatic, {
    root: resolve(options.artifactRoot),
    serve: false,
  });
  const serveDocs = async (
    request: FastifyRequest<{ Params: { slug: string; '*': string } }>,
    reply: FastifyReply,
  ) => {
    const project = await needProject(request, request.params.slug, 'viewer');
    if (!project.activePublicationId) fail(404, 'No publication is available');
    const publications = await repository.publications(project.id);
    const active = publications.find(
      (publication) => publication.id === project.activePublicationId,
    );
    if (!active) fail(503, 'Publication is unavailable');
    const directory = await confinedPath(
      options.artifactRoot,
      active.artifactId,
    );
    let path = request.params['*'] || 'index.html';
    if (path.endsWith('/')) path += 'index.html';
    else if (!extname(path)) {
      return reply.redirect(`/docs/${project.slug}/${path}/`);
    }
    const manifest = await verifyManifest(directory);
    if (!Object.hasOwn(manifest.files, path)) fail(404, 'Page not found');
    const target = await confinedPath(directory, path);
    if (project.visibility === 'private')
      reply
        .header('Cache-Control', 'private, no-store')
        .header('Vary', 'Cookie, Authorization');
    return reply.sendFile(target.slice(directory.length + 1), directory);
  };
  app.get<{ Params: { slug: string; '*': string } }>(
    '/docs/:slug/*',
    serveDocs,
  );
  app.get<{ Params: { slug: string } }>(
    '/docs/:slug',
    async (request, reply) => {
      await needProject(request, request.params.slug, 'viewer');
      return reply.redirect(`/docs/${request.params.slug}/`);
    },
  );
  app.get('/', async (_request, reply) => reply.redirect('/admin/'));
  if (options.studioRoot)
    await app.register(fastifyStatic, {
      root: resolve(options.studioRoot),
      prefix: '/admin/',
      decorateReply: false,
      index: 'index.html',
    });
  else
    app.get('/admin/', async (_request, reply) =>
      reply
        .type('text/html')
        .send(
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>api-docs administration</title></head><body><h1>api-docs administration</h1><p>Use the documented management API to configure projects and publications.</p><a href="/auth/login">Sign in with your identity provider</a></body></html>',
        ),
    );
  return app;
}
async function verifyManifest(
  directory: string,
): Promise<{ files: Record<string, string> }> {
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  ) as { schemaVersion: number; files: Record<string, string> };
  if (manifest.schemaVersion !== 1 || !manifest.files)
    throw new Error('Invalid publication manifest');
  return manifest;
}
