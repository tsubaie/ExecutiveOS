import 'server-only';
import { isIP } from 'node:net';
import { env, type Environment } from '@/core/config/env';
import { proxyList } from '@/core/config/cidr';
// The spec is fixed for the life of a process; keying the cache on it keeps suites that build
// their own configuration from inheriting another suite's proxy list.
let cache: { spec: string; match: ReturnType<typeof proxyList> } | undefined;
function trusted(spec: string) {
  if (cache?.spec !== spec) cache = { spec, match: proxyList(spec) };
  return cache.match;
}
function withoutPort(value: string) {
  if (value.startsWith('[')) {
    const close = value.indexOf(']');
    return close === -1 ? value : value.slice(1, close);
  }
  const parts = value.split(':');
  return parts.length === 2 ? (parts[0] ?? '') : value;
}
// `1.2.3.4:5678`, `[2001:db8::5]:5678`, `fe80::1%eth0` and mixed case all name one address.
function normalize(entry: string) {
  const address = (withoutPort(entry.trim()).split('%')[0] ?? '').toLowerCase();
  return isIP(address) ? address : null;
}
// ADMIN-B20: a proxy appends the address it accepted the connection from, so the rightmost hop
// outside TRUSTED_PROXY_CIDRS is the furthest address this deployment can vouch for; anything a
// client prepends sits to its left and is ignored. With no proxy configured nothing is verifiable,
// and the caller gets null rather than a placeholder every request would share.
export function clientIp(request: Request, config: Environment = env()) {
  const match = trusted(config.TRUSTED_PROXY_CIDRS);
  if (!match) return null;
  const chain = (request.headers.get('x-forwarded-for') ?? '').split(',');
  for (let hop = chain.length - 1; hop >= 0; hop--) {
    const address = normalize(chain[hop] ?? '');
    if (address !== null && !match(address)) return address;
  }
  return null;
}
