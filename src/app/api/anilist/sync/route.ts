import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/server/security/rate-limit";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma }          from "@/server/db";
import { syncAniListList } from "@/server/services/anilist-sync";

export async function POST(req: NextRequest) {
  const { username } = (await req.json().catch(() => ({}))) as { username?: string };
  const actor = await getActor(req, username);
  if (!actor) return unauthorized();
  const rl = rateLimit(`anilist-sync:${actor.id}`, 3, 5 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const user = await prisma.user.findUnique({
    where:  { id: actor.id },
    select: { id: true, anilistId: true, anilistToken: true },
  });

  if (!user) return unauthorized();
  if (!user.anilistId || !user.anilistToken) {
    return NextResponse.json({ error: "AniList not connected" }, { status: 400 });
  }

  try {
    const count = await syncAniListList(user.id, user.anilistToken, user.anilistId);
    return NextResponse.json({ synced: count });
  } catch (err) {
    console.error("[anilist/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
