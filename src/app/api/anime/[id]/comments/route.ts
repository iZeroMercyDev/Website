import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { ensureAnimeCached } from "@/server/services/ensure-anime";

const COMMENT_SELECT = {
  id: true,
  body: true,
  parentId: true,
  episode: true,
  createdAt: true,
  User: { select: { username: true } },
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const localId = `anilist:${id}`;

  const url = new URL(req.url);
  const episodeParam = url.searchParams.get("episode");
  const mode = url.searchParams.get("mode");

  // episode=N → episode-specific; mode=anime → episode IS NULL (general discussion)
  const parsedEpisode = episodeParam !== null ? parseInt(episodeParam, 10) : null;
  const episodeFilter =
    parsedEpisode !== null && Number.isFinite(parsedEpisode) ? { episode: parsedEpisode } :
    mode === "anime"                                          ? { episode: null }          :
    {};

  const all = await prisma.comment.findMany({
    where: { animeId: localId, parentId: null, ...episodeFilter },
    orderBy: { createdAt: "desc" },
    select: {
      ...COMMENT_SELECT,
      other_Comment: {
        orderBy: { createdAt: "asc" },
        select: COMMENT_SELECT,
      },
    },
  });

  const threaded = all.map((c) => ({
    ...c,
    replies: c.other_Comment,
  }));

  return NextResponse.json({ comments: threaded });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anilistId = Number(id);
    const { username, body, parentId, episode } = await req.json();

    const un = (typeof username === "string" ? username : "").trim();
    if (!un) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (typeof body !== "string" || body.trim().length < 1)
      return NextResponse.json({ error: "Comment can't be empty." }, { status: 400 });
    if (body.trim().length > 2000)
      return NextResponse.json({ error: "Comment is too long." }, { status: 400 });

    const actor = await getActor(req, un);
    if (!actor) return unauthorized();
    const user = { id: actor.id };

    const localId = await ensureAnimeCached(anilistId);

    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { animeId: true } });
      if (!parent || parent.animeId !== localId)
        return NextResponse.json({ error: "Comment thread not found." }, { status: 404 });
    }

    const episodeNum = typeof episode === "number" && Number.isInteger(episode) && episode >= 1 && episode <= 10000
      ? episode : null;

    const comment = await prisma.comment.create({
      data: {
        userId:   user.id,
        animeId:  localId,
        parentId: parentId ?? null,
        episode:  episodeNum,
        body:     body.trim(),
      },
      select: COMMENT_SELECT,
    });

    return NextResponse.json({ comment });
  } catch (e) {
    console.error("comment post error", e);
    return NextResponse.json({ error: "Couldn't post your comment. Please try again." }, { status: 500 });
  }
}
