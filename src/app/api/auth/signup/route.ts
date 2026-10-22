import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/server/security/rate-limit";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { attachSession } from "@/server/auth/cookie";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    const un = (typeof username === "string" ? username : "").trim();

    const rl = rateLimit(`signup:ip:${clientIp(req)}`, 5, 60 * 60 * 1000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    if (un.length < 3)
      return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
    if (un.length > 20)
      return NextResponse.json({ error: "Username must be 20 characters or less." }, { status: 400 });
    if (!/^[a-zA-Z0-9_]+$/.test(un))
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores." },
        { status: 400 }
      );
    if (typeof password !== "string" || password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    if (password.length > 128)
      return NextResponse.json({ error: "Password must be 128 characters or less." }, { status: 400 });

    const existing = await prisma.user.findFirst({
      where: { username: { equals: un, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing)
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username: un, name: un, passwordHash },
      select: { id: true, username: true, role: true },
    });

    const res = NextResponse.json({ user: { username: user.username } });
    await attachSession(res, user);
    return res;
  } catch (e) {
    console.error("signup error", e);
    return NextResponse.json({ error: "Sign-up failed. Please try again." }, { status: 500 });
  }
}
