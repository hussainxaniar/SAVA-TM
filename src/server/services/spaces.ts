import { db } from "../db";
import { requireMember } from "../guards";
import { DEFAULT_PROJECT_NAME } from "../defaults";
import { insertProject } from "./projects";
import type { Ctx, SpaceSummaryDTO } from "./types";
import { cleanName } from "./util";

/**
 * Section 8.2 [A] / 7.2.1. The creator becomes OWNER, and the space starts with a
 * "Getting started" project (default statuses, list "General"). Any signed-in user may
 * create a space.
 */
export async function createSpace(ctx: Ctx, input: { name: string }): Promise<{ spaceId: string }> {
  const name = cleanName(input.name, "Space name");
  return db.$transaction(async (tx) => {
    const space = await tx.space.create({
      data: { name, createdById: ctx.userId, members: { create: { userId: ctx.userId, role: "OWNER" } } },
      select: { id: true },
    });
    await insertProject(tx, { spaceId: space.id, name: DEFAULT_PROJECT_NAME });
    return { spaceId: space.id };
  });
}

/** Section 8.2. The caller's spaces, oldest membership first. */
export async function listMySpaces(ctx: Ctx): Promise<SpaceSummaryDTO[]> {
  const rows = await db.spaceMember.findMany({
    where: { userId: ctx.userId },
    orderBy: { joinedAt: "asc" },
    select: { role: true, space: { select: { id: true, name: true, icon: true } } },
  });
  return rows.map(({ role, space }) => ({ ...space, role }));
}

/**
 * Where to land when opening a space: its first active project's first active list,
 * or null when the space has no active project/list.
 */
export async function getSpaceLanding(
  ctx: Ctx,
  input: { spaceId: string },
): Promise<{ projectId: string; listId: string } | null> {
  await requireMember(ctx.userId, input.spaceId);
  const project = await db.project.findFirst({
    where: { spaceId: input.spaceId, archivedAt: null, lists: { some: { archivedAt: null } } },
    orderBy: { position: "asc" },
    select: {
      id: true,
      lists: { where: { archivedAt: null }, orderBy: { position: "asc" }, take: 1, select: { id: true } },
    },
  });
  if (!project) return null;
  return { projectId: project.id, listId: project.lists[0].id };
}
