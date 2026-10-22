import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, username: true, createdAt: true },
  });
  if (!user) return unauthorized();

  const [listEntries, watchHistory, reviews, comments] = await Promise.all([
    prisma.listEntry.findMany({
      where: { userId: user.id },
      select: {
        status: true, score: true, folder: true, updatedAt: true,
        Anime: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.watchHistory.findMany({
      where: { userId: user.id },
      select: {
        episodeNumber: true, progress: true, duration: true,
        completed: true, watchedAt: true,
        Anime: { select: { id: true, title: true } },
      },
      orderBy: { watchedAt: "desc" },
    }),
    prisma.review.findMany({
      where: { userId: user.id },
      select: {
        rating: true, body: true, containsSpoiler: true, createdAt: true,
        Anime: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.comment.findMany({
      where: { userId: user.id },
      select: {
        body: true, createdAt: true,
        Anime: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { username: user.username, memberSince: user.createdAt },
    list: listEntries.map((e) => ({
      animeId: e.Anime?.id,
      title:   e.Anime?.title,
      status:  e.status,
      score:   e.score ?? null,
      folder:  e.folder ?? null,
      updatedAt: e.updatedAt,
    })),
    watchHistory: watchHistory.map((h) => ({
      animeId: h.Anime?.id,
      title:   h.Anime?.title,
      episode:  h.episodeNumber,
      progress: h.progress,
      duration: h.duration,
      completed: h.completed,
      watchedAt: h.watchedAt,
    })),
    reviews: reviews.map((r) => ({
      animeId: r.Anime?.id,
      title:   r.Anime?.title,
      rating:  r.rating,
      body:    r.body,
      spoiler: r.containsSpoiler,
      createdAt: r.createdAt,
    })),
    comments: comments.map((c) => ({
      animeId: c.Anime?.id,
      title:   c.Anime?.title,
      body:    c.body,
      createdAt: c.createdAt,
    })),
  };

  const json = JSON.stringify(payload, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type":        "application/json",
      "Content-Disposition": `attachment; filename="bankai-${user.username}-export.json"`,
    },
  });
}
