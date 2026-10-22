/**
 * Idempotent seed. Safe to run many times.
 *
 *   SEED_ADMIN_USERNAME=youname SEED_ADMIN_PASSWORD='long-password' npm run db:seed
 *
 * - Creates the admin user, or promotes the existing user with that username to ADMIN
 *   (an existing user's password is never overwritten).
 * - Adds one welcome announcement if there are none.
 * Anime rows are NOT seeded: they are cached on demand from AniList.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedAdmin() {
  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    console.log("• Admin: skipped (set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD to create one).");
    return;
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    throw new Error("SEED_ADMIN_USERNAME must be 3-20 chars: letters, numbers, underscores.");
  }
  if (password.length < 10) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
  }

  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role !== Role.ADMIN) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: Role.ADMIN } });
      console.log(`• Admin: existing user "${username}" promoted to ADMIN.`);
    } else {
      console.log(`• Admin: "${username}" is already ADMIN.`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { username, name: username, passwordHash, role: Role.ADMIN },
  });
  console.log(`• Admin: created "${username}".`);
}

async function seedAnnouncement() {
  const count = await prisma.announcement.count();
  if (count > 0) {
    console.log("• Announcement: already present, skipped.");
    return;
  }
  await prisma.announcement.create({
    data: {
      title: "Welcome to Bankai",
      body: "Browse trending anime, build your list and pick up where you left off.",
    },
  });
  console.log("• Announcement: welcome message created.");
}

async function main() {
  console.log("Seeding database…");
  await seedAdmin();
  await seedAnnouncement();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
