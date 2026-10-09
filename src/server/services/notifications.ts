import type { ActivityType, NotificationType, Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { requireMember } from "../guards";
import type { ActivityInput } from "./activity";
import type { Ctx, NotificationDTO } from "./types";

/*
 * Section 16. In-app notifications for the people involved in a task (its assignees and its
 * creator), created from the same activity rows the feed shows and inside the same transaction,
 * so a notification exists exactly when its activity does. Nobody is notified of their own
 * action, and only members of the task's space are notified.
 */

const LIST_DEFAULT = 30;
const LIST_MAX = 100;

/** Activity types that notify the people involved, and the notification they become. */
const INVOLVED_EVENTS: Partial<Record<ActivityType, NotificationType>> = {
  COMMENT_ADDED: "COMMENTED",
  STATUS_CHANGED: "STATUS_CHANGED",
  TASK_COMPLETED: "STATUS_CHANGED",
  TASK_REOPENED: "STATUS_CHANGED",
  DUE_DATE_CHANGED: "DUE_DATE_CHANGED",
};

type Row = Prisma.NotificationCreateManyInput;

/**
 * Called by logActivity / logActivities. STATUS_CHANGED and TASK_COMPLETED / TASK_REOPENED from one
 * edit describe one event, so they collapse into one STATUS_CHANGED notification per person.
 */
export async function notifyFromActivities(tx: Prisma.TransactionClient, inputs: ActivityInput[]): Promise<void> {
  const relevant = inputs.filter((i) => i.type === "ASSIGNEE_ADDED" || INVOLVED_EVENTS[i.type]);
  if (relevant.length === 0) return;

  const tasks = await tx.task.findMany({
    where: { id: { in: [...new Set(relevant.map((i) => i.taskId))] }, deletedAt: null },
    select: { id: true, createdById: true, assignees: { select: { userId: true } } },
  });
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // STATUS_CHANGED first, so a TASK_COMPLETED from the same edit merges into it.
  const ordered = [...relevant].sort((a, b) => Number(b.type === "STATUS_CHANGED") - Number(a.type === "STATUS_CHANGED"));
  const rows = new Map<string, Row>();
  for (const input of ordered) {
    const task = taskById.get(input.taskId);
    if (!task) continue;
    const payload = (input.payload ?? {}) as Record<string, unknown>;

    if (input.type === "ASSIGNEE_ADDED") {
      if (typeof payload.userId === "string") add(rows, input, payload.userId, "ASSIGNED", {});
      continue;
    }
    const type = INVOLVED_EVENTS[input.type]!;
    const involved = new Set([task.createdById, ...task.assignees.map((a) => a.userId)]);
    for (const userId of involved) {
      const existing = rows.get(key(userId, input.taskId, type));
      if (existing && type === "STATUS_CHANGED") {
        if (input.type === "TASK_COMPLETED") (existing.payload as Record<string, unknown>).completed = true;
        if (input.type === "TASK_REOPENED") (existing.payload as Record<string, unknown>).completed = false;
        continue;
      }
      add(rows, input, userId, type, eventPayload(input.type, payload));
    }
  }

  const candidates = [...rows.values()].filter((r) => r.userId !== r.actorId);
  if (candidates.length === 0) return;
  const members = await tx.spaceMember.findMany({
    where: { spaceId: { in: [...new Set(candidates.map((r) => r.spaceId))] }, userId: { in: [...new Set(candidates.map((r) => r.userId))] } },
    select: { spaceId: true, userId: true },
  });
  const memberKeys = new Set(members.map((m) => `${m.spaceId}|${m.userId}`));
  const data = candidates.filter((r) => memberKeys.has(`${r.spaceId}|${r.userId}`));
  if (data.length > 0) await tx.notification.createMany({ data });
}

const key = (userId: string, taskId: string, type: NotificationType) => `${userId}|${taskId}|${type}`;

function add(rows: Map<string, Row>, input: ActivityInput, userId: string, type: NotificationType, payload: Record<string, unknown>) {
  rows.set(key(userId, input.taskId, type), {
    spaceId: input.spaceId,
    userId,
    actorId: input.actorId,
    taskId: input.taskId,
    type,
    payload: payload as Prisma.InputJsonObject,
  });
}

/** What the browser needs to word the notification (status ids and dates, never names). */
function eventPayload(type: ActivityType, p: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case "STATUS_CHANGED":
      return { to: p.to ?? null };
    case "TASK_COMPLETED":
      return { completed: true };
    case "TASK_REOPENED":
      return { completed: false };
    case "DUE_DATE_CHANGED":
      return { to: p.to ?? null, toHasTime: p.toHasTime === true };
    default:
      return {};
  }
}

// ---------- Reading and marking ----------

/** The caller's notifications in a space, newest first. Notifications of deleted tasks are left out. */
export async function listNotifications(
  ctx: Ctx,
  input: { spaceId: string; limit?: number; unreadOnly?: boolean },
): Promise<NotificationDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const take = Math.min(Math.max(Math.trunc(input.limit ?? LIST_DEFAULT), 1), LIST_MAX);
  const rows = await db.notification.findMany({
    where: { userId: ctx.userId, spaceId: input.spaceId, task: { deletedAt: null }, ...(input.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      readAt: true,
      actor: { select: { id: true, name: true, image: true } },
      task: { select: { id: true, title: true, projectId: true, homeListId: true } },
    },
  });

  const statusIds = rows.filter((r) => r.type === "STATUS_CHANGED").map((r) => (r.payload as Record<string, unknown>).to).filter((x): x is string => typeof x === "string");
  const statuses = statusIds.length ? await db.status.findMany({ where: { id: { in: statusIds } }, select: { id: true, name: true } }) : [];
  const statusName = new Map(statuses.map((s) => [s.id, s.name]));

  return rows.map((r) => {
    const p = r.payload as Record<string, unknown>;
    return {
      id: r.id,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt?.toISOString() ?? null,
      actor: r.actor,
      task: r.task,
      statusName: r.type === "STATUS_CHANGED" && typeof p.to === "string" ? (statusName.get(p.to) ?? null) : null,
      completed: typeof p.completed === "boolean" ? p.completed : null,
      dueDate: r.type === "DUE_DATE_CHANGED" && typeof p.to === "string" ? p.to : null,
      dueHasTime: p.toHasTime === true,
    };
  });
}

export async function getUnreadCount(ctx: Ctx, input: { spaceId: string }): Promise<number> {
  await requireMember(ctx.userId, input.spaceId);
  return db.notification.count({
    where: { userId: ctx.userId, spaceId: input.spaceId, readAt: null, task: { deletedAt: null } },
  });
}

/** Marks one of the caller's notifications read. Someone else's id is NOT_FOUND. */
export async function markNotificationRead(ctx: Ctx, input: { notificationId: string }): Promise<void> {
  const row = await db.notification.findFirst({ where: { id: input.notificationId, userId: ctx.userId }, select: { spaceId: true } });
  if (!row) throw new AppError("NOT_FOUND", "Notification not found");
  await requireMember(ctx.userId, row.spaceId);
  await db.notification.updateMany({ where: { id: input.notificationId, userId: ctx.userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(ctx: Ctx, input: { spaceId: string }): Promise<void> {
  await requireMember(ctx.userId, input.spaceId);
  await db.notification.updateMany({
    where: { userId: ctx.userId, spaceId: input.spaceId, readAt: null },
    data: { readAt: new Date() },
  });
}
