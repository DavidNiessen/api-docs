import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { Worker } from 'node:worker_threads';
import { getProxyForUrl } from 'proxy-from-env';
import { toolVersion } from '@api-docs/contracts';
import { importDestination, isAllowedImportAddress } from './remote-policy.js';

export interface RemoteSpecOptions {
  allowedOrigins: readonly string[];
  allowHttp?: boolean;
  allowPrivateNetwork?: boolean;
  bearerToken?: string;
  expectedSha256?: string;
  maxBytes?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}
export interface RemoteSpecSnapshot {
  source: Buffer;
  sha256: string;
  origin: string;
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new Error('Spec import cancelled or timed out');
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Spec import cancelled or timed out'));
    signal.addEventListener('abort', abort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}
async function validateSource(
  source: Buffer,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) throw new Error('Spec import cancelled or timed out');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(source);
  } catch {
    throw new Error('Imported spec must be valid UTF-8');
  }
  const worker = new Worker(
    new URL('./remote-validation-worker.js', import.meta.url),
    {
      workerData: text,
      resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
    },
  );
  try {
    await abortable(
      new Promise<void>((resolve, reject) => {
        worker.once(
          'message',
          (message: { valid?: boolean; error?: string }) => {
            if (message.valid === true) resolve();
            else
              reject(
                new Error(message.error || 'Imported spec validation failed'),
              );
          },
        );
        worker.once('error', () =>
          reject(
            new Error('Imported spec validation exceeded worker resources'),
          ),
        );
        worker.once('exit', () =>
          reject(
            new Error('Imported spec validation stopped without a result'),
          ),
        );
      }),
      signal,
    );
  } finally {
    await worker.terminate();
  }
}

/** Explicit, bounded snapshot import. Builds never call this network operation. */
export async function downloadSpec(
  source: string,
  options: RemoteSpecOptions,
): Promise<RemoteSpecSnapshot> {
  const url = importDestination(
    source,
    options.allowedOrigins,
    options.allowHttp === true,
  );
  const maxBytes = options.maxBytes ?? 16 * 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 16 * 1024 * 1024 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30_000
  )
    throw new Error(
      'Import limits must be positive integers up to 16 MiB and 30 seconds',
    );
  if (
    options.expectedSha256 !== undefined &&
    !/^[a-f0-9]{64}$/.test(options.expectedSha256)
  )
    throw new Error(
      'Expected source SHA-256 must be 64 lowercase hexadecimal characters',
    );
  if (
    options.bearerToken !== undefined &&
    (!options.bearerToken.trim() ||
      /[\r\n]/.test(options.bearerToken) ||
      options.bearerToken.length > 8192)
  )
    throw new Error('Invalid import bearer credential');
  const signal = AbortSignal.any([
    AbortSignal.timeout(timeoutMs),
    ...(options.signal ? [options.signal] : []),
  ]);
  if (signal.aborted) throw new Error('Spec import cancelled or timed out');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await abortable(
          lookup(hostname, { all: true, verbatim: true }),
          signal,
        );
  } catch {
    throw new Error(
      signal.aborted
        ? 'Spec import cancelled or timed out'
        : 'Spec source DNS lookup failed',
    );
  }
  if (
    !addresses.length ||
    addresses.length > 32 ||
    addresses.some(
      ({ address }) =>
        !isAllowedImportAddress(address, options.allowPrivateNetwork === true),
    )
  )
    throw new Error('Spec source resolves to a disallowed network address');
  const pinned = addresses[0]!;
  // Decide NO_PROXY against the original origin, then pin the actual network
  // destination, including the CONNECT authority when a proxy is in use.
  let agent: HttpAgent | HttpsAgent;
  try {
    const proxy = getProxyForUrl(url.href);
    const proxyEnv = { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, NO_PROXY: '' };
    agent =
      url.protocol === 'https:'
        ? new HttpsAgent({ proxyEnv, keepAlive: false })
        : new HttpAgent({ proxyEnv, keepAlive: false });
  } catch {
    throw new Error(
      'Spec import proxy configuration is invalid or unsupported',
    );
  }
  let bytes: Buffer;
  try {
    bytes = await new Promise<Buffer>((resolve, reject) => {
      const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = request(
        {
          hostname: pinned.address,
          family: pinned.family,
          port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
          ...(url.protocol === 'https:' && !isIP(hostname)
            ? { servername: hostname }
            : {}),
          path: url.pathname + url.search,
          method: 'GET',
          headers: {
            host: url.host,
            accept: 'application/json, application/yaml, text/yaml, text/plain',
            'accept-encoding': 'identity',
            'user-agent': 'api-docs/' + toolVersion,
            ...(options.bearerToken
              ? { authorization: 'Bearer ' + options.bearerToken }
              : {}),
          },
          maxHeaderSize: 16 * 1024,
          rejectUnauthorized: true,
          agent,
          signal,
        },
        (response) => {
          const fail = (message: string) => {
            reject(new Error(message));
            response.destroy();
          };
          if (response.statusCode !== 200)
            return fail(
              'Spec source returned HTTP ' +
                response.statusCode +
                '; redirects are not followed',
            );
          if (
            response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity'
          )
            return fail('Compressed spec responses are not accepted');
          const length = response.headers['content-length'];
          if (
            length !== undefined &&
            (!/^\d+$/.test(length) ||
              !Number.isSafeInteger(Number(length)) ||
              Number(length) > maxBytes)
          )
            return fail('Spec source exceeds the import byte limit');
          let total = 0;
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > maxBytes)
              return fail('Spec source exceeds the import byte limit');
            chunks.push(chunk);
          });
          response.once('error', () =>
            reject(new Error('Spec source response ended unexpectedly')),
          );
          response.once('aborted', () =>
            reject(new Error('Spec source response ended unexpectedly')),
          );
          response.once('end', () => resolve(Buffer.concat(chunks, total)));
        },
      );
      req.once('error', () =>
        reject(
          new Error(
            signal.aborted
              ? 'Spec import cancelled or timed out'
              : 'Spec source connection or TLS verification failed',
          ),
        ),
      );
      req.end();
    });
  } finally {
    agent.destroy();
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (options.expectedSha256 !== undefined && options.expectedSha256 !== sha256)
    throw new Error('Imported source does not match the expected SHA-256');
  await validateSource(bytes, signal);
  return { source: bytes, sha256, origin: url.origin };
}
