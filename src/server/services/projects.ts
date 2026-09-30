import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { PERMISSIONS, requireMember, requireRole, spaceIdOfProject } from "../guards";
import { DEFAULT_LIST_NAME, DEFAULT_STATUSES } from "../defaults";
import { positionAfter } from "@/lib/position";
import { positionForMove, type MoveTarget } from "./ordering";
import type { Ctx, ProjectSettingsDTO, SidebarDTO } from "./types";
import { checkColor, cleanName } from "./util";

const DEFAULT_PROJECT_COLOR = "#64748B";
const MAX_ICON_LENGTH = 16; // one emoji, allowing multi-codepoint sequences

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
  checkColor(color);

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

/** Section 8.3. Any member may rename a project (7.3); color and icon follow the same rule. */
export async function updateProject(
  ctx: Ctx,
  input: { projectId: string; name?: string; color?: string; icon?: string | null },
): Promise<void> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireMember(ctx.userId, spaceId);
  const data: { name?: string; color?: string; icon?: string | null } = {};
  if (input.name !== undefined) data.name = cleanName(input.name, "Project name");
  if (input.color !== undefined) {
    checkColor(input.color);
    data.color = input.color;
  }
  if (input.icon !== undefined) {
    const icon = input.icon?.trim() || null;
    if (icon && icon.length > MAX_ICON_LENGTH) throw new AppError("VALIDATION", "Icon must be a single emoji");
    data.icon = icon;
  }
  if (Object.keys(data).length === 0) return;
  await db.project.update({ where: { id: input.projectId }, data });
}

/**
 * Section 8.3. Any member. Moves a project among the space's active projects;
 * see MoveTarget for what beforeId/afterId mean.
 */
export async function reorderProject(ctx: Ctx, input: { projectId: string } & MoveTarget): Promise<void> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireMember(ctx.userId, spaceId);
  await db.$transaction(async (tx) => {
    const siblings = await tx.project.findMany({
      where: { spaceId, archivedAt: null },
      select: { id: true, position: true },
    });
    const position = positionForMove(siblings, input.projectId, input);
    await tx.project.update({ where: { id: input.projectId }, data: { position } });
  });
}

/** Section 8.3. ADMIN (7.3). Archived projects disappear from the sidebar; nothing is deleted. */
export async function archiveProject(ctx: Ctx, input: { projectId: string }): Promise<void> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireRole(ctx.userId, spaceId, PERMISSIONS.archiveProject);
  await db.project.updateMany({ where: { id: input.projectId, archivedAt: null }, data: { archivedAt: new Date() } });
}

/** Section 8.3. Projects → lists → docs for the sidebar. */
export async function getSidebar(ctx: Ctx, input: { spaceId: string }): Promise<SidebarDTO> {
  await requireMember(ctx.userId, input.spaceId);
  const active = { archivedAt: null };
  const byPosition = { position: "asc" as const };
  const projects = await db.project.findMany({
    where: { spaceId: input.spaceId, ...active },
    orderBy: byPosition,
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      lists: { where: active, orderBy: byPosition, select: { id: true, name: true } },
      docs: {
        where: active,
        orderBy: byPosition,
        select: {
          id: true,
          title: true,
          pages: { where: { parentId: null }, orderBy: byPosition, take: 1, select: { id: true } },
        },
      },
    },
  });
  const counts = await openTaskCounts(projects.flatMap((p) => p.lists.map((l) => l.id)));
  return {
    projects: projects.map(({ docs, lists, ...p }) => ({
      ...p,
      lists: lists.map((l) => ({ ...l, openTaskCount: counts.get(l.id) ?? 0 })),
      docs: docs.map(({ pages, ...d }) => ({ ...d, firstPageId: pages[0]?.id ?? null })),
    })),
  };
}

/** Where /p/[projectId] lands: the project's first active list (6.3.1: there is always one). */
export async function getProjectLanding(ctx: Ctx, input: { projectId: string }): Promise<{ listId: string } | null> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireMember(ctx.userId, spaceId);
  const list = await db.list.findFirst({
    where: { projectId: input.projectId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return list ? { listId: list.id } : null;
}

/** Section 9.6 project settings: the project, its statuses and active lists, with live task counts. */
export async function getProjectSettings(ctx: Ctx, input: { projectId: string }): Promise<ProjectSettingsDTO> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireMember(ctx.userId, spaceId);
  const live = { where: { deletedAt: null } };
  const project = await db.project.findUniqueOrThrow({
    where: { id: input.projectId },
    select: {
      id: true,
      spaceId: true,
      name: true,
      color: true,
      icon: true,
      statuses: { orderBy: { position: "asc" }, include: { _count: { select: { tasks: live } } } },
      lists: {
        where: { archivedAt: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, subtaskDisplay: true, _count: { select: { homeTasks: live } } },
      },
    },
  });
  const { statuses, lists, ...rest } = project;
  return {
    project: rest,
    statuses: statuses.map(({ _count, id, name, color, category, position }) => ({
      id,
      name,
      color,
      category,
      position,
      taskCount: _count.tasks,
    })),
    lists: lists.map(({ _count, ...l }) => ({ ...l, taskCount: _count.homeTasks })),
  };
}

/** Open, live tasks per list: home tasks plus tasks linked in (any depth). */
async function openTaskCounts(listIds: string[]): Promise<Map<string, number>> {
  if (listIds.length === 0) return new Map();
  const open = { deletedAt: null, completedAt: null };
  const [home, linked] = await Promise.all([
    db.task.groupBy({ by: ["homeListId"], where: { homeListId: { in: listIds }, ...open }, _count: { _all: true } }),
    db.taskListLink.groupBy({ by: ["listId"], where: { listId: { in: listIds }, task: open }, _count: { _all: true } }),
  ]);
  const counts = new Map<string, number>();
  for (const h of home) counts.set(h.homeListId, h._count._all);
  for (const l of linked) counts.set(l.listId, (counts.get(l.listId) ?? 0) + l._count._all);
  return counts;
}
