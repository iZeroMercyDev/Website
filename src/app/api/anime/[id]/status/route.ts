import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/server/security/rate-limit";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma }               from "@/server/db";
import { ensureAnimeCached }    from "@/server/services/ensure-anime";
import { pushStatusToAniList }  from "@/server/services/anilist-push";
import type { ListStatus } from "@prisma/client";

const VALID_STATUSES: ListStatus[] = ["WATCHING", "PLAN_TO_WATCH", "COMPLETED", "DROPPED", "ON_HOLD"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return NextResponse.json({ status: null });

  const localId = `anilist:${id}`;
  const entry = await prisma.listEntry.findFirst({
    where: { animeId: localId, userId: actor.id },
    select: { status: true },
  });

  return NextResponse.json({ status: entry?.status ?? null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anilistId = Number(id);
    const { username, status } = await req.json();

    const un = (typeof username === "string" ? username : "").trim();
    if (!un) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const actor = await getActor(req, un);
    if (!actor) return unauthorized();
    const rl = rateLimit(`list-status:${actor.id}`, 30, 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, anilistId: true, anilistToken: true },
    });
    if (!user) return unauthorized();

    const localId = await ensureAnimeCached(anilistId);

    if (status === null) {
      await prisma.listEntry.deleteMany({ where: { userId: user.id, animeId: localId } });
      if (user.anilistToken && user.anilistId) {
        pushStatusToAniList(user.anilistToken, user.anilistId, anilistId, null).catch(console.error);
      }
      return NextResponse.json({ status: null });
    }

    if (!VALID_STATUSES.includes(status))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    const entry = await prisma.listEntry.upsert({
      where:  { userId_animeId: { userId: user.id, animeId: localId } },
      create: { userId: user.id, animeId: localId, status },
      update: { status },
      select: { score: true },
    });

    let anilistError: string | null = null;
    if (user.anilistToken && user.anilistId) {
      try {
        await pushStatusToAniList(user.anilistToken, user.anilistId, anilistId, status, entry.score);
      } catch (err) {
        anilistError = String(err);
        console.error("[anilist-push]", err);
      }
    }

    return NextResponse.json({ status, anilistSynced: !anilistError, anilistError });
  } catch (e) {
    console.error("status post error", e);
    return NextResponse.json({ error: "Couldn't update your list. Please try again." }, { status: 500 });
  }
}
