import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { requireMember } from "../guards";
import { DEFAULT_LIST_NAME, DEFAULT_STATUSES } from "../defaults";
import { positionAfter } from "@/lib/position";
import type { Ctx } from "./types";
import { cleanName } from "./util";

const DEFAULT_PROJECT_COLOR = "#64748B";
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * Section 8.3 [A]. Any member may create a project (7.3). New projects get the default
 * statuses (6.1.1) or a copy of another project's in the same space (6.1.2), and one
 * list named "General" (6.3.1).
 */
export async function createProject(
  ctx: Ctx,
  input: { spaceId: string; name: string; color?: string; copyStatusesFromProjectId?: string },
): Promise<{ projectId: string; firstListId: string }> {
  await requireMember(ctx.userId, input.spaceId);
  return db.$transaction((tx) => insertProject(tx, input));
}

/**
 * Creates a project with its statuses and first list inside an existing transaction.
 * Callers must already have checked membership of `spaceId`. Used by createProject and
 * createSpace.
 */
export async function insertProject(
  tx: Prisma.TransactionClient,
  input: { spaceId: string; name: string; color?: string; copyStatusesFromProjectId?: string },
): Promise<{ projectId: string; firstListId: string }> {
  const name = cleanName(input.name, "Project name");
  const color = input.color ?? DEFAULT_PROJECT_COLOR;
  if (!HEX_COLOR.test(color)) throw new AppError("VALIDATION", "Color must be a hex value like #2563EB");

  let statuses: Prisma.StatusCreateWithoutProjectInput[];
  if (input.copyStatusesFromProjectId) {
    const source = await tx.project.findUnique({
      where: { id: input.copyStatusesFromProjectId },
      select: { spaceId: true, statuses: { orderBy: { position: "asc" } } },
    });
    if (!source || source.spaceId !== input.spaceId) {
      throw new AppError("VALIDATION", "Statuses can only be copied from a project in this space");
    }
    statuses = source.statuses.map(({ name, color, category, position }) => ({ name, color, category, position }));
  } else {
    let pos: string | null = null;
    statuses = DEFAULT_STATUSES.map((s) => {
      pos = positionAfter(pos);
      return { ...s, position: pos };
    });
  }

  const last = await tx.project.findFirst({
    where: { spaceId: input.spaceId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const project = await tx.project.create({
    data: {
      spaceId: input.spaceId,
      name,
      color,
      position: positionAfter(last?.position),
      statuses: { create: statuses },
      lists: { create: { name: DEFAULT_LIST_NAME, position: positionAfter(null) } },
    },
    select: { id: true, lists: { select: { id: true } } },
  });
  return { projectId: project.id, firstListId: project.lists[0].id };
}
