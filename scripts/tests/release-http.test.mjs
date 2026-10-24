import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseRequest } from '../lib/release-http.mjs';

const routes = [
  ['https://npm.pkg.github.com', 'https://pkg-npm.githubusercontent.com'],
  [
    'https://maven.pkg.github.com',
    'https://github-registry-files.githubusercontent.com',
  ],
];

test('GitHub artifact downloads follow one exact CDN hop without forwarding credentials or request options', async () => {
  for (const [registry, cdn] of routes) {
    const headers = {
      Authorization: 'Bearer unit-registry-secret',
      Cookie: 'unit-cookie',
    };
    const signed = `${cdn}/artifact?signature=unit-capability-secret`;
    let calls = 0,
      signal,
      discarded = false;
    const result = await releaseRequest(`${registry}/artifact`, {
      allowGitHubArtifactRedirect: true,
      headers,
      credentials: 'include',
      referrer: `${registry}/private`,
      maximum: 4,
      fetchImpl: async (url, options) => {
        calls++;
        assert.equal(options.redirect, 'manual');
        if (calls === 1) {
          assert.equal(url.href, `${registry}/artifact`);
          assert.equal(options.headers, headers);
          signal = options.signal;
          return new Response(
            new ReadableStream({
              cancel() {
                discarded = true;
              },
            }),
            {
              status: 302,
              headers: { location: signed },
            },
          );
        }
        assert.equal(url.href, signed);
        assert.equal(options.signal, signal);
        assert.deepEqual(options.headers, {});
        assert.equal(options.credentials, 'omit');
        assert.equal(options.method, 'GET');
        assert.equal(options.body, undefined);
        assert.equal(options.referrer, '');
        assert.equal(options.referrerPolicy, 'no-referrer');
        return new Response('safe', { headers: { 'content-length': '4' } });
      },
    });
    assert.equal(calls, 2);
    assert.equal(discarded, true);
    assert.equal(result.status, 200);
    assert.equal(result.bytes.toString(), 'safe');
    assert.equal(headers.Authorization, 'Bearer unit-registry-secret');
  }
});

test('GitHub artifact redirects reject foreign origins, credentials, fragments and malformed locations before a second request', async () => {
  const locations = [
    'https://attacker.example/file?token=unit-secret',
    'https://pkg-npm.githubusercontent.com.attacker.example/file',
    'https://pkg-npm.githubusercontent.com:444/file',
    'http://pkg-npm.githubusercontent.com/file',
    'https://unit-secret@pkg-npm.githubusercontent.com/file',
    'https://pkg-npm.githubusercontent.com/file#unit-secret',
    'https://github-registry-files.githubusercontent.com/file',
    '/same-registry-location',
    'https://[unit-secret',
    'x'.repeat(8193),
    '',
  ];
  for (const location of locations) {
    let calls = 0;
    await assert.rejects(
      releaseRequest('https://npm.pkg.github.com/file', {
        allowGitHubArtifactRedirect: true,
        fetchImpl: async () => {
          calls++;
          return new Response('', { status: 302, headers: { location } });
        },
      }),
      (error) => !error.message.includes('unit-secret'),
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    releaseRequest('https://maven.pkg.github.com/file', {
      allowGitHubArtifactRedirect: true,
      fetchImpl: async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://pkg-npm.githubusercontent.com/file' },
        }),
    }),
    /exact approved CDN/,
  );
});

test('GitHub artifact redirect opt-in cannot authorize writes, other registries or further hops', async () => {
  for (const [url, options] of [
    ['https://npm.pkg.github.com/file', { method: 'POST' }],
    ['https://npm.pkg.github.com/file', { body: 'unit-secret' }],
    ['https://registry.npmjs.org/file', {}],
  ]) {
    let called = false;
    await assert.rejects(
      releaseRequest(url, {
        ...options,
        allowGitHubArtifactRedirect: true,
        fetchImpl: async () => {
          called = true;
          return new Response('');
        },
      }),
      /require a registry GET/,
    );
    assert.equal(called, false);
  }
  let calls = 0;
  await assert.rejects(
    releaseRequest('https://npm.pkg.github.com/file', {
      allowGitHubArtifactRedirect: true,
      fetchImpl: async () => {
        calls++;
        return new Response('', {
          status: 302,
          headers: {
            location:
              'https://pkg-npm.githubusercontent.com/file?token=unit-secret',
          },
        });
      },
    }),
    /Additional GitHub artifact redirects/,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    releaseRequest('https://npm.pkg.github.com/file', {
      fetchImpl: async (_url, options) => {
        calls++;
        assert.equal(options.redirect, 'error');
        return new Response('', {
          status: 302,
          headers: { location: 'https://pkg-npm.githubusercontent.com/file' },
        });
      },
    }),
    /Registry redirects are forbidden/,
  );
  assert.equal(calls, 1);
});

test('CDN reads retain response bounds and never expose signed locations through fetch or stream failures', async () => {
  for (const failure of ['fetch', 'stream', 'size', 'length']) {
    let calls = 0;
    await assert.rejects(
      releaseRequest('https://npm.pkg.github.com/file', {
        allowGitHubArtifactRedirect: true,
        maximum: 2,
        fetchImpl: async () => {
          calls++;
          if (calls === 1)
            return new Response('', {
              status: 302,
              headers: {
                location:
                  'https://pkg-npm.githubusercontent.com/file?token=unit-capability-secret',
              },
            });
          if (failure === 'fetch')
            throw new Error('failed unit-capability-secret');
          if (failure === 'stream')
            return new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(new Error('stream unit-capability-secret'));
                },
              }),
            );
          if (failure === 'length')
            return new Response('x', { headers: { 'content-length': '3' } });
          return new Response('oversized');
        },
      }),
      (error) => !error.message.includes('unit-capability-secret'),
    );
    assert.equal(calls, 2);
  }
});
