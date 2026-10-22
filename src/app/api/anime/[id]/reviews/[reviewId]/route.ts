import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getActor, unauthorized, canModerate } from "@/server/auth/actor";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { reviewId } = await params;
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const row = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true },
  });
  if (!row) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (row.userId !== actor.id && !canModerate(actor))
    return NextResponse.json({ error: "You can only delete your own review." }, { status: 403 });

  await prisma.review.delete({ where: { id: reviewId } });
  return NextResponse.json({ ok: true });
}
