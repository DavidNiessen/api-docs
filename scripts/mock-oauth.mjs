// Loopback-only test provider. Its public demo token is not a production credential.
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const issuer = 'http://127.0.0.1:4020';
const redirectUris = new Set([
  'http://127.0.0.1:4174/gallery/oauth/callback/',
  'http://127.0.0.1:4177/localized/oauth/callback/',
]);
const pending = new Map(),
  codes = new Map();
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  const json = (status, value) =>
    response
      .writeHead(status, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(value));
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }
  const url = new URL(request.url ?? '/', issuer);
  for (const map of [pending, codes])
    for (const [key, value] of map)
      if (value.expiresAt < Date.now()) map.delete(key);
  if (pending.size + codes.size > 1000 || (request.url?.length ?? 0) > 16_384) {
    json(429, { error: 'fixture_limit' });
    return;
  }
  if (url.pathname === '/health') {
    json(200, { status: 'ready' });
    return;
  }
  if (url.pathname === '/authorize' && request.method === 'GET') {
    const parameters = url.searchParams;
    const redirectUri = parameters.get('redirect_uri');
    if (
      parameters.get('client_id') !== 'reader-fixture' ||
      !redirectUris.has(redirectUri) ||
      parameters.get('response_type') !== 'code' ||
      parameters.get('code_challenge_method') !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(parameters.get('code_challenge') ?? '') ||
      !/^[A-Za-z0-9_-]{43}$/.test(parameters.get('state') ?? '') ||
      parameters.get('scope') !== 'projects:read'
    ) {
      json(400, { error: 'invalid_request' });
      return;
    }
    const id = randomUUID();
    pending.set(id, {
      redirectUri,
      state: parameters.get('state'),
      challenge: parameters.get('code_challenge'),
      expiresAt: Date.now() + 300_000,
    });
    response
      .writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "default-src 'none'; form-action 'self' http://127.0.0.1:4174 http://127.0.0.1:4177; base-uri 'none'",
      })
      .end(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>OAuth fixture consent</title></head><body><main><h1>Local OAuth provider fixture</h1><p>Grant the public reader fixture access to projects:read.</p><form method="post" action="/decision?id=${id}"><button name="decision" value="allow">Authorize fixture client</button><button name="decision" value="deny">Deny fixture client</button></form></main></body></html>`,
      );
    return;
  }
  let text = '';
  for await (const chunk of request) {
    text += chunk.toString();
    if (Buffer.byteLength(text) > 8192) {
      json(413, { error: 'too_large' });
      return;
    }
  }
  const parameters = new URLSearchParams(text);
  if (url.pathname === '/decision' && request.method === 'POST') {
    const id = url.searchParams.get('id'),
      transaction = pending.get(id);
    pending.delete(id);
    if (!transaction) {
      json(400, { error: 'invalid_transaction' });
      return;
    }
    const callback = new URL(transaction.redirectUri);
    callback.searchParams.set('state', transaction.state);
    callback.searchParams.set('iss', issuer);
    if (parameters.get('decision') === 'allow') {
      const code = randomUUID();
      codes.set(code, transaction);
      callback.searchParams.set('code', code);
    } else {
      callback.searchParams.set('error', 'access_denied');
      callback.searchParams.set(
        'error_description',
        'sensitive-provider-marker',
      );
    }
    response.writeHead(302, { Location: callback.href }).end();
    return;
  }
  if (url.pathname === '/token' && request.method === 'POST') {
    const code = parameters.get('code'),
      transaction = codes.get(code);
    codes.delete(code);
    const verifier = parameters.get('code_verifier') ?? '';
    if (
      !transaction ||
      parameters.get('client_id') !== 'reader-fixture' ||
      parameters.get('redirect_uri') !== transaction.redirectUri ||
      parameters.get('grant_type') !== 'authorization_code' ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      createHash('sha256').update(verifier).digest('base64url') !==
        transaction.challenge ||
      parameters.has('client_secret')
    ) {
      json(400, {
        error: 'invalid_grant',
        error_description: 'sensitive-provider-marker',
      });
      return;
    }
    json(200, {
      access_token: 'demo-token',
      token_type: 'Bearer',
      expires_in: 60,
      scope: 'projects:read',
    });
    return;
  }
  json(404, { error: 'not_found' });
});
server.listen(4020, '127.0.0.1', () =>
  console.log('Loopback OAuth fixture ready on port 4020.'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => server.close());
