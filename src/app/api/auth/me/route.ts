import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/server/auth/actor";
import { getAuthSecret } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** Lets the browser check that its saved login still matches a valid server session. */
export async function GET(req: NextRequest) {
  const sessionsEnabled = getAuthSecret() !== null;
  const actor = sessionsEnabled ? await getActor(req) : null;
  return NextResponse.json(
    { sessionsEnabled, user: actor ? { username: actor.username, role: actor.role } : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
