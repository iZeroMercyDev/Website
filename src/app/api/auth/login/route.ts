import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/server/security/rate-limit";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { attachSession } from "@/server/auth/cookie";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const un = (typeof username === "string" ? username : "").trim();

    if (!un || typeof password !== "string" || !password)
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });

    const byIp = rateLimit(`login:ip:${clientIp(req)}`, 20, 15 * 60 * 1000);
    const byUser = rateLimit(`login:user:${un.toLowerCase()}`, 8, 15 * 60 * 1000);
    if (!byIp.ok || !byUser.ok) return tooMany(Math.max(byIp.retryAfter, byUser.retryAfter));

    if (password.length > 128)
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });

    const user = await prisma.user.findFirst({
      where: { username: { equals: un, mode: "insensitive" } },
      select: { id: true, username: true, passwordHash: true, role: true },
    });

    if (!user || !user.passwordHash)
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });

    const res = NextResponse.json({ user: { username: user.username } });
    await attachSession(res, user);
    return res;
  } catch (e) {
    console.error("login error", e);
    return NextResponse.json({ error: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
