import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getActor, unauthorized, canModerate } from "@/server/auth/actor";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const { sourceId } = await params;
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const row = await prisma.episodeSource.findUnique({
    where: { id: sourceId },
    select: { addedById: true },
  });
  if (!row) return NextResponse.json({ error: "Source not found." }, { status: 404 });
  if (row.addedById !== actor.id && !canModerate(actor))
    return NextResponse.json({ error: "You can only remove sources you added." }, { status: 403 });

  await prisma.episodeSource.delete({ where: { id: sourceId } });
  return NextResponse.json({ ok: true });
}
