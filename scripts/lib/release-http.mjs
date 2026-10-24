import assert from 'node:assert/strict';

const origins = new Set([
  'https://registry.npmjs.org',
  'https://central.sonatype.com',
  'https://repo.maven.apache.org',
  'https://ghcr.io',
]);

/** Release credentials and bytes must never follow registry-controlled redirects. */
export async function releaseRequest(
  address,
  { maximum = 16 * 1024 * 1024, fetchImpl = fetch, ...options } = {},
) {
  const url = new URL(address);
  assert(
    origins.has(url.origin) && !url.username && !url.password && !url.hash,
    'Unexpected release registry destination.',
  );
  assert(
    Number.isSafeInteger(maximum) && maximum > 0 && maximum <= 64 * 1024 * 1024,
  );
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new Error(
      `Release registry request failed for ${url.origin}; check connectivity and authorization.`,
    );
  }
  assert(
    response.status < 300 || response.status >= 400,
    'Registry redirects are forbidden.',
  );
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
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  return {
    status: response.status,
    bytes: Buffer.concat(chunks, bytes),
    contentDigest: response.headers.get('docker-content-digest'),
  };
}
