import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createStudioApi } from '../apps/studio/src/api.js';

beforeEach(() =>
  vi.stubGlobal('location', { origin: 'https://studio.example.test' }),
);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('cancels unread response bytes when malformed UTF-8 fails decoding', async () => {
  const cancel = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([0xff]));
            },
            cancel,
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    ),
  );
  await expect(createStudioApi('')('/api/me')).rejects.toMatchObject({
    status: 0,
  });
  expect(cancel).toHaveBeenCalledTimes(1);
});
it('keeps credentials on canonical management routes with private caching and redirects disabled', async () => {
  const fetch = vi.fn(async () => Response.json({ queued: true }));
  vi.stubGlobal('fetch', fetch);
  const api = createStudioApi('fixture-token');
  expect(
    await api('/api/projects/one/builds?after=cursor', 'POST', {
      sourceId: 'one',
    }),
  ).toEqual({ queued: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    '/api/projects/one/builds?after=cursor',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer fixture-token',
        'Content-Type': 'application/json',
      },
      body: '{"sourceId":"one"}',
    }),
  );
});
it('rejects external, relative, malformed and normalized-away destinations before touching fetch', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const api = createStudioApi('fixture-token');
  for (const path of [
    'https://other.example/api/me',
    '//other.example/api/me',
    'api/me',
    '/assets/source.json',
    '/api/me#fragment',
    'https://[',
    '/api/../auth/logout',
    '/api/%2e%2e/auth/logout',
    '/api\\me',
    '/api/' + 'a'.repeat(8192),
  ]) {
    await expect(api(path)).rejects.toMatchObject({
      status: 0,
      message: 'Invalid management API destination.',
    });
  }
  expect(fetch).not.toHaveBeenCalled();
});
it('returns bounded HTTP rejection details and keeps uncertain server failures distinct without automatic retry', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: 'Project access denied' }, { status: 403 }),
    )
    .mockResolvedValueOnce(
      Response.json(
        { error: 'The request could not be completed' },
        { status: 503 },
      ),
    );
  vi.stubGlobal('fetch', fetch);
  const api = createStudioApi('');
  await expect(
    api('/api/projects/one/builds', 'POST', {}),
  ).rejects.toMatchObject({ status: 403, message: 'Project access denied' });
  await expect(
    api('/api/projects/one/builds', 'POST', {}),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it.each([200, 403])(
  'does not render an unexpected HTML response at HTTP %s',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<script>private fixture</script>', {
            status,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    const api = createStudioApi('');
    await expect(api('/api/me')).rejects.toMatchObject({
      status: status === 403 ? 403 : 0,
    });
    await expect(api('/api/me')).rejects.not.toHaveProperty(
      'message',
      expect.stringContaining('private fixture'),
    );
  },
);
it('cancels an oversized response stream instead of buffering an unbounded management result', async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(4 * 1024 * 1024));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() {
      cancelled = true;
    },
  });
  const fetch = vi.fn(
    async () =>
      new Response(body, { headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetch);
  await expect(
    createStudioApi('')('/api/projects/one/builds'),
  ).rejects.toMatchObject({ status: 0 });
  expect(cancelled).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('propagates view cancellation into transport without retrying an uncertain mutation', async () => {
  const fetch = vi.fn(
    async (_path: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = options.signal!;
        if (signal.aborted) reject(signal.reason);
        else
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
      }),
  );
  vi.stubGlobal('fetch', fetch);
  const controller = new AbortController();
  const request = createStudioApi('')(
    '/api/projects/one/builds',
    'POST',
    {},
    controller.signal,
  );
  controller.abort();
  await expect(request).rejects.toMatchObject({ status: 0 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('accepts a body-free successful mutation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await expect(
    createStudioApi('')('/api/projects/one/tokens/two', 'DELETE'),
  ).resolves.toBeUndefined();
});
