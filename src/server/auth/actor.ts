import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { SESSION_COOKIE, getAuthSecret, verifySessionToken, type SessionRole } from "./session";

export const OAUTH_STATE_COOKIE = "bankai_oauth_state";

export interface Actor {
  id: string;
  username: string;
  role: SessionRole;
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

let warnedLegacy = false;

/**
 * Who is making this request?
 *
 * - AUTH_SECRET configured  -> identity comes ONLY from the signed session cookie.
 *   A username sent by the client is just a hint and must match the session.
 *   The role is always re-read from the database.
 * - AUTH_SECRET missing     -> legacy mode so the site keeps working: identity is the
 *   claimed username (insecure) and the role is always USER.
 */
export async function getActor(req: Request, claimedUsername?: string | null): Promise<Actor | null> {
  const claimed = claimedUsername?.trim() || null;
  const secret = getAuthSecret();

  if (secret) {
    const session = await verifySessionToken(readCookie(req, SESSION_COOKIE), secret);
    if (!session) return null;
    if (claimed && claimed.toLowerCase() !== session.u.toLowerCase()) return null;
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, username: true, role: true },
    });
    if (!user || !user.username) return null;
    return { id: user.id, username: user.username, role: user.role };
  }

  if (!warnedLegacy) {
    warnedLegacy = true;
    console.warn("[auth] LEGACY MODE: AUTH_SECRET is not set, so user identity is NOT verified. Set AUTH_SECRET (16+ chars).");
  }
  if (!claimed) return null;
  const user = await prisma.user.findFirst({
    where: { username: { equals: claimed, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!user || !user.username) return null;
  return { id: user.id, username: user.username, role: "USER" };
}

export function unauthorized() {
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}

export function canModerate(actor: Actor): boolean {
  return actor.role === "ADMIN" || actor.role === "MODERATOR";
}
