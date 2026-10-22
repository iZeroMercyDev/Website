import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const user = await prisma.user.findUnique({
    where:  { id: actor.id },
    select: { anilistId: true, anilistUsername: true },
  });

  if (!user) return unauthorized();

  return NextResponse.json({
    connected:        !!user.anilistId,
    anilistUsername:  user.anilistUsername ?? null,
    anilistId:        user.anilistId ?? null,
  });
}
