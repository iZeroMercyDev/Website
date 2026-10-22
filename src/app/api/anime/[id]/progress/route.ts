import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { pushProgressToAniList } from "@/server/services/anilist-push";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const anilistMediaId = Number(id);
    const { username, progress } = await req.json();

    if (!username || typeof progress !== "number" || progress < 1 || progress > 10000 || !Number.isInteger(progress)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const actor = await getActor(req, username as string);
    if (!actor) return NextResponse.json({ synced: false, reason: "not_signed_in" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { anilistToken: true, anilistId: true },
    });

    if (!user?.anilistToken) {
      return NextResponse.json({ synced: false, reason: "no_anilist" });
    }

    await pushProgressToAniList(user.anilistToken, anilistMediaId, progress);
    return NextResponse.json({ synced: true, progress });
  } catch (e) {
    console.error("[anilist-progress]", e);
    return NextResponse.json({ synced: false, reason: "server_error" });
  }
}
