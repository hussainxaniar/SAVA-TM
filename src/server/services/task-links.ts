import type { Prisma } from "@prisma/client";
import { taskLinkIds } from "@/lib/doc-task-links";
import { db } from "../db";
import { requireMember } from "../guards";
import type { Ctx, DocLinkDTO, TaskLabelDTO } from "./types";

/*
 * Section 11.4. Doc pages link tasks with an inline node; this keeps the DocTaskLink index (page <->
 * task) in step with the page content so a task can list the pages that mention it, and offers the
 * two lookups the editor needs: search (the insert popover) and labels (live titles for the chips).
 */

const SEARCH_LIMIT = 8;
const LABELS_MAX = 100;

/**
 * Rewrites the page's links from its (just saved) content. Ids of tasks that don't exist in the
 * page's space are ignored (a pasted or stale id must not create a link across spaces). Called
 * inside the save's transaction.
 */
export async function syncPageTaskLinks(tx: Prisma.TransactionClient, input: { pageId: string; spaceId: string; content: unknown }): Promise<void> {
  const wanted = taskLinkIds(input.content);
  const valid = wanted.length
    ? (await tx.task.findMany({ where: { id: { in: wanted }, spaceId: input.spaceId }, select: { id: true } })).map((t) => t.id)
    : [];
  await tx.docTaskLink.deleteMany({ where: { pageId: input.pageId, taskId: { notIn: valid } } });
  if (valid.length) await tx.docTaskLink.createMany({ data: valid.map((taskId) => ({ pageId: input.pageId, taskId })), skipDuplicates: true });
}

/** The pages (live docs only) that link the task, for the task dialog's Documents section. */
export async function docsLinkingTask(taskId: string): Promise<DocLinkDTO[]> {
  const rows = await db.docTaskLink.findMany({
    where: { taskId, page: { doc: { archivedAt: null } } },
    select: { page: { select: { id: true, title: true, docId: true, doc: { select: { title: true, projectId: true } } } } },
  });
  return rows
    .map((r) => ({ pageId: r.page.id, pageTitle: r.page.title, docId: r.page.docId, docTitle: r.page.doc.title, projectId: r.page.doc.projectId }))
    .sort((a, b) => a.docTitle.localeCompare(b.docTitle) || a.pageTitle.localeCompare(b.pageTitle));
}

const labelSelect = {
  id: true,
  title: true,
  projectId: true,
  homeListId: true,
  completedAt: true,
  deletedAt: true,
  status: { select: { id: true, name: true, color: true, category: true, icon: true } },
} as const;

type LabelRow = Prisma.TaskGetPayload<{ select: typeof labelSelect }>;

const toLabel = (t: LabelRow): TaskLabelDTO => ({
  id: t.id,
  title: t.title,
  projectId: t.projectId,
  listId: t.homeListId,
  completed: t.completedAt !== null,
  status: t.status,
});

/** The insert popover's search: live tasks of the space whose title contains the text (newest first); empty text lists the latest. */
export async function searchTasks(ctx: Ctx, input: { spaceId: string; query?: string }): Promise<TaskLabelDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const q = (input.query ?? "").trim().slice(0, 100);
  const rows = await db.task.findMany({
    where: { spaceId: input.spaceId, deletedAt: null, project: { archivedAt: null }, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: [{ updatedAt: "desc" }],
    take: SEARCH_LIMIT,
    select: labelSelect,
  });
  return rows.map(toLabel);
}

/** Live labels for task ids (the chips). Deleted or foreign tasks are simply absent, so the chip can say "Task not found". */
export async function getTaskLabels(ctx: Ctx, input: { spaceId: string; taskIds: string[] }): Promise<TaskLabelDTO[]> {
  await requireMember(ctx.userId, input.spaceId);
  const ids = [...new Set(input.taskIds)].slice(0, LABELS_MAX);
  if (ids.length === 0) return [];
  const rows = await db.task.findMany({ where: { id: { in: ids }, spaceId: input.spaceId, deletedAt: null }, select: labelSelect });
  return rows.map(toLabel);
}
