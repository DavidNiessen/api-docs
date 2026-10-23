import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createWorkerClient } from '../apps/worker/src/protocol.js';
async function fixture(
  handler: RequestListener,
  run: (origin: string) => Promise<void>,
) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Owned HTTP fixture unavailable');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
const credential = 'fixture-operator-' + 'a'.repeat(32);
it('uses one explicit origin and refuses redirects before forwarding an operator credential', async () => {
  let redirected = 0;
  await fixture(
    (_request, response) => {
      redirected++;
      response.end('{}');
    },
    async (target) => {
      await fixture(
        (request, response) => {
          expect(request.headers.authorization).toBe('Bearer ' + credential);
          response.writeHead(307, { Location: target + '/unexpected' });
          response.end();
        },
        async (origin) => {
          const client = createWorkerClient(origin, credential, true);
          await expect(
            client.claim(
              'worker',
              [randomUUID()],
              new AbortController().signal,
            ),
          ).rejects.toThrow();
        },
      );
    },
  );
  expect(redirected).toBe(0);
});
it('never reflects an error body into the worker error and reports its safe HTTP status', async () => {
  await fixture(
    (_request, response) => {
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'private server secret' }));
    },
    async (origin) => {
      const client = createWorkerClient(origin, credential, true);
      const promise = client.claim(
        'worker',
        [randomUUID()],
        new AbortController().signal,
      );
      await expect(promise).rejects.toMatchObject({
        status: 503,
        message: 'Worker control-plane request failed',
      });
    },
  );
});
it('bounds streamed JSON before parsing and rejects an unexpected response media type', async () => {
  for (const oversized of [false, true]) {
    await fixture(
      (_request, response) => {
        response.writeHead(200, {
          'Content-Type': oversized ? 'application/json' : 'text/html',
        });
        response.end(
          oversized
            ? JSON.stringify({ data: 'x'.repeat(4 * 1024 * 1024 + 1) })
            : '{"lease":null}',
        );
      },
      async (origin) => {
        const client = createWorkerClient(origin, credential, true);
        await expect(
          client.claim('worker', [randomUUID()], new AbortController().signal),
        ).rejects.toThrow(oversized ? 'exceeds budget' : 'did not return JSON');
      },
    );
  }
});
it('cancels a stalled authenticated response body when shutdown or ownership cancellation arrives', async () => {
  let arrive!: () => void;
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  await fixture(
    (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.write('{"lease":');
      arrive();
    },
    async (origin) => {
      const controller = new AbortController();
      const client = createWorkerClient(origin, credential, true);
      const pending = client.claim('worker', [randomUUID()], controller.signal);
      const rejected = expect(pending).rejects.toThrow();
      await arrived;
      controller.abort();
      await rejected;
    },
  );
});
