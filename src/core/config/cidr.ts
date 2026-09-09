import 'server-only';
import { BlockList, isIP, isIPv4 } from 'node:net';
// TRUSTED_PROXY_CIDRS is a comma-separated mix of bare addresses and CIDR blocks. Parsing lives
// here rather than beside the resolver so env.ts can reject a malformed entry at startup without
// importing the request layer, which would close an import cycle.
function entries(spec: string) {
  return spec
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
function add(list: BlockList, entry: string) {
  const slash = entry.indexOf('/');
  const address = slash === -1 ? entry : entry.slice(0, slash);
  if (!isIP(address)) return false;
  const type = isIPv4(address) ? 'ipv4' : 'ipv6';
  if (slash === -1) {
    list.addAddress(address, type);
    return true;
  }
  const prefix = entry.slice(slash + 1);
  const width = type === 'ipv4' ? 32 : 128;
  if (!/^\d{1,3}$/u.test(prefix) || Number(prefix) > width) return false;
  list.addSubnet(address, Number(prefix), type);
  return true;
}
export function validProxyCidrs(spec: string) {
  const list = new BlockList();
  return entries(spec).every((entry) => add(list, entry));
}
// Null means no proxy is configured, which is different from a configured proxy that matches
// nothing: the caller must be able to tell "cannot know" from "known and untrusted".
export function proxyList(spec: string) {
  const list = new BlockList();
  const parsed = entries(spec);
  if (parsed.length === 0 || !parsed.every((entry) => add(list, entry))) return null;
  return (address: string) => list.check(address, isIPv4(address) ? 'ipv4' : 'ipv6');
}
