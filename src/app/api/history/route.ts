import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { ensureAnimeCached } from "@/server/services/ensure-anime";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();
  const user = { id: actor.id };

  const history = await prisma.watchHistory.findMany({
    where: { userId: user.id },
    orderBy: { watchedAt: "desc" },
    take: 100,
    select: {
      id: true,
      animeId: true,
      episodeNumber: true,
      progress: true,
      duration: true,
      completed: true,
      watchedAt: true,
      episodeThumbnail: true,
      Anime: {
        select: {
          id: true,
          title: true,
          titleNative: true,
          coverImage: true,
          bannerImage: true,
          episodes: true,
          format: true,
          seasonYear: true,
          genres: true,
        },
      },
    },
  });

  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  try {
    const {
      username, animeId, episodeNumber, progress, duration, completed,
      episodeThumbnail, animeTitle, animeCover,
    } = await req.json();
    const un = (typeof username === "string" ? username : "").trim();
    const epNum  = typeof episodeNumber === "number" ? episodeNumber : Number(episodeNumber);
    const prog   = typeof progress  === "number" ? progress  : Number(progress  ?? 0);
    const dur    = typeof duration  === "number" ? duration  : Number(duration  ?? 0);
    if (!un || typeof animeId !== "string" || !/^anilist:\d{1,9}$/.test(animeId))
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    if (!Number.isFinite(epNum) || epNum < 1 || epNum > 10000 || !Number.isInteger(epNum))
      return NextResponse.json({ error: "Invalid episode number." }, { status: 400 });
    if (!Number.isFinite(prog) || prog < 0 || prog > 100000 || !Number.isFinite(dur) || dur < 0 || dur > 100000)
      return NextResponse.json({ error: "Invalid progress." }, { status: 400 });

    const actor = await getActor(req, un);
    if (!actor) return unauthorized();
    const user = { id: actor.id };

    const thumb =
      typeof episodeThumbnail === "string" && /^https?:\/\//i.test(episodeThumbnail) && episodeThumbnail.length <= 1000
        ? episodeThumbnail
        : null;

    // WatchHistory needs an Anime row. Never trust client-sent titles/covers:
    // take metadata from AniList (cached). Only if AniList is unreachable, fall back to a minimal row.
    try {
      await ensureAnimeCached(Number(animeId.slice("anilist:".length)));
    } catch {
      const safeTitle =
        typeof animeTitle === "string" && animeTitle.trim() ? animeTitle.trim().slice(0, 200) : animeId;
      const safeCover =
        typeof animeCover === "string" && /^https?:\/\//i.test(animeCover) && animeCover.length <= 500
          ? animeCover
          : null;
      await prisma.anime.upsert({
        where: { id: animeId },
        create: { id: animeId, slug: animeId.replace(":", "-"), title: safeTitle, coverImage: safeCover },
        update: {},
      });
    }

    const entry = await prisma.watchHistory.upsert({
      where: { userId_animeId_episodeNumber: { userId: user.id, animeId, episodeNumber: epNum } },
      create: {
        userId: user.id,
        animeId,
        episodeNumber: epNum,
        progress: prog,
        duration: Math.max(0, dur),
        completed: completed === true,
        watchedAt: new Date(),
        episodeThumbnail: thumb,
      },
      update: {
        progress: prog,
        duration: Math.max(0, dur),
        completed: completed === true,
        watchedAt: new Date(),
        ...(thumb ? { episodeThumbnail: thumb } : {}),
      },
    });

    return NextResponse.json({ entry });
  } catch (e) {
    console.error("history POST error", e);
    return NextResponse.json({ error: "Failed to save history." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim();
  const animeId  = req.nextUrl.searchParams.get("animeId")?.trim();
  const actor = await getActor(req, username);
  if (!actor) return unauthorized();
  const user = { id: actor.id };

  if (animeId) {
    await prisma.watchHistory.deleteMany({ where: { userId: user.id, animeId } });
  } else {
    await prisma.watchHistory.deleteMany({ where: { userId: user.id } });
  }
  return NextResponse.json({ ok: true });
}
