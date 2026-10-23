import { expect, it } from 'vitest';
import {
  parseRelayPolicy,
  relayDestination,
} from '../apps/server/src/relay-policy.js';

const project = (destinations: unknown[]) => ({
  projects: { example: { destinations } },
});
const rule = { origin: 'https://api.example.test', pathPrefix: '/v1/' };
it('defaults to read-only HTTPS public-network policy and finite resource budgets', () => {
  const policy = parseRelayPolicy(project([rule]));
  expect(policy.projects.example).toMatchObject({
    minimumRole: 'viewer',
    requestHeaders: ['Accept', 'Content-Type', 'Authorization'],
    destinations: [
      {
        ...rule,
        methods: ['GET', 'HEAD'],
        allowHttp: false,
        allowPrivateNetwork: false,
      },
    ],
  });
  expect(policy).toMatchObject({
    maxRequestBytes: 1024 * 1024,
    maxResponseBytes: 2 * 1024 * 1024,
    timeoutMs: 30000,
    maxConcurrent: 16,
    maxConcurrentPerMember: 2,
    perMinute: 30,
  });
});
it.each([
  'http://api.example.test',
  'https://user:secret@api.example.test',
  'https://*.example.test',
  'https://api.example.test/path',
  'https://api.example.test?token=secret',
  'https://api.example.test/#fragment',
  'https://api.exa\nmple.test',
])('rejects unsafe or implicitly cleartext origins %#', (origin) => {
  expect(() => parseRelayPolicy(project([{ ...rule, origin }]))).toThrow();
});
it.each(['/v1', '/v1/../', '//v1/', '/v1/%2f/', '/v1/?query=true'])(
  'rejects noncanonical policy subtrees %#',
  (pathPrefix) => {
    expect(() =>
      parseRelayPolicy(project([{ ...rule, pathPrefix }])),
    ).toThrow();
  },
);
it.each([
  'Cookie',
  'Host',
  'Content-Length',
  'Connection',
  'Proxy-Authorization',
  'X-Forwarded-For',
  'Origin',
  'Referer',
  'User-Agent',
  'Sec-Fetch-Site',
])('cannot grant caller-controlled %s headers', (header) => {
  expect(() =>
    parseRelayPolicy({
      projects: { example: { destinations: [rule], requestHeaders: [header] } },
    }),
  ).toThrow();
});
it('requires separate explicit HTTP/private options, rejects duplicates and unknown credentials', () => {
  expect(
    parseRelayPolicy(
      project([
        {
          ...rule,
          origin: 'http://127.0.0.1:3000',
          allowHttp: true,
          allowPrivateNetwork: true,
        },
      ]),
    ).projects.example!.destinations[0],
  ).toMatchObject({ allowHttp: true, allowPrivateNetwork: true });
  expect(() =>
    parseRelayPolicy(
      project([rule, { ...rule, origin: 'https://api.example.test:443/' }]),
    ),
  ).toThrow(/Duplicate/);
  expect(() =>
    parseRelayPolicy({ ...project([rule]), serviceToken: 'secret' }),
  ).toThrow();
  expect(() =>
    parseRelayPolicy({
      projects: {
        example: { destinations: [rule], requestHeaders: ['Accept', 'accept'] },
      },
    }),
  ).toThrow(/Duplicate/);
  expect(() =>
    parseRelayPolicy(project([{ ...rule, methods: ['CONNECT'] }])),
  ).toThrow();
});
it('matches the most-specific path before checking methods and does not fall back to a broader grant', () => {
  const policy = parseRelayPolicy(
    project([
      { ...rule, methods: ['GET', 'POST'] },
      { ...rule, pathPrefix: '/v1/admin/', methods: ['GET'] },
    ]),
  ).projects.example!;
  expect(
    relayDestination(
      policy,
      'https://api.example.test/v1/items/?api_key=visitor-secret',
      'POST',
    ).url.search,
  ).toBe('?api_key=visitor-secret');
  expect(() =>
    relayDestination(
      policy,
      'https://api.example.test/v1/admin/remove',
      'POST',
    ),
  ).toThrow();
  expect(() =>
    relayDestination(policy, 'https://api.example.test/v10/items', 'GET'),
  ).toThrow();
  expect(() =>
    relayDestination(policy, 'https://api.example.test.evil/v1/items', 'GET'),
  ).toThrow();
});
it.each([
  '/v1/%2f..%2fadmin',
  '/v1/%252fadmin',
  '/v1/%2eadmin',
  '/v1/%00admin',
  '/v1//admin',
  '/v1/../../admin',
  '/v1/back\\slash',
  '/v1/admin#secret',
])('rejects ambiguous or escaping request paths %#', (path) => {
  const policy = parseRelayPolicy(project([rule])).projects.example!;
  expect(() =>
    relayDestination(policy, 'https://api.example.test' + path, 'GET'),
  ).toThrow();
});
it('keeps project count and all budgets bounded', () => {
  for (const limits of [
    { maxRequestBytes: 2 * 1024 * 1024 },
    { maxResponseBytes: 3 * 1024 * 1024 },
    { timeoutMs: 30001 },
    { maxConcurrent: 17 },
    { maxConcurrentPerMember: 5 },
    { perMinute: 61 },
  ])
    expect(() => parseRelayPolicy({ ...project([rule]), ...limits })).toThrow();
  expect(() => parseRelayPolicy({ projects: {} })).toThrow();
  expect(() =>
    parseRelayPolicy({
      projects: Object.fromEntries(
        Array.from({ length: 33 }, (_, index) => [
          'project-' + index,
          { destinations: [rule] },
        ]),
      ),
    }),
  ).toThrow();
});
