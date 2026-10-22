import { NextRequest, NextResponse } from "next/server";
import { getActor, unauthorized } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export async function GET(req: NextRequest) {
  const actor = await getActor(req, req.nextUrl.searchParams.get("username"));
  if (!actor) return unauthorized();

  const user = await prisma.user.findUnique({
    where:  { id: actor.id },
    select: { anilistId: true, anilistUsername: true, anilistToken: true },
  });

  if (!user) return unauthorized();

  if (!user.anilistToken || !user.anilistId) {
    return NextResponse.json({ connected: false, reason: "No AniList token stored in DB" });
  }

  // Test the token with a live AniList API call
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.anilistToken}` },
      body:    JSON.stringify({ query: "{ Viewer { id name } }" }),
    });
    const json = await res.json() as { data?: { Viewer?: { id: number; name: string } }; errors?: { message: string }[] };

    if (json.errors?.length) {
      return NextResponse.json({ connected: false, reason: "Token invalid", errors: json.errors });
    }

    return NextResponse.json({
      connected:       true,
      storedUsername:  user.anilistUsername,
      storedId:        user.anilistId,
      liveViewer:      json.data?.Viewer,
      tokenWorks:      true,
    });
  } catch (err) {
    console.error("[anilist/test]", err);
    return NextResponse.json({ connected: false, reason: "AniList unreachable" });
  }
}
