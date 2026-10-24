import assert from 'node:assert/strict';

const origins = new Set([
  'https://registry.npmjs.org',
  'https://central.sonatype.com',
  'https://repo.maven.apache.org',
  'https://ghcr.io',
  'https://npm.pkg.github.com',
  'https://maven.pkg.github.com',
]);

const githubArtifactOrigins = new Map([
  ['https://npm.pkg.github.com', 'https://pkg-npm.githubusercontent.com'],
  [
    'https://maven.pkg.github.com',
    'https://github-registry-files.githubusercontent.com',
  ],
]);
const redirects = new Set([301, 302, 303, 307, 308]);

/** Only opted-in GitHub artifact GETs may redirect, once, without registry credentials. */
export async function releaseRequest(
  address,
  {
    maximum = 16 * 1024 * 1024,
    fetchImpl = fetch,
    allowGitHubArtifactRedirect = false,
    ...options
  } = {},
) {
  const url = new URL(address);
  assert(
    origins.has(url.origin) && !url.username && !url.password && !url.hash,
    'Unexpected release registry destination.',
  );
  assert(
    Number.isSafeInteger(maximum) && maximum > 0 && maximum <= 64 * 1024 * 1024,
  );
  assert.equal(typeof allowGitHubArtifactRedirect, 'boolean');
  if (allowGitHubArtifactRedirect)
    assert(
      githubArtifactOrigins.has(url.origin) &&
        (options.method ?? 'GET') === 'GET' &&
        options.body === undefined,
      'GitHub artifact redirects require a registry GET without a body.',
    );
  const signal = AbortSignal.timeout(120_000);
  async function request(target, init) {
    try {
      return await fetchImpl(target, { ...init, signal });
    } catch {
      // Errors may contain a signed capability URL or an Authorization header.
      throw new Error(
        `Release registry request failed for ${url.origin}; check connectivity and authorization.`,
      );
    }
  }
  async function discard(response) {
    try {
      await response.body?.cancel();
    } catch {
      throw new Error('Registry response could not be discarded safely.');
    }
  }
  let response = await request(url, {
    ...options,
    redirect: allowGitHubArtifactRedirect ? 'manual' : 'error',
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    await discard(response);
    assert(
      allowGitHubArtifactRedirect && redirects.has(response.status),
      'Registry redirects are forbidden.',
    );
    assert(
      typeof location === 'string' &&
        location.length > 0 &&
        location.length <= 8192,
      'Invalid GitHub artifact redirect.',
    );
    let target;
    try {
      target = new URL(location, url);
    } catch {
      throw new Error('Invalid GitHub artifact redirect.');
    }
    assert(
      target.origin === githubArtifactOrigins.get(url.origin) &&
        !target.username &&
        !target.password &&
        !target.hash,
      'GitHub artifact redirect must use its exact approved CDN origin.',
    );
    // A new init deliberately drops every original header, body and credential option.
    response = await request(target, {
      method: 'GET',
      headers: {},
      credentials: 'omit',
      referrer: '',
      referrerPolicy: 'no-referrer',
      redirect: 'manual',
    });
    if (response.status >= 300 && response.status < 400) {
      await discard(response);
      throw new Error('Additional GitHub artifact redirects are forbidden.');
    }
  }
  const length = response.headers.get('content-length');
  if (length !== null) {
    assert(/^\d+$/.test(length));
    assert(Number(length) <= maximum, 'Registry response exceeds its bound.');
  }
  const chunks = [];
  let bytes = 0;
  if (response.body) {
    const reader = response.body.getReader();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        assert(bytes <= maximum, 'Registry response exceeds its bound.');
        chunks.push(chunk.value);
      }
    } catch {
      throw new Error(
        'Registry response exceeds its bound or could not be read safely.',
      );
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Preserve the sanitized read failure; a transport error can expose a signed URL.
      } finally {
        reader.releaseLock();
      }
    }
  }
  return {
    status: response.status,
    bytes: Buffer.concat(chunks, bytes),
    contentDigest: response.headers.get('docker-content-digest'),
  };
}
