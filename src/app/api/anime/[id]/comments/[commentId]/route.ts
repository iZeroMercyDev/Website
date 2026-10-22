import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getActor, unauthorized, canModerate } from "@/server/auth/actor";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { commentId } = await params;
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const row = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });
  if (!row) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  if (row.userId !== actor.id && !canModerate(actor))
    return NextResponse.json({ error: "You can only delete your own comment." }, { status: 403 });

  // onDelete: Cascade on the parent self-relation removes any replies too.
  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
}
