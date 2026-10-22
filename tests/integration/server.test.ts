import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID, randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { PostgresRepository } from '@api-docs/storage';
import { createServer } from '@api-docs/server';
import { buildSite } from '@api-docs/cli';
import { verifyArtifact } from '@api-docs/compiler';
import type { Project, Publication } from '@api-docs/domain';
const database = process.env.TEST_DATABASE_URL;
if (!database)
  throw new Error(
    'TEST_DATABASE_URL is required: integration tests never silently skip the database',
  );
const repository = new PostgresRepository(database, { migrate: true });
const rootToken = randomBytes(32).toString('base64url');
const auth = { authorization: `Bearer ${rootToken}` };
let server: Awaited<ReturnType<typeof createServer>>;
let project: Project;
let artifactId: string;
let publication: Publication;
let viewer: { id: string; token: string };
const slug = `test-${randomUUID().slice(0, 8)}`;
let provider: FastifyInstance;
let issuer = '';
let nonce = '';
beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'api-docs-server-'));
  const source = join(root, 'source');
  const store = join(root, 'artifacts');
  await cp(resolve('examples/demo'), source, {
    recursive: true,
    filter: (path) => !path.includes('.api-docs'),
  });
  const config = join(source, 'docs.config.yaml');
  await writeFile(
    config,
    (await readFile(config, 'utf8')) + `\nbasePath: /docs/${slug}\n`,
  );
  const build = await buildSite(source);
  artifactId = (await verifyArtifact(build.directory)).artifactDigest;
  await cp(build.directory, join(store, artifactId), { recursive: true });
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'test-key',
    alg: 'RS256',
    use: 'sig',
  };
  provider = Fastify();
  provider.get('/.well-known/openid-configuration', async () => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
  }));
  provider.get('/jwks', async () => ({ keys: [jwk] }));
  provider.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, body, done) => done(null, new URLSearchParams(String(body))),
  );
  provider.post('/token', async (request) => {
    const form = request.body as URLSearchParams;
    if (!form.get('code_verifier') || form.get('code') !== 'fixture-code')
      throw new Error('Invalid fixture exchange');
    return {
      id_token: await new SignJWT({ nonce })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setAudience('test-client')
        .setSubject('reader-1')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey),
    };
  });
  issuer = await provider.listen({ host: '127.0.0.1', port: 0 });
  server = await createServer({
    repository,
    artifactRoot: store,
    rootToken,
    publicUrl: 'http://127.0.0.1:8080',
    insecureDevelopment: true,
    oidc: { issuer, clientId: 'test-client' },
  });
  const created = await server.inject({
    method: 'POST',
    url: '/api/projects',
    headers: auth,
    payload: { name: 'Integration', slug, visibility: 'private' },
  });
  expect(created.statusCode).toBe(201);
  project = created.json<Project>();
});
afterAll(async () => {
  await server?.close();
  await provider?.close();
  await repository.close();
});
describe('self-hosted publication and authorization', () => {
  it('checks readiness and protects project creation', async () => {
    expect((await server.inject('/health/ready')).statusCode).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/projects',
          payload: { name: 'No', slug: 'no', visibility: 'public' },
        })
      ).statusCode,
    ).toBe(403);
  });
  it('registers a verified artifact and publishes idempotently', async () => {
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/artifacts`,
          headers: auth,
          payload: { artifactId },
        })
      ).statusCode,
    ).toBe(200);
    const payload = {
      artifactId,
      expectedPublicationId: null,
      idempotencyKey: 'first',
    };
    const result = await server.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/publications`,
      headers: auth,
      payload,
    });
    expect(result.statusCode).toBe(201);
    publication = result.json<Publication>();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/publications`,
          headers: auth,
          payload,
        })
      ).json<Publication>().id,
    ).toBe(publication.id);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/publications`,
          headers: auth,
          payload: { ...payload, idempotencyKey: 'stale' },
        })
      ).statusCode,
    ).toBe(409);
  });
  it('protects every artifact and limits/revokes scoped credentials', async () => {
    for (const path of [
      '',
      'site.json',
      'page-data.json',
      'search.json',
      'assets/reader.js',
      'guides/introduction/',
    ])
      expect((await server.inject(`/docs/${slug}/${path}`)).statusCode).toBe(
        401,
      );
    const token = await server.inject({
      method: 'POST',
      url: `/api/projects/${project.id}/tokens`,
      headers: auth,
      payload: { label: 'Reader', role: 'viewer', expiresInDays: 1 },
    });
    expect(token.statusCode).toBe(201);
    viewer = token.json();
    const headers = { authorization: `Bearer ${viewer.token}` };
    const page = await server.inject({ url: `/docs/${slug}/`, headers });
    expect(page.statusCode).toBe(200);
    expect(page.headers['cache-control']).toContain('no-store');
    expect(page.body).toContain('Introduction');
    expect(
      (
        await server.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/publications`,
          headers,
          payload: {
            artifactId,
            expectedPublicationId: publication.id,
            idempotencyKey: 'forbidden',
          },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: 'DELETE',
          url: `/api/projects/${project.id}/tokens/${viewer.id}`,
          headers: auth,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ url: `/docs/${slug}/search.json`, headers }))
        .statusCode,
    ).toBe(401);
  });
  it('prevents concurrent publishers from losing updates and records audit events', async () => {
    const results = await Promise.all(
      ['concurrent-a', 'concurrent-b'].map((key) =>
        server.inject({
          method: 'POST',
          url: `/api/projects/${project.id}/publications`,
          headers: auth,
          payload: {
            artifactId,
            expectedPublicationId: publication.id,
            idempotencyKey: key,
          },
        }),
      ),
    );
    expect(results.map((result) => result.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const audit = await server.inject({
      url: `/api/projects/${project.id}/audit`,
      headers: auth,
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.body).toContain('publication.activated');
    expect(audit.body).not.toContain(viewer.token);
  });
  it('completes OIDC with state/nonce/PKCE, enforces CSRF and applies role revocation', async () => {
    const login = await server.inject('/auth/login');
    expect(login.statusCode).toBe(302);
    const destination = new URL(String(login.headers.location));
    const state = destination.searchParams.get('state')!;
    nonce = destination.searchParams.get('nonce')!;
    expect(destination.searchParams.get('code_challenge_method')).toBe('S256');
    expect(
      (await server.inject(`/auth/callback?state=${state}&code=fixture-code`))
        .statusCode,
    ).toBe(400);
    const callback = await server.inject({
      url: `/auth/callback?state=${state}&code=fixture-code`,
      cookies: { docs_oidc: state },
    });
    expect(callback.statusCode).toBe(302);
    const session = callback.cookies.find(
      (cookie) => cookie.name === 'docs_session',
    );
    expect(session?.httpOnly).toBe(true);
    const cookies = { docs_session: session!.value };
    expect(
      (await server.inject({ url: `/docs/${slug}/`, cookies })).statusCode,
    ).toBe(403);
    await server.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}/roles`,
      headers: auth,
      payload: { subject: `${issuer}|reader-1`, role: 'viewer' },
    });
    expect(
      (await server.inject({ url: `/docs/${slug}/search.json`, cookies }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/auth/logout',
          cookies,
          headers: { origin: 'https://attacker.example' },
        })
      ).statusCode,
    ).toBe(403);
    await server.inject({
      method: 'PUT',
      url: `/api/projects/${project.id}/roles`,
      headers: auth,
      payload: { subject: `${issuer}|reader-1`, role: null },
    });
    expect(
      (await server.inject({ url: `/docs/${slug}/site.json`, cookies }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/auth/logout',
          cookies,
          headers: { origin: 'http://127.0.0.1:8080' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await server.inject({ url: '/api/me', cookies })).json().subject,
    ).toBe(null);
    expect(
      (
        await server.inject({
          url: `/auth/callback?state=${state}&code=fixture-code`,
          cookies: { docs_oidc: state },
        })
      ).statusCode,
    ).toBe(400);
  });
});
