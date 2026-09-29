import { randomUUID } from "node:crypto";
import type { SpaceRole } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Empties every table in the test schema. Call in `beforeAll` of each DB test file.
 * The schema comes from DATABASE_URL's `?schema=` (Prisma qualifies table names with it;
 * Postgres' current_schema() stays "public", so never use that here). Refuses to touch
 * "public" unless TEST_DATABASE_URL points at a dedicated test database.
 */
export async function resetDb() {
  const schema = new URL(process.env.DATABASE_URL!).searchParams.get("schema") ?? "public";
  if (schema === "public" && !process.env.TEST_DATABASE_URL) {
    throw new Error("resetDb: refusing to truncate the public schema of a non-test database");
  }
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = ${schema} AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${schema}"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE`);
}

export async function makeUser(name = "User") {
  const id = randomUUID();
  return db.user.create({ data: { id, name, email: `${id}@test.local` } });
}

/** A space whose members have the given roles; returns the users keyed by role label. */
export async function makeSpace<K extends string>(members: Record<K, SpaceRole>) {
  const labels = Object.keys(members) as K[];
  const users = Object.fromEntries(
    await Promise.all(labels.map(async (label) => [label, await makeUser(label)] as const)),
  ) as Record<K, Awaited<ReturnType<typeof makeUser>>>;
  const creator = users[labels[0]];
  const space = await db.space.create({
    data: {
      name: "Test space",
      createdById: creator.id,
      members: { create: labels.map((label) => ({ userId: users[label].id, role: members[label] })) },
    },
  });
  return { space, users };
}

/** A task row written directly (task services arrive in T-08). */
export async function makeTask(input: {
  spaceId: string;
  projectId: string;
  homeListId: string;
  statusId: string;
  createdById: string;
  title: string;
  position: string;
  parentId?: string;
  depth?: number;
  completedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  return db.task.create({ data: { depth: 0, ...input } });
}
