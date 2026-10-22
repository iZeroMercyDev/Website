import { NextResponse } from "next/server";

/**
 * Small sliding-window rate limiter.
 *
 * NOTE: state lives in this server instance's memory. On serverless (Vercel) each warm
 * instance counts separately, so this blocks casual abuse and brute-force bursts but is
 * not a hard global limit. For that, swap `hit()` for a shared store (e.g. Upstash Redis);
 * callers only use rateLimit(), so nothing else needs to change.
 */
const hits = new Map<string, number[]>();
const MAX_KEYS = 5000;

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > MAX_KEYS) {
    const stale = now - 60 * 60 * 1000;
    for (const [k, v] of hits) {
      if (v.length === 0 || v[v.length - 1] < stale) hits.delete(k);
    }
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please wait a bit and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
