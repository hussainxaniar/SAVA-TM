import { PrismaClient } from "@prisma/client";

/** Every account the suite creates uses this prefix and domain, so cleanup can find them. */
export const E2E_EMAIL_PREFIX = "e2e-";
export const E2E_EMAIL_DOMAIN = "@example.test";

/**
 * Deletes the users the suite created (and their spaces, tasks, comments, activity) from the local database.
 * Skipped when BASE_URL points at a remote deployment: the suite cannot reach that database, so delete the
 * `e2e-*@example.test` users and their spaces there by hand after a run.
 */
export default async function globalTeardown() {
  const base = process.env.BASE_URL ?? "http://localhost:3000";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) {
    console.warn(`e2e: BASE_URL is remote (${base}); delete the ${E2E_EMAIL_PREFIX}*${E2E_EMAIL_DOMAIN} users there manually.`);
    return;
  }
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(".env");
    } catch {
      // No .env: fall through to the check below.
    }
  }
  if (!process.env.DATABASE_URL) {
    console.warn("e2e: no DATABASE_URL, skipping cleanup of e2e users.");
    return;
  }

  const db = new PrismaClient();
  try {
    const users = await db.user.findMany({
      where: { email: { startsWith: E2E_EMAIL_PREFIX, endsWith: E2E_EMAIL_DOMAIN } },
      select: { id: true },
    });
    if (users.length === 0) return;
    const userIds = users.map((u) => u.id);
    const spaces = await db.space.findMany({ where: { createdById: { in: userIds } }, select: { id: true } });
    const spaceIds = spaces.map((s) => s.id);
    // Same order as prisma/seed.ts: tasks first (Task → List/Status are RESTRICT), then spaces, then users
    // (Comment/Activity → User are RESTRICT, so a user that commented in someone else's space needs those gone too).
    await db.task.deleteMany({ where: { spaceId: { in: spaceIds } } });
    await db.space.deleteMany({ where: { id: { in: spaceIds } } });
    await db.comment.deleteMany({ where: { authorId: { in: userIds } } });
    await db.activity.deleteMany({ where: { actorId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db.$disconnect();
  }
}
