import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export async function POST(req: NextRequest) {
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  const actor = await getActor(req, username);
  if (!actor) return unauthorized();

  await prisma.user.update({
    where: { id: actor.id },
    data:  { anilistId: null, anilistUsername: null, anilistToken: null },
  });

  return NextResponse.json({ ok: true });
}
