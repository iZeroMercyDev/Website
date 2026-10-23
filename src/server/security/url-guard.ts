import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guards for routes that fetch a URL on the visitor's behalf (HLS proxy, downloads).
 * Blocks localhost, private/link-local ranges (e.g. cloud metadata at 169.254.169.254),
 * credentials in URLs, and non-http(s) schemes — including after every redirect.
 *
 * Limitation: the hostname is resolved once to check it, then fetch resolves it again.
 * A hostile DNS server could answer differently the second time (DNS rebinding).
 */

function ipv4Private(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Private(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("::ffff:") || s.startsWith("64:ff9b:")) return true; // IPv4-mapped / NAT64: treat as internal
  if (/^f[cd]/.test(s)) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(s)) return true; // fe80::/10 link-local
  if (s.startsWith("ff")) return true; // multicast
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) return ipv6Private(ip);
  return true; // not a valid IP: refuse
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".intranet", ".home.arpa"];

/** Returns the parsed URL if it is a public http(s) URL, otherwise null. */
export async function assertPublicHttpUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;

  // WHATWG URL already rewrites odd IPv4 forms (2130706433, 0x7f.1) to dotted decimal.
  let host = u.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (!host || host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return null;

  if (isIP(host)) return isPrivateAddress(host) ? null : u;

  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) return null;
  } catch {
    return null;
  }
  return u;
}

/** fetch() that re-validates the target on every redirect hop (max 3). */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 3): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicHttpUrl(current);
    if (!url) throw new Error("Blocked or invalid URL");
    const res = await fetch(url.href, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;
      current = new URL(loc, url).href;
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects");
}
