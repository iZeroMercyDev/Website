import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIp, tooMany } from "@/server/security/rate-limit";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { ensureAnimeCached } from "@/server/services/ensure-anime";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const localId = `anilist:${id}`;

  const reviews = await prisma.review.findMany({
    where: { animeId: localId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      body: true,
      containsSpoiler: true,
      createdAt: true,
      User: { select: { username: true } },
    },
  });

  return NextResponse.json({ reviews });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anilistId = Number(id);
    const { username, rating, body, containsSpoiler } = await req.json();

    const un = (typeof username === "string" ? username : "").trim();
    if (!un) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 });
    if (typeof body !== "string" || body.trim().length < 5)
      return NextResponse.json({ error: "Review must be at least 5 characters." }, { status: 400 });

    const actor = await getActor(req, un);
    if (!actor) return unauthorized();
    const user = { id: actor.id };
    const rl = rateLimit(`review:${actor.id}`, 5, 60000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const localId = await ensureAnimeCached(anilistId);

    const review = await prisma.review.upsert({
      where: { userId_animeId: { userId: user.id, animeId: localId } },
      create: {
        userId: user.id,
        animeId: localId,
        rating,
        body: body.trim(),
        containsSpoiler: !!containsSpoiler,
      },
      update: {
        rating,
        body: body.trim(),
        containsSpoiler: !!containsSpoiler,
      },
      select: {
        id: true,
        rating: true,
        body: true,
        containsSpoiler: true,
        createdAt: true,
        User: { select: { username: true } },
      },
    });

    return NextResponse.json({ review });
  } catch (e) {
    console.error("review post error", e);
    return NextResponse.json({ error: "Couldn't save your review. Please try again." }, { status: 500 });
  }
}
