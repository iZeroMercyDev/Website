import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return NextResponse.json({ settings: null });

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { settings: true, updatedAt: true },
  });

  return NextResponse.json({
    settings:  user?.settings  ?? null,
    updatedAt: user?.updatedAt ?? null,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const { username, settings } = await req.json();
    const un = (typeof username === "string" ? username : "").trim();
    if (!un || !settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const actor = await getActor(req, un);
    if (!actor) return unauthorized();
    const user = { id: actor.id };

    const updated = await prisma.user.update({
      where: { id: user.id },
      data:  { settings },
      select: { updatedAt: true },
    });

    return NextResponse.json({ ok: true, updatedAt: updated.updatedAt });
  } catch (e) {
    console.error("settings PUT error", e);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}
