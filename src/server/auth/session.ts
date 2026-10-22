/**
 * Signed session cookie (HMAC-SHA256, Web Crypto).
 * Edge-safe on purpose: imported by middleware.ts, so no Node-only or DB imports here.
 */
export const SESSION_COOKIE = "bankai_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionRole = "USER" | "MODERATOR" | "ADMIN";

export interface SessionPayload {
  sub: string; // user id
  u: string; // username
  r: SessionRole;
  exp: number; // unix seconds
}

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str: string) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Returns the secret, or null when AUTH_SECRET is missing / too weak (sessions are then disabled). */
export function getAuthSecret(): string | null {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s || s.length < 16 || s === "changeme-in-production") return null;
  return s;
}

function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

export async function createSessionToken(
  p: Omit<SessionPayload, "exp">,
  secret: string,
  ttlSeconds: number = SESSION_MAX_AGE,
): Promise<string> {
  const payload: SessionPayload = { ...p, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const key = await hmacKey(secret, ["verify"]);
    // crypto.subtle.verify compares in constant time
    const ok = await crypto.subtle.verify("HMAC", key, fromB64Url(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(parts[0]))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (typeof payload.sub !== "string" || typeof payload.r !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
