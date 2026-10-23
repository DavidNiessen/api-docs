import { lookup } from 'node:dns/promises';
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { getProxyForUrl } from 'proxy-from-env';
import { importDestination, isAllowedImportAddress } from './remote-policy.js';

export interface OutboundRequestOptions {
  allowedOrigins: readonly string[];
  allowHttp?: boolean;
  allowPrivateNetwork?: boolean;
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: Uint8Array;
  maxRequestBytes?: number;
  maxBytes?: number;
  timeoutMs?: number;
  expectedStatus?: number;
  signal?: AbortSignal;
}
export interface OutboundResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: Buffer;
  origin: string;
}
export class OutboundRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OutboundRequestError';
  }
}
const error = (code: string, message: string) =>
  new OutboundRequestError(code, message);
export function abortableOutbound<T>(
  pending: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(error('cancelled', 'Outbound request cancelled or timed out'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (failure) => {
        signal.removeEventListener('abort', abort);
        reject(failure);
      },
    );
  });
}
const owned =
  /^(host|content-length|accept-encoding|connection|keep-alive|cookie|cookie2|transfer-encoding|te|trailer|upgrade|expect|via|forwarded|x-forwarded-.*|x-real-ip|proxy-.*|sec-.*)$/i;
export const isAllowedOutboundHeader = (name: string): boolean =>
  /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(name) && !owned.test(name);

/** One bounded HTTP exchange with exact-origin policy, checked/pinned DNS, verified TLS and no redirects. */
export async function requestAllowedOrigin(
  source: string,
  options: OutboundRequestOptions,
): Promise<OutboundResponse> {
  const url = importDestination(
    source,
    options.allowedOrigins,
    options.allowHttp === true,
  );
  const maxBytes = options.maxBytes ?? 16 * 1024 * 1024,
    maxRequestBytes = options.maxRequestBytes ?? 1024 * 1024,
    timeoutMs = options.timeoutMs ?? 30000;
  const method = options.method ?? 'GET';
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 16 * 1024 * 1024 ||
    !Number.isSafeInteger(maxRequestBytes) ||
    maxRequestBytes < 0 ||
    maxRequestBytes > 32 * 1024 * 1024 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 30000 ||
    !['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(
      method,
    ) ||
    (options.expectedStatus !== undefined &&
      (!Number.isInteger(options.expectedStatus) ||
        options.expectedStatus < 200 ||
        options.expectedStatus > 599))
  )
    throw error('limits', 'Invalid bounded outbound request limits or method');
  if (options.body !== undefined && !(options.body instanceof Uint8Array))
    throw error('body', 'Outbound body must contain bytes');
  if (options.body && options.body.byteLength > maxRequestBytes)
    throw error('body', 'Outbound request exceeds its body limit');
  const body =
    options.body === undefined ? undefined : Buffer.from(options.body);
  if (
    body &&
    (body.length > maxRequestBytes ||
      (['GET', 'HEAD'].includes(method) && body.length))
  )
    throw error(
      'body',
      'Outbound request exceeds its body limit or method constraints',
    );
  const headers: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  let headerBytes = url.host.length + 128;
  const supplied = Object.entries(options.headers ?? {});
  if (supplied.length > 64)
    throw error('headers', 'Outbound request supports at most 64 headers');
  for (const [name, value] of supplied) {
    const key = name.toLowerCase();
    if (
      !isAllowedOutboundHeader(name) ||
      Object.hasOwn(headers, key) ||
      typeof value !== 'string' ||
      Array.from(value).some((char) => {
        const code = char.charCodeAt(0);
        return code > 255 || code === 127 || (code < 32 && code !== 9);
      })
    )
      throw error(
        'headers',
        'Invalid, duplicate or transport-owned outbound header',
      );
    headerBytes += name.length + value.length + 4;
    if (headerBytes > 16 * 1024)
      throw error('headers', 'Outbound request headers exceed 16 KiB');
    headers[key] = value;
  }
  headers.host = url.host;
  headers['accept-encoding'] = 'identity';
  if (body !== undefined) headers['content-length'] = String(body.length);
  const signal = AbortSignal.any([
    AbortSignal.timeout(timeoutMs),
    ...(options.signal ? [options.signal] : []),
  ]);
  if (signal.aborted)
    throw error('cancelled', 'Outbound request cancelled or timed out');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(hostname)
      ? [{ address: hostname, family: isIP(hostname) }]
      : await abortableOutbound(
          lookup(hostname, { all: true, verbatim: true }),
          signal,
        );
  } catch {
    throw error(
      signal.aborted ? 'cancelled' : 'dns',
      signal.aborted
        ? 'Outbound request cancelled or timed out'
        : 'Outbound DNS lookup failed',
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
    throw error(
      'network-policy',
      'Outbound destination resolves to a disallowed network address',
    );
  const pinned = addresses[0]!;
  let agent: HttpAgent | HttpsAgent;
  try {
    const proxy = getProxyForUrl(url.href),
      proxyEnv = { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, NO_PROXY: '' };
    if (proxy && !['http:', 'https:'].includes(new URL(proxy).protocol))
      throw error(
        'proxy',
        'Outbound proxy configuration is invalid or unsupported',
      );
    agent =
      url.protocol === 'https:'
        ? new HttpsAgent({ proxyEnv, keepAlive: false })
        : new HttpAgent({ proxyEnv, keepAlive: false });
  } catch {
    throw error(
      'proxy',
      'Outbound proxy configuration is invalid or unsupported',
    );
  }
  try {
    return await new Promise<OutboundResponse>((resolve, reject) => {
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
          method,
          headers,
          maxHeaderSize: 16 * 1024,
          rejectUnauthorized: true,
          agent,
          signal,
        },
        (response) => {
          const fail = (code: string, message: string) => {
            reject(error(code, message));
            response.destroy();
          };
          const status = response.statusCode ?? 0;
          if (
            options.expectedStatus !== undefined &&
            status !== options.expectedStatus
          )
            return fail(
              'status',
              `Outbound source returned HTTP ${status}; redirects are not followed`,
            );
          if (status < 200 || status > 599)
            return fail('protocol', 'Unsupported outbound response status');
          if (
            response.headers['content-encoding'] &&
            response.headers['content-encoding'] !== 'identity'
          )
            return fail('encoding', 'Compressed responses are not accepted');
          const length = response.headers['content-length'];
          if (
            method !== 'HEAD' &&
            status !== 304 &&
            length !== undefined &&
            (!/^\d+$/.test(length) ||
              !Number.isSafeInteger(Number(length)) ||
              Number(length) > maxBytes)
          )
            return fail(
              'response-size',
              'Outbound response exceeds its byte limit',
            );
          let total = 0;
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > maxBytes)
              return fail(
                'response-size',
                'Outbound response exceeds its byte limit',
              );
            chunks.push(chunk);
          });
          response.once('error', () =>
            reject(error('connection', 'Outbound response ended unexpectedly')),
          );
          response.once('aborted', () =>
            reject(error('connection', 'Outbound response ended unexpectedly')),
          );
          response.once('end', () =>
            resolve({
              status,
              headers: Object.fromEntries(
                Object.entries(response.headers).filter(
                  (entry): entry is [string, string | string[]] =>
                    entry[1] !== undefined,
                ),
              ),
              body: Buffer.concat(chunks, total),
              origin: url.origin,
            }),
          );
        },
      );
      req.once('upgrade', (_response, socket) => {
        socket.destroy();
        reject(
          error('protocol', 'Outbound protocol upgrades are not supported'),
        );
      });
      req.once('connect', (_response, socket) => {
        socket.destroy();
        reject(error('protocol', 'Outbound tunnels are not supported'));
      });
      req.once('error', () =>
        reject(
          error(
            signal.aborted ? 'cancelled' : 'connection',
            signal.aborted
              ? 'Outbound request cancelled or timed out'
              : 'Outbound connection or TLS verification failed',
          ),
        ),
      );
      req.end(body);
    });
  } catch (failure) {
    if (failure instanceof OutboundRequestError) throw failure;
    throw error(
      signal.aborted ? 'cancelled' : 'connection',
      signal.aborted
        ? 'Outbound request cancelled or timed out'
        : 'Outbound connection or TLS verification failed',
    );
  } finally {
    agent.destroy();
  }
}
