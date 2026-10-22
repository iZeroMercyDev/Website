import type { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  getAuthSecret,
  sessionCookieOptions,
  type SessionRole,
} from "./session";

/** Sets the signed session cookie. If AUTH_SECRET is not configured, login still works as before (no cookie). */
export async function attachSession(
  res: NextResponse,
  user: { id: string; username: string | null; role: SessionRole },
): Promise<void> {
  const secret = getAuthSecret();
  if (!secret) {
    console.warn("[auth] AUTH_SECRET missing or too short (<16 chars) — session cookie not set, /admin stays locked.");
    return;
  }
  const token = await createSessionToken({ sub: user.id, u: user.username ?? "", r: user.role }, secret);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
}
