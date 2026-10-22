import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const projects = new Map([
  [
    'proj_k8x92m',
    {
      id: 'proj_k8x92m',
      name: 'My first project',
      description: 'A little space for big ideas.',
      status: 'active',
      created_at: '2026-01-15T10:30:00Z',
      metadata: {},
    },
  ],
]);
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PATCH,DELETE,OPTIONS',
  );
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization,Content-Type,X-Color',
  );
  response.setHeader('Content-Type', 'application/json');
  const send = (status, body) => {
    response.writeHead(status);
    response.end(body === undefined ? undefined : JSON.stringify(body));
  };
  if (request.method === 'OPTIONS') {
    send(204);
    return;
  }
  if (request.headers.authorization !== 'Bearer demo-token') {
    send(401, {
      error: 'unauthorized',
      message: 'Use the public demo token: demo-token',
    });
    return;
  }
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const id = url.pathname.split('/')[3];
  let body = {},
    rawBody = '';
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 8192) {
        send(413, { error: 'too_large' });
        return;
      }
      chunks.push(chunk);
    }
    if (chunks.length) {
      rawBody = Buffer.concat(chunks).toString();
      body = JSON.parse(rawBody);
    }
  } catch {
    send(400, { error: 'invalid_json' });
    return;
  }
  if (url.pathname === '/v1/body-editor' && request.method === 'POST') {
    send(200, { received: rawBody });
  } else if (
    url.pathname.startsWith('/v1/serialization/') &&
    request.method === 'GET'
  ) {
    send(200, { url: request.url, header: request.headers['x-color'] });
  } else if (url.pathname === '/v1/projects' && request.method === 'GET') {
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get('limit') ?? 20)),
    );
    const all = [...projects.values()];
    const start = Math.max(
      0,
      all.findIndex((item) => item.id === url.searchParams.get('cursor')) + 1,
    );
    const data = all.slice(start, start + limit);
    send(200, {
      data,
      has_more: start + limit < all.length,
      next_cursor: start + limit < all.length ? data.at(-1)?.id : null,
    });
  } else if (url.pathname === '/v1/projects' && request.method === 'POST') {
    if (
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 100
    ) {
      send(400, {
        error: 'invalid_request',
        message: 'name must be 1–100 characters',
      });
      return;
    }
    const project = {
      id: `proj_${randomUUID().slice(0, 8)}`,
      name: body.name,
      description: body.description ?? '',
      status: 'active',
      created_at: new Date().toISOString(),
      metadata: {},
    };
    projects.set(project.id, project);
    send(201, project);
  } else if (id && projects.has(id) && request.method === 'GET')
    send(200, projects.get(id));
  else if (id && projects.has(id) && request.method === 'PATCH') {
    const project = projects.get(id);
    for (const key of ['name', 'description'])
      if (typeof body[key] === 'string') project[key] = body[key];
    send(200, project);
  } else if (id && projects.has(id) && request.method === 'DELETE') {
    projects.delete(id);
    send(204);
  } else if (url.pathname === '/v1/api-keys')
    send(200, [{ id: 'key_demo', name: 'Demo', prefix: 'orb_demo_' }]);
  else if (url.pathname === '/v1/webhooks') send(200, []);
  else
    send(404, {
      error: 'not_found',
      message: 'The requested resource does not exist.',
    });
});
server.listen(4010, '127.0.0.1', () =>
  console.log(
    'Mock Orbit API listening on port 4010 (public demo token: demo-token).',
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => server.close());
