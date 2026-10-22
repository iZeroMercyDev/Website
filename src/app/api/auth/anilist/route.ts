import { NextRequest, NextResponse } from "next/server";
import { getActor, OAUTH_STATE_COOKIE } from "@/server/auth/actor";
import { getAuthSecret } from "@/server/auth/session";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const clientId = process.env.ANILIST_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "AniList not configured" }, { status: 503 });

  const redirectUri = `${req.nextUrl.origin}/api/auth/anilist/callback`;

  // Secure mode: random nonce stored in an httpOnly cookie and checked in the callback (CSRF-safe).
  // Legacy mode (no AUTH_SECRET): keep the old username-in-state behaviour so linking still works.
  const secure = getAuthSecret() !== null;
  const nonce = crypto.randomUUID();
  const state = secure
    ? nonce
    : Buffer.from(JSON.stringify({ username: actor.username, ts: Date.now() })).toString("base64url");

  const url = new URL("https://anilist.co/api/v2/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  if (secure) {
    res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/anilist",
      maxAge: 600,
    });
  }
  return res;
}
