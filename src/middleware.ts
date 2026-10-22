import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getAuthSecret, verifySessionToken } from "@/server/auth/session";

/** First gate for /admin. Pages also re-check the role in the DB (requireAdmin). */
export async function middleware(req: NextRequest) {
  const secret = getAuthSecret();
  const session = secret ? await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret) : null;

  if (session?.r === "ADMIN") return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/", req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
