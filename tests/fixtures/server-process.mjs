import { rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createServer } from '../../apps/server/dist/index.js';
import { runProcessLifecycle } from '../../apps/server/dist/process-lifecycle.js';

const scenario = process.argv[2];
const root = process.argv[3];
if (!root) throw new Error('A parent-owned fixture directory is required');
const notify = (event, extra = {}) => process.send?.({ event, ...extra });
let releaseStart;
const starting = new Promise((resolve) => {
  releaseStart = resolve;
});
let releaseRequest;
const request = new Promise((resolve) => {
  releaseRequest = resolve;
});
process.on('message', (message) => {
  if (message === 'release-start') releaseStart();
  if (message === 'release-request') releaseRequest();
});
// A live handle models a pool/resource that must be closed even if startup fails.
const resource = setInterval(() => {}, 60_000);
let app;
await runProcessLifecycle({
  timeoutMs: ['stuck-close', 'slow-start'].includes(scenario) ? 1000 : 5000,
  start: async (signal) => {
    notify('starting');
    if (scenario.startsWith('slow-start')) {
      signal.addEventListener('abort', () => notify('startup-aborted'), {
        once: true,
      });
      await starting;
    }
    if (scenario === 'startup-failure')
      throw new Error('private-startup-detail');
    app = await createServer({
      repository: {
        initialize: async () => {},
        healthy: async () => true,
      },
      rootToken: 'fixture-not-a-live-credential'.repeat(2),
      publicUrl: 'http://127.0.0.1',
      insecureDevelopment: true,
      artifactRoot: root,
    });
    app.get('/slow', async () => {
      notify('request-started');
      await request;
      return { complete: true };
    });
    app.get('/stream', async (_request, reply) =>
      reply.type('text/plain').send(
        Readable.from(
          (async function* () {
            yield 'first\n';
            notify('stream-started');
            await request;
            yield 'last\n';
          })(),
        ),
      ),
    );
    if (signal.aborted) {
      notify('startup-cancelled');
      return;
    }
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    notify('listening', { address });
  },
  close: async () => {
    notify('close-started');
    try {
      if (scenario === 'stuck-close') await new Promise(() => {});
      await app?.close();
      notify('server-closed');
      if (scenario === 'close-failure') throw new Error('private-close-detail');
    } finally {
      clearInterval(resource);
      notify('repository-closed');
      await rm(root, { recursive: true, force: true });
    }
  },
});
process.disconnect?.();
