import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { SESSION_COOKIE, getAuthSecret, verifySessionToken } from "./session";

export async function getSession() {
  const secret = getAuthSecret();
  if (!secret) return null;
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value, secret);
}

/**
 * Server-side admin check. Re-reads the role from the database, so a demoted
 * admin loses access immediately even if their cookie still says ADMIN.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) return notFound();
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, role: true },
  });
  if (!user || user.role !== "ADMIN") return notFound();
  return user;
}
