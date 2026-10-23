import { BlockList, isIP } from 'node:net';

const denied4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  denied4.addSubnet(address, prefix, 'ipv4');
const private4 = new BlockList();
for (const [address, prefix] of [
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const)
  private4.addSubnet(address, prefix, 'ipv4');
const public6 = new BlockList();
public6.addSubnet('2000::', 3, 'ipv6');
const denied6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
] as const)
  denied6.addSubnet(address, prefix, 'ipv6');
const private6 = new BlockList();
private6.addAddress('::1', 'ipv6');
private6.addSubnet('fc00::', 7, 'ipv6');

/** Conservative global-unicast policy; metadata/link-local never become eligible. */
export function isAllowedImportAddress(
  address: string,
  allowPrivate: boolean,
): boolean {
  const family = isIP(address);
  if (family === 4)
    return (
      !denied4.check(address, 'ipv4') ||
      (allowPrivate && private4.check(address, 'ipv4'))
    );
  if (family === 6)
    return (
      (public6.check(address, 'ipv6') && !denied6.check(address, 'ipv6')) ||
      (allowPrivate && private6.check(address, 'ipv6'))
    );
  return false;
}

export function importDestination(
  source: string,
  allowedOrigins: readonly string[],
  allowHttp: boolean,
): URL {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new Error('Spec source must be an absolute HTTP(S) URL');
  }
  if (
    source.length > 4096 ||
    url.username ||
    url.password ||
    url.hash ||
    url.hostname.includes('*') ||
    !(url.protocol === 'https:' || (allowHttp && url.protocol === 'http:'))
  )
    throw new Error(
      'Spec source requires HTTPS without embedded credentials or a fragment; HTTP needs explicit opt-in',
    );
  if (
    !Array.isArray(allowedOrigins) ||
    !allowedOrigins.length ||
    allowedOrigins.length > 16
  )
    throw new Error('Remote imports require 1–16 exact allowed origins');
  const origins = allowedOrigins.map((value) => {
    try {
      const origin = new URL(value);
      if (
        !['http:', 'https:'].includes(origin.protocol) ||
        origin.username ||
        origin.password ||
        origin.search ||
        origin.hash ||
        origin.hostname.includes('*') ||
        origin.pathname !== '/'
      )
        throw new Error();
      return origin.origin;
    } catch {
      throw new Error(
        'Allowed origins must be exact HTTP(S) origins without paths or credentials',
      );
    }
  });
  if (!origins.includes(url.origin))
    throw new Error('Spec source origin is not allowed');
  return url;
}
