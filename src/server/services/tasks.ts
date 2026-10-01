import { Prisma, type ActivityType } from "@prisma/client";
import { comparePositions, positionAfter } from "@/lib/position";
import { db } from "../db";
import { AppError } from "../errors";
import { requireMember, spaceIdOfList, spaceIdOfTask } from "../guards";
import { logActivities, logActivity, type ActivityInput } from "./activity";
import { positionForMove, type MoveTarget } from "./ordering";
import { toStatusDTO } from "./statuses";
import { loadTaskRows, taskRowSelect, toTaskRow, type DbClient } from "./task-rows";
import type { Ctx, ListViewDTO, MyTasksDTO, TaskDetailDTO, TaskRowDTO } from "./types";
import { cleanName, serializableTransaction } from "./util";

/*
 * Section 8.4 (all [A]); rules in Section 6. Every mutation checks membership first and writes
 * its Activity rows inside the same transaction. Payload shapes (6.9.3):
 *   TASK_CREATED {} · SUBTASK_ADDED { subtaskId } (on the parent) · TASK_RENAMED { from, to }
 *   TASK_DESCRIPTION_CHANGED {} · STATUS_CHANGED { from, to } (status ids)
 *   PRIORITY_CHANGED { from, to } · START_DATE_CHANGED { from, to } (ISO | null)
 *   DUE_DATE_CHANGED { from, to, fromHasTime, toHasTime } (so the feed can show times in the viewer's zone)
 *   ASSIGNEE_ADDED / ASSIGNEE_REMOVED { userId } · TASK_COMPLETED / TASK_REOPENED {}
 *   TASK_DELETED / TASK_RESTORED {} · PARENT_CHANGED { from, to } (parent ids | null)
 *   MOVED_TO_LIST { fromListId, toListId } · ADDED_TO_LIST / REMOVED_FROM_LIST { listId }
 */

const MAX_DEPTH = 2; // 0, 1, 2 = three levels (6.4.1)
const TITLE_MAX = 500;
const DESCRIPTION_MAX_BYTES = 200_000;
const DESCRIPTION_COALESCE_MS = 10 * 60 * 1000; // 6.9.4

// ---------- Reads ----------

/**
 * Section 6.7. Visible(L) = live tasks whose home is L or that are linked into L, plus every
 * live descendant of those. Completed tasks are included; the client renders NESTED/SEPARATE
 * and applies the sort.
 */
export async function getListView(ctx: Ctx, input: { listId: string }): Promise<ListViewDTO> {
  await requireMember(ctx.userId, await spaceIdOfList(input.listId));
  const { project, ...list } = await db.list.findUniqueOrThrow({
    where: { id: input.listId },
    select: {
      id: true,
      name: true,
      subtaskDisplay: true,
      projectId: true,
      project: {
        select: {
          id: true,
          spaceId: true,
          name: true,
          color: true,
          lists: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  });
  const [statuses, visible] = await Promise.all([
    db.status.findMany({ where: { projectId: list.projectId }, orderBy: { position: "asc" } }),
    visibleInList(db, list.id),
  ]);
  const { rows } = await loadTaskRows(
    db,
    { id: { in: [...visible.tasks.keys()] } },
    { listId: list.id, linkPositions: visible.linkPositions },
  );
  return { list, project, statuses: statuses.map(toStatusDTO), tasks: rows };
}

/** Section 8.4. The task panel (9.4). Soft-deleted tasks are NOT_FOUND. */
export async function getTask(ctx: Ctx, input: { taskId: string }): Promise<TaskDetailDTO> {
  await requireMember(ctx.userId, await spaceIdOfTask(input.taskId));
  const task = await db.task.findFirst({
    where: { id: input.taskId, deletedAt: null },
    select: {
      ...taskRowSelect,
      description: true,
      spaceId: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      homeList: { select: { id: true, name: true } },
      links: {
        where: { list: { archivedAt: null } },
        orderBy: { createdAt: "asc" },
        select: { listId: true, list: { select: { id: true, name: true } } },
      },
      timeBlocks: { orderBy: { start: "asc" }, select: { id: true, start: true, end: true, syncState: true, userId: true } },
      parent: { select: { id: true, title: true, parent: { select: { id: true, title: true } } } },
    },
  });
  if (!task) throw notFound();

  const [{ rows: subtasks }, open, createdBy, project] = await Promise.all([
    loadTaskRows(db, { parentId: task.id }),
    db.task.count({ where: { parentId: task.id, deletedAt: null, completedAt: null } }),
    db.user.findUnique({ where: { id: task.createdById }, select: { id: true, name: true, image: true } }),
    db.project.findUniqueOrThrow({
      where: { id: task.projectId },
      select: {
        id: true,
        name: true,
        color: true,
        statuses: { orderBy: { position: "asc" } },
        lists: { where: { archivedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true } },
      },
    }),
  ]);

  const breadcrumb: { id: string; title: string }[] = [];
  if (task.parent?.parent) breadcrumb.push({ id: task.parent.parent.id, title: task.parent.parent.title });
  if (task.parent) breadcrumb.push({ id: task.parent.id, title: task.parent.title });

  return {
    ...toTaskRow(task, open),
    description: task.description,
    projectId: task.projectId,
    spaceId: task.spaceId,
    project: { id: project.id, name: project.name, color: project.color, lists: project.lists },
    statuses: project.statuses.map(toStatusDTO),
    homeList: task.homeList,
    linkedLists: task.links.map((l) => l.list),
    breadcrumb,
    subtasks,
    timeBlocks: task.timeBlocks.map((b) => ({
      id: b.id,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      syncState: b.syncState,
      userId: b.userId,
    })),
    createdBy: createdBy ?? { id: task.createdById, name: "Deleted user", image: null },
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/**
 * Section 8.4 / 9.5. Open tasks assigned to the caller in a space, outside archived projects and
 * lists, plus each of their projects' statuses (every row has a status menu).
 */
export async function getMyTasks(ctx: Ctx, input: { spaceId: string }): Promise<MyTasksDTO> {
  await requireMember(ctx.userId, input.spaceId);
  const { rows, records } = await loadTaskRows(db, {
    spaceId: input.spaceId,
    completedAt: null,
    assignees: { some: { userId: ctx.userId } },
    project: { archivedAt: null },
    homeList: { archivedAt: null },
  });
  const projectIds = [...new Set(records.map((r) => r.projectId))];
  const [projects, lists] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, color: true, statuses: { orderBy: { position: "asc" } } },
    }),
    db.list.findMany({ where: { id: { in: [...new Set(records.map((r) => r.homeListId))] } }, select: { id: true, name: true } }),
  ]);
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const listById = new Map(lists.map((l) => [l.id, l]));
  const projectOf = new Map(records.map((r) => [r.id, r.projectId]));
  return {
    tasks: rows.map((row) => {
      const project = projectById.get(projectOf.get(row.id)!)!;
      return {
        ...row,
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        listName: listById.get(row.homeListId)!.name,
      };
    }),
    statusesByProject: Object.fromEntries(projects.map((p) => [p.id, p.statuses.map(toStatusDTO)])),
  };
}

// ---------- Create / update ----------

export type CreateTaskInput = {
  listId: string;
  title: string;
  parentId?: string | null;
  description?: unknown | null;
  priority?: number;
  statusId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  dueHasTime?: boolean;
  assigneeIds?: string[];
  /** Insert right after this task (a root of the list, or a sibling subtask); omitted = at the end. */
  afterTaskId?: string | null;
};

/**
 * Section 8.4. With `parentId`, the subtask inherits space, project and home list from the
 * parent (6.4.2) and must stay within three levels (6.4.1). Status defaults to the project's
 * first TODO status; creating straight into a DONE status sets completedAt (6.2.3).
 */
export async function createTask(ctx: Ctx, input: CreateTaskInput): Promise<TaskRowDTO> {
  const title = cleanName(input.title, "Task title", TITLE_MAX);
  const priority = checkPriority(input.priority ?? 4);
  const startDate = parseDate(input.startDate, "Start date");
  const dueDate = parseDate(input.dueDate, "Due date");
  const description = checkDescription(input.description);

  // Where the task lives: from the parent, or from the list.
  let placement: { spaceId: string; projectId: string; homeListId: string; parentId: string | null; depth: number };
  if (input.parentId) {
    const spaceId = await spaceIdOfTask(input.parentId);
    await requireMember(ctx.userId, spaceId);
    const parent = await db.task.findFirst({
      where: { id: input.parentId, deletedAt: null },
      select: { id: true, spaceId: true, projectId: true, homeListId: true, depth: true },
    });
    if (!parent) throw notFound();
    if (parent.depth + 1 > MAX_DEPTH) {
      throw new AppError("VALIDATION", "Subtasks can only go three levels deep");
    }
    placement = { ...parent, homeListId: parent.homeListId, parentId: parent.id, depth: parent.depth + 1 };
  } else {
    const spaceId = await spaceIdOfList(input.listId);
    await requireMember(ctx.userId, spaceId);
    const list = await db.list.findUniqueOrThrow({
      where: { id: input.listId },
      select: { id: true, projectId: true, archivedAt: true },
    });
    if (list.archivedAt) throw new AppError("VALIDATION", "This list is archived");
    placement = { spaceId, projectId: list.projectId, homeListId: list.id, parentId: null, depth: 0 };
  }

  return db.$transaction(async (tx) => {
    const status = input.statusId
      ? await tx.status.findFirst({ where: { id: input.statusId, projectId: placement.projectId } })
      : await tx.status.findFirst({ where: { projectId: placement.projectId, category: "TODO" }, orderBy: { position: "asc" } });
    if (!status) throw new AppError("VALIDATION", "Pick a status from this project");

    const assigneeIds = await checkAssignees(tx, placement.spaceId, input.assigneeIds ?? []);
    const position = await newTaskPosition(tx, placement, input.afterTaskId ?? null);

    const task = await tx.task.create({
      data: {
        spaceId: placement.spaceId,
        projectId: placement.projectId,
        homeListId: placement.homeListId,
        parentId: placement.parentId,
        depth: placement.depth,
        title,
        description: description ?? undefined,
        statusId: status.id,
        priority,
        startDate,
        dueDate,
        dueHasTime: dueDate ? (input.dueHasTime ?? false) : false,
        position,
        completedAt: status.category === "DONE" ? new Date() : null,
        createdById: ctx.userId,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });

    const base = { spaceId: placement.spaceId, actorId: ctx.userId };
    await logActivities(tx, [
      { ...base, taskId: task.id, type: "TASK_CREATED" },
      ...(placement.parentId
        ? [{ ...base, taskId: placement.parentId, type: "SUBTASK_ADDED" as const, payload: { subtaskId: task.id } }]
        : []),
      ...assigneeIds.map((userId) => ({ ...base, taskId: task.id, type: "ASSIGNEE_ADDED" as const, payload: { userId } })),
      ...(status.category === "DONE" ? [{ ...base, taskId: task.id, type: "TASK_COMPLETED" as const }] : []),
    ]);

    return (await loadTaskRows(tx, { id: task.id })).rows[0];
  });
}

export type UpdateTaskInput = {
  taskId: string;
  title?: string;
  description?: unknown | null;
  priority?: number;
  statusId?: string;
  startDate?: string | null;
  dueDate?: string | null;
  dueHasTime?: boolean;
  /**
   * With a status change into DONE: also move the task's open descendants to that status,
   * each logging TASK_COMPLETED (6.2.4 — the status menu's "Also complete N open subtasks?").
   */
  completeSubtasks?: boolean;
};

/**
 * Section 8.4. One Activity row per field that actually changed. Status changes follow 6.2.3
 * (into DONE sets completedAt, out of DONE clears it). Description edits are coalesced per
 * actor within 10 minutes (6.9.4).
 */
export async function updateTask(ctx: Ctx, input: UpdateTaskInput): Promise<TaskRowDTO> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  const title = input.title === undefined ? undefined : cleanName(input.title, "Task title", TITLE_MAX);
  const priority = input.priority === undefined ? undefined : checkPriority(input.priority);
  const startDate = input.startDate === undefined ? undefined : parseDate(input.startDate, "Start date");
  const dueDate = input.dueDate === undefined ? undefined : parseDate(input.dueDate, "Due date");
  const description = input.description === undefined ? undefined : checkDescription(input.description);

  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, deletedAt: null }, include: { status: true } });
    if (!task) throw notFound();

    const data: Prisma.TaskUncheckedUpdateInput = {};
    const events: ActivityInput[] = [];
    const log = (type: ActivityType, payload: Prisma.InputJsonValue = {}) =>
      events.push({ spaceId, taskId: task.id, actorId: ctx.userId, type, payload });

    if (title !== undefined && title !== task.title) {
      data.title = title;
      log("TASK_RENAMED", { from: task.title, to: title });
    }
    if (description !== undefined && JSON.stringify(description) !== JSON.stringify(task.description)) {
      data.description = description === null ? Prisma.DbNull : description;
      const recent = await tx.activity.findFirst({
        where: {
          taskId: task.id,
          actorId: ctx.userId,
          type: "TASK_DESCRIPTION_CHANGED",
          createdAt: { gt: new Date(Date.now() - DESCRIPTION_COALESCE_MS) },
        },
        select: { id: true },
      });
      if (!recent) log("TASK_DESCRIPTION_CHANGED");
    }
    if (priority !== undefined && priority !== task.priority) {
      data.priority = priority;
      log("PRIORITY_CHANGED", { from: task.priority, to: priority });
    }
    if (input.statusId !== undefined && input.statusId !== task.statusId) {
      const status = await tx.status.findFirst({ where: { id: input.statusId, projectId: task.projectId } });
      if (!status) throw new AppError("VALIDATION", "Pick a status from this project");
      data.statusId = status.id;
      if (status.category === "DONE" && task.status.category !== "DONE") data.completedAt = new Date();
      if (status.category !== "DONE" && task.status.category === "DONE") data.completedAt = null;
      log("STATUS_CHANGED", { from: task.statusId, to: status.id });
    }
    if (startDate !== undefined && !sameInstant(startDate, task.startDate)) {
      data.startDate = startDate;
      log("START_DATE_CHANGED", { from: iso(task.startDate), to: iso(startDate) });
    }
    const nextDue = dueDate === undefined ? task.dueDate : dueDate;
    const nextHasTime = nextDue ? (input.dueHasTime ?? task.dueHasTime) : false;
    if (!sameInstant(nextDue, task.dueDate) || nextHasTime !== task.dueHasTime) {
      data.dueDate = nextDue;
      data.dueHasTime = nextHasTime;
      log("DUE_DATE_CHANGED", {
        from: iso(task.dueDate),
        to: iso(nextDue),
        fromHasTime: task.dueHasTime,
        toHasTime: nextDue ? nextHasTime : false,
      });
    }

    if (Object.keys(data).length > 0) await tx.task.update({ where: { id: task.id }, data });
    if (input.completeSubtasks && data.statusId && data.completedAt instanceof Date) {
      const open = await tx.task.findMany({
        where: { id: { in: await descendantIds(tx, [task.id]) }, completedAt: null },
        select: { id: true },
      });
      if (open.length > 0) {
        await tx.task.updateMany({
          where: { id: { in: open.map((t) => t.id) } },
          data: { statusId: data.statusId as string, completedAt: data.completedAt },
        });
        for (const t of open) events.push({ spaceId, taskId: t.id, actorId: ctx.userId, type: "TASK_COMPLETED", payload: {} });
      }
    }
    await logActivities(tx, events);
    return (await loadTaskRows(tx, { id: task.id })).rows[0];
  });
}

// ---------- Completion, assignees, order ----------

/**
 * Section 6.2. Completing sets the project's first DONE status (lowest position) and
 * completedAt, logging TASK_COMPLETED; reopening sets the first TODO status and clears it,
 * logging TASK_REOPENED. With includeSubtasks, open descendants are completed too, each logged.
 * Tasks already in the requested state are left alone (no duplicate rows).
 */
export async function setCompleted(
  ctx: Ctx,
  input: { taskId: string; completed: boolean; includeSubtasks?: boolean },
): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, deletedAt: null } });
    if (!task) throw notFound();
    const category = input.completed ? "DONE" : "TODO";
    const target = await tx.status.findFirst({
      where: { projectId: task.projectId, category },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!target) throw new AppError("CONFLICT", `This project has no ${input.completed ? "Done" : "To do"} status`);

    let ids = [task.id];
    if (input.completed && input.includeSubtasks) ids = [...ids, ...(await descendantIds(tx, [task.id]))];
    const toChange = await tx.task.findMany({
      where: { id: { in: ids }, deletedAt: null, completedAt: input.completed ? null : { not: null } },
      select: { id: true },
    });
    if (toChange.length === 0) return;

    await tx.task.updateMany({
      where: { id: { in: toChange.map((t) => t.id) } },
      data: { statusId: target.id, completedAt: input.completed ? new Date() : null },
    });
    await logActivities(
      tx,
      toChange.map((t) => ({
        spaceId,
        taskId: t.id,
        actorId: ctx.userId,
        type: input.completed ? ("TASK_COMPLETED" as const) : ("TASK_REOPENED" as const),
      })),
    );
  });
}

/** Section 8.4 / 6.8. Replaces the assignee set; each addition and removal is logged. */
export async function setAssignees(ctx: Ctx, input: { taskId: string; userIds: string[] }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, deletedAt: null },
      select: { id: true, assignees: { select: { userId: true } } },
    });
    if (!task) throw notFound();
    const wanted = await checkAssignees(tx, spaceId, input.userIds);
    const current = task.assignees.map((a) => a.userId);
    const added = wanted.filter((id) => !current.includes(id));
    const removed = current.filter((id) => !wanted.includes(id));

    if (removed.length) await tx.taskAssignee.deleteMany({ where: { taskId: task.id, userId: { in: removed } } });
    if (added.length) await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: task.id, userId })) });
    await logActivities(tx, [
      ...added.map((userId) => ({ spaceId, taskId: task.id, actorId: ctx.userId, type: "ASSIGNEE_ADDED" as const, payload: { userId } })),
      ...removed.map((userId) => ({ spaceId, taskId: task.id, actorId: ctx.userId, type: "ASSIGNEE_REMOVED" as const, payload: { userId } })),
    ]);
  });
}

/**
 * Section 8.4. Manual order within list L (6.7): a root of L moves among L's roots, whose
 * order mixes home positions (Task.position) and link positions (TaskListLink.position);
 * a nested task moves among its siblings (Task.position). See MoveTarget for beforeId/afterId.
 */
export async function reorderTask(ctx: Ctx, input: { taskId: string; listId: string } & MoveTarget): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const visible = await visibleInList(tx, input.listId);
    const task = visible.tasks.get(input.taskId);
    if (!task) throw new AppError("VALIDATION", "That task isn't in this list");

    if (isRoot(task, visible)) {
      const roots = rootsWithPositions(visible, input.listId);
      const position = positionForMove(roots, task.id, input);
      if (task.homeListId === input.listId) {
        await tx.task.update({ where: { id: task.id }, data: { position } });
      } else {
        await tx.taskListLink.update({ where: { taskId_listId: { taskId: task.id, listId: input.listId } }, data: { position } });
      }
    } else {
      const siblings = await tx.task.findMany({
        where: { parentId: task.parentId, deletedAt: null },
        select: { id: true, position: true },
      });
      const position = positionForMove(siblings, task.id, input);
      await tx.task.update({ where: { id: task.id }, data: { position } });
    }
  });
}

// ---------- Move / link (6.5, 6.6) ----------

/**
 * Section 6.5. Moves a top-level task and its whole subtree to another list of the same project
 * (a subtask is VALIDATION: convert it first, or add it to the list). It lands where the client
 * dropped it among the target's roots (MoveTarget), else last. Links of the subtree to the
 * target are dropped (it's home there now). Logs MOVED_TO_LIST.
 */
export async function moveTask(ctx: Ctx, input: { taskId: string; toListId: string } & MoveTarget): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await serializableTransaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, deletedAt: null },
      select: { id: true, parentId: true, projectId: true, homeListId: true },
    });
    if (!task) throw notFound();
    if (task.parentId) {
      throw new AppError("VALIDATION", "Only top-level tasks can move. Convert it to a task first, or add it to that list.");
    }
    const target = await activeListOfProject(tx, input.toListId, task.projectId);
    if (target.id === task.homeListId) return;

    const roots = rootsWithPositions(await visibleInList(tx, target.id), target.id);
    const position = positionForMove(roots, task.id, input);
    const subtree = [task.id, ...(await descendantIds(tx, [task.id], { includeDeleted: true }))];

    await tx.task.update({ where: { id: task.id }, data: { homeListId: target.id, position } });
    await tx.task.updateMany({ where: { id: { in: subtree.slice(1) } }, data: { homeListId: target.id } });
    await tx.taskListLink.deleteMany({ where: { listId: target.id, taskId: { in: subtree } } });
    await logActivity(tx, {
      spaceId,
      taskId: task.id,
      actorId: ctx.userId,
      type: "MOVED_TO_LIST",
      payload: { fromListId: task.homeListId, toListId: target.id },
    });
  });
}

/**
 * Section 6.6. Links a task (any depth) into another list of its project: not its home list, not
 * already linked. The link goes after the target's last root. Logs ADDED_TO_LIST.
 */
export async function addTaskToList(ctx: Ctx, input: { taskId: string; listId: string }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await serializableTransaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, deletedAt: null },
      select: { id: true, projectId: true, homeListId: true },
    });
    if (!task) throw notFound();
    const list = await activeListOfProject(tx, input.listId, task.projectId);
    if (list.id === task.homeListId) throw new AppError("VALIDATION", "That's already this task's home list");
    const existing = await tx.taskListLink.findUnique({
      where: { taskId_listId: { taskId: task.id, listId: list.id } },
      select: { taskId: true },
    });
    if (existing) throw new AppError("VALIDATION", "This task is already in that list");

    const last = rootsWithPositions(await visibleInList(tx, list.id), list.id)
      .map((r) => r.position)
      .sort(comparePositions)
      .at(-1);
    await tx.taskListLink.create({
      data: { taskId: task.id, listId: list.id, position: positionAfter(last), addedById: ctx.userId },
    });
    await logActivity(tx, { spaceId, taskId: task.id, actorId: ctx.userId, type: "ADDED_TO_LIST", payload: { listId: list.id } });
  });
}

/**
 * Section 6.6.4. Removes only the link; a task can't leave its home list (move it instead).
 * Logs REMOVED_FROM_LIST.
 */
export async function removeTaskFromList(ctx: Ctx, input: { taskId: string; listId: string }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, deletedAt: null },
      select: { id: true, homeListId: true },
    });
    if (!task) throw notFound();
    if (task.homeListId === input.listId) {
      throw new AppError("VALIDATION", "A task can't leave its home list. Move it to another list instead.");
    }
    const removed = await tx.taskListLink.deleteMany({ where: { taskId: task.id, listId: input.listId } });
    if (removed.count === 0) throw new AppError("VALIDATION", "This task isn't in that list");
    await logActivity(tx, {
      spaceId,
      taskId: task.id,
      actorId: ctx.userId,
      type: "REMOVED_FROM_LIST",
      payload: { listId: input.listId },
    });
  });
}

/** A live list of `projectId`; anything else (other project, archived, missing) is VALIDATION. */
async function activeListOfProject(tx: Prisma.TransactionClient, listId: string, projectId: string) {
  const list = await tx.list.findUnique({ where: { id: listId }, select: { id: true, projectId: true, archivedAt: true } });
  if (!list || list.projectId !== projectId || list.archivedAt) {
    throw new AppError("VALIDATION", "Pick a list in this task's project");
  }
  return list;
}

// ---------- Re-parent ----------

/**
 * Section 6.4.3 ("Make subtask of…" / "Convert to task"). parentId = null promotes the task to
 * the top level of its home list (a subtask's home is its parent's). Otherwise the new parent
 * must be live, in the same project, not the task or one of its descendants, and the moved
 * subtree must stay within MAX_DEPTH. The subtree takes the parent's home list (6.4.2); links
 * that would duplicate that home are dropped. The task goes last among its new siblings.
 * Serializable, so two concurrent re-parents can't form a cycle. Logs PARENT_CHANGED.
 */
export async function setParent(ctx: Ctx, input: { taskId: string; parentId: string | null }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await serializableTransaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: input.taskId, deletedAt: null },
      select: { id: true, parentId: true, projectId: true, homeListId: true, depth: true },
    });
    if (!task) throw notFound();
    if (task.parentId === input.parentId) return;

    // The whole subtree, deleted rows included, so a later restore finds consistent depths.
    const levels: { ids: string[]; live: boolean[] }[] = [];
    let frontier = [task.id];
    while (frontier.length > 0) {
      const children = await tx.task.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true, deletedAt: true },
      });
      if (children.length === 0) break;
      levels.push({ ids: children.map((c) => c.id), live: children.map((c) => c.deletedAt === null) });
      frontier = children.map((c) => c.id);
    }
    const liveHeight = levels.filter((l) => l.live.some(Boolean)).length;

    let target: { parentId: string | null; depth: number; homeListId: string };
    if (input.parentId === null) {
      target = { parentId: null, depth: 0, homeListId: task.homeListId };
    } else {
      if (input.parentId === task.id || levels.some((l) => l.ids.includes(input.parentId!))) {
        throw new AppError("VALIDATION", "A task can't become a subtask of itself or of its own subtasks");
      }
      const parent = await tx.task.findFirst({
        where: { id: input.parentId, deletedAt: null },
        select: { id: true, projectId: true, homeListId: true, depth: true },
      });
      if (!parent) throw notFound();
      if (parent.projectId !== task.projectId) {
        throw new AppError("VALIDATION", "Subtasks must stay in the same project");
      }
      if (parent.depth + 1 + liveHeight > MAX_DEPTH) {
        throw new AppError("VALIDATION", "That would put subtasks more than three levels deep");
      }
      target = { parentId: parent.id, depth: parent.depth + 1, homeListId: parent.homeListId };
    }

    const position = await newTaskPosition(tx, { homeListId: target.homeListId, parentId: target.parentId }, null);
    await tx.task.update({
      where: { id: task.id },
      data: { parentId: target.parentId, depth: target.depth, homeListId: target.homeListId, position },
    });
    for (const [i, level] of levels.entries()) {
      await tx.task.updateMany({
        where: { id: { in: level.ids } },
        data: { depth: target.depth + i + 1, homeListId: target.homeListId },
      });
    }
    if (target.homeListId !== task.homeListId) {
      await tx.taskListLink.deleteMany({
        where: { listId: target.homeListId, taskId: { in: [task.id, ...levels.flatMap((l) => l.ids)] } },
      });
    }
    await logActivity(tx, {
      spaceId,
      taskId: task.id,
      actorId: ctx.userId,
      type: "PARENT_CHANGED",
      payload: { from: task.parentId, to: target.parentId },
    });
  });
}

// ---------- Delete / restore ----------

/** Section 6.4.5. Soft-deletes the task and its live subtree with one timestamp; logs TASK_DELETED. */
export async function deleteTask(ctx: Ctx, input: { taskId: string }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, deletedAt: null }, select: { id: true } });
    if (!task) throw notFound();
    const ids = [task.id, ...(await descendantIds(tx, [task.id]))];
    await tx.task.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt: new Date() } });
    await logActivity(tx, { spaceId, taskId: task.id, actorId: ctx.userId, type: "TASK_DELETED" });
  });
}

/**
 * Section 6.4.5 (Undo). Restores the task and the descendants deleted together with it (same
 * timestamp); subtasks deleted separately earlier stay deleted. A task whose parent is still
 * deleted can't be restored on its own. Logs TASK_RESTORED.
 */
export async function restoreTask(ctx: Ctx, input: { taskId: string }): Promise<void> {
  const spaceId = await spaceIdOfTask(input.taskId);
  await requireMember(ctx.userId, spaceId);

  await db.$transaction(async (tx) => {
    const task = await tx.task.findUniqueOrThrow({
      where: { id: input.taskId },
      select: { id: true, deletedAt: true, depth: true, parent: { select: { deletedAt: true } } },
    });
    if (!task.deletedAt) return; // already live: nothing to undo
    if (task.parent?.deletedAt) throw new AppError("VALIDATION", "Restore the parent task first");
    // A subtask deleted on its own, whose old parent was later moved deeper (setParent), may no
    // longer fit (6.4.1).
    if (task.depth > MAX_DEPTH) throw new AppError("VALIDATION", "This subtask can no longer be restored at that depth");

    const ids = [task.id, ...(await descendantIds(tx, [task.id], { includeDeleted: true }))];
    await tx.task.updateMany({ where: { id: { in: ids }, deletedAt: task.deletedAt }, data: { deletedAt: null } });
    await logActivity(tx, { spaceId, taskId: task.id, actorId: ctx.userId, type: "TASK_RESTORED" });
  });
}

// ---------- helpers ----------

type VisibleTask = { id: string; parentId: string | null; homeListId: string; position: string };

/** Visible(L) (6.7) as ids with the fields ordering needs, plus L's link positions. */
async function visibleInList(client: DbClient, listId: string) {
  const links = await client.taskListLink.findMany({
    where: { listId, task: { deletedAt: null } },
    select: { taskId: true, position: true },
  });
  const linkPositions = new Map(links.map((l) => [l.taskId, l.position]));
  const select = { id: true, parentId: true, homeListId: true, position: true } as const;

  const members = await client.task.findMany({
    where: { deletedAt: null, OR: [{ homeListId: listId }, { id: { in: [...linkPositions.keys()] } }] },
    select,
  });
  const tasks = new Map<string, VisibleTask>(members.map((t) => [t.id, t]));

  // Home members' descendants share the home list, so they're already members. Only linked
  // members bring in descendants from elsewhere (at most two more levels).
  let frontier = members.filter((t) => t.homeListId !== listId).map((t) => t.id);
  while (frontier.length > 0) {
    const children = await client.task.findMany({ where: { parentId: { in: frontier }, deletedAt: null }, select });
    const fresh = children.filter((c) => !tasks.has(c.id));
    for (const c of fresh) tasks.set(c.id, c);
    frontier = fresh.map((c) => c.id);
  }
  return { tasks, linkPositions };
}

function isRoot(task: VisibleTask, visible: { tasks: Map<string, VisibleTask> }) {
  return !task.parentId || !visible.tasks.has(task.parentId);
}

/** Roots of L with their effective Manual-order position (home position or link position). */
function rootsWithPositions(
  visible: { tasks: Map<string, VisibleTask>; linkPositions: Map<string, string> },
  listId: string,
) {
  return [...visible.tasks.values()]
    .filter((t) => isRoot(t, visible))
    .map((t) => ({
      id: t.id,
      position: t.homeListId === listId ? t.position : (visible.linkPositions.get(t.id) ?? t.position),
    }));
}

/** Position for a new task: after `afterTaskId` among its siblings, or at the end. */
async function newTaskPosition(
  tx: Prisma.TransactionClient,
  placement: { homeListId: string; parentId: string | null },
  afterTaskId: string | null,
): Promise<string> {
  let siblings: { id: string; position: string }[];
  if (placement.parentId) {
    siblings = await tx.task.findMany({
      where: { parentId: placement.parentId, deletedAt: null },
      select: { id: true, position: true },
    });
  } else {
    // Top level: new tasks line up with everything shown at the root of the list, links included.
    siblings = rootsWithPositions(await visibleInList(tx, placement.homeListId), placement.homeListId);
  }
  if (afterTaskId) {
    if (!siblings.some((s) => s.id === afterTaskId)) {
      throw new AppError("VALIDATION", "Can't insert after a task from somewhere else");
    }
    return positionForMove(siblings, "", { beforeId: afterTaskId });
  }
  const last = siblings.map((s) => s.position).sort(comparePositions).at(-1);
  return positionAfter(last);
}

/** Ids of all descendants (two levels at most below any task, 6.4.1). */
async function descendantIds(
  client: DbClient,
  rootIds: string[],
  opts: { includeDeleted?: boolean } = {},
): Promise<string[]> {
  const out: string[] = [];
  let frontier = rootIds;
  while (frontier.length > 0) {
    const children = await client.task.findMany({
      where: { parentId: { in: frontier }, ...(opts.includeDeleted ? {} : { deletedAt: null }) },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    out.push(...frontier);
  }
  return out;
}

async function checkAssignees(tx: Prisma.TransactionClient, spaceId: string, userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return [];
  const members = await tx.spaceMember.findMany({
    where: { spaceId, userId: { in: unique } },
    select: { userId: true },
  });
  if (members.length !== unique.length) {
    throw new AppError("VALIDATION", "Assignees must be members of this space");
  }
  return unique;
}

function checkPriority(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 4) throw new AppError("VALIDATION", "Priority must be 1 to 4");
  return value;
}

function parseDate(value: string | null | undefined, label: string): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError("VALIDATION", `${label} isn't a valid date`);
  return date;
}

function checkDescription(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") throw new AppError("VALIDATION", "Description must be rich-text JSON");
  if (JSON.stringify(value).length > DESCRIPTION_MAX_BYTES) {
    throw new AppError("VALIDATION", "Description is too long");
  }
  return value as Prisma.InputJsonValue;
}

function sameInstant(a: Date | null, b: Date | null) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

function iso(d: Date | null) {
  return d?.toISOString() ?? null;
}

function notFound() {
  return new AppError("NOT_FOUND", "Task not found");
}
