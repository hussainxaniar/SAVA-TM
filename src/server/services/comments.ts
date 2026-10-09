import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";
import { PERMISSIONS, hasRole, requireMember, spaceIdOfComment, spaceIdOfTask } from "../guards";
import { currentVia } from "../mcp/context";
import { logActivity } from "./activity";
import type { Ctx, FeedItemDTO, UserLite } from "./types";

/*
 * Section 8.5 / 6.10. Any member comments; authors edit and delete their own; Admin/Owner can
 * delete any. Deletion is soft ("Comment deleted" stays in the feed). addComment logs
 * COMMENT_ADDED { commentId } in the same transaction.
 */

const BODY_MAX_BYTES = 50_000;
const userLite = { select: { id: true, name: true, image: true } } as const;

export async function addComment(ctx: Ctx, input: { taskId: string; body: unknown }): Promise<FeedItemDTO> {
  const spaceId = await spaceIdOfTask(input.taskId);
  const member = await requireMember(ctx.userId, spaceId);
  const { body, bodyText } = checkBody(input.body);

  return db.$transaction(async (tx) => {
    const task = await tx.task.findFirst({ where: { id: input.taskId, deletedAt: null }, select: { id: true } });
    if (!task) throw new AppError("NOT_FOUND", "Task not found");
    const comment = await tx.comment.create({
      data: { taskId: task.id, authorId: ctx.userId, body, bodyText, via: currentVia() },
      select: { id: true, body: true, createdAt: true, editedAt: true, deletedAt: true, via: true, authorId: true, author: userLite },
    });
    await logActivity(tx, {
      spaceId,
      taskId: task.id,
      actorId: ctx.userId,
      type: "COMMENT_ADDED",
      payload: { commentId: comment.id },
    });
    return toCommentItem(comment, ctx.userId, member.role);
  });
}

/** Author only; deleted comments can't be edited. */
export async function editComment(ctx: Ctx, input: { commentId: string; body: unknown }): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfComment(input.commentId));
  const { body, bodyText } = checkBody(input.body);
  const comment = await db.comment.findUniqueOrThrow({
    where: { id: input.commentId },
    select: { authorId: true, deletedAt: true },
  });
  if (comment.deletedAt) throw new AppError("NOT_FOUND", "Comment not found");
  if (comment.authorId !== ctx.userId) throw new AppError("FORBIDDEN", "You can only edit your own comments");
  await db.comment.update({ where: { id: input.commentId }, data: { body, bodyText, editedAt: new Date() } });
}

/** The author, or Admin/Owner (PERMISSIONS.deleteOthersComments). Soft; deleting twice is a no-op. */
export async function deleteComment(ctx: Ctx, input: { commentId: string }): Promise<void> {
  const member = await requireMember(ctx.userId, await spaceIdOfComment(input.commentId));
  const comment = await db.comment.findUniqueOrThrow({
    where: { id: input.commentId },
    select: { authorId: true, deletedAt: true },
  });
  if (comment.deletedAt) return;
  if (comment.authorId !== ctx.userId && !hasRole(member.role, PERMISSIONS.deleteOthersComments)) {
    throw new AppError("FORBIDDEN", "Only the author or an Admin can delete this comment");
  }
  await db.comment.update({ where: { id: input.commentId }, data: { deletedAt: new Date() } });
}

/**
 * The task's comments (deleted ones as placeholders) and activity (minus COMMENT_ADDED), oldest
 * first. `filter: "comments"` returns only comments. Labels resolve every id an activity payload
 * mentions, including deleted tasks and lists, so old entries still read well.
 */
export async function getFeed(ctx: Ctx, input: { taskId: string; filter?: "all" | "comments" }): Promise<FeedItemDTO[]> {
  const member = await requireMember(ctx.userId, await spaceIdOfTask(input.taskId));
  const task = await db.task.findFirst({ where: { id: input.taskId, deletedAt: null }, select: { id: true } });
  if (!task) throw new AppError("NOT_FOUND", "Task not found");

  const comments = await db.comment.findMany({
    where: { taskId: task.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, body: true, createdAt: true, editedAt: true, deletedAt: true, via: true, authorId: true, author: userLite },
  });
  const items: FeedItemDTO[] = comments.map((c) => toCommentItem(c, ctx.userId, member.role));

  if (input.filter !== "comments") {
    const rows = await db.activity.findMany({
      where: { taskId: task.id, type: { notIn: ["COMMENT_ADDED", "SUBTASK_ADDED"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, type: true, payload: true, createdAt: true, actor: userLite },
    });
    const labels = await labelsFor(rows.map((r) => r.payload));
    for (const r of rows) {
      const payload = (r.payload ?? {}) as Record<string, unknown>;
      items.push({
        kind: "activity",
        id: r.id,
        actor: r.actor,
        type: r.type,
        payload,
        labels: pick(labels, idsIn(payload)),
        createdAt: r.createdAt.toISOString(),
      });
    }
  }

  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

// ---------- helpers ----------

function toCommentItem(
  c: {
    id: string;
    body: Prisma.JsonValue;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
    via: string | null;
    authorId: string;
    author: UserLite;
  },
  viewerId: string,
  viewerRole: Parameters<typeof hasRole>[0],
): FeedItemDTO {
  const deleted = c.deletedAt !== null;
  const mine = c.authorId === viewerId;
  return {
    kind: "comment",
    id: c.id,
    author: c.author,
    body: deleted ? null : c.body,
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    deleted,
    via: c.via,
    canEdit: mine && !deleted,
    canDelete: !deleted && (mine || hasRole(viewerRole, PERMISSIONS.deleteOthersComments)),
  };
}

/** A Tiptap doc with some text, under the size limit; returns it with its plain text. */
function checkBody(value: unknown): { body: Prisma.InputJsonValue; bodyText: string } {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "doc") {
    throw new AppError("VALIDATION", "Comment must be rich-text JSON");
  }
  if (JSON.stringify(value).length > BODY_MAX_BYTES) throw new AppError("VALIDATION", "Comment is too long");
  const bodyText = plainText(value).replace(/\s+/g, " ").trim();
  if (!bodyText) throw new AppError("VALIDATION", "Write something first");
  return { body: value as Prisma.InputJsonValue, bodyText };
}

function plainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: unknown; content?: unknown; type?: unknown };
  const own = typeof n.text === "string" ? n.text : "";
  const kids = Array.isArray(n.content) ? n.content.map(plainText).join(n.type === "doc" ? "\n" : "") : "";
  return own + kids;
}

/** Every string under the payload keys that hold ids. */
const ID_KEYS = ["from", "to", "listId", "fromListId", "toListId", "userId", "subtaskId"] as const;
function idsIn(payload: Record<string, unknown>): string[] {
  return ID_KEYS.map((k) => payload[k]).filter((v): v is string => typeof v === "string");
}

function pick(all: Map<string, string>, ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    const name = all.get(id);
    if (name !== undefined) out[id] = name;
  }
  return out;
}

/** Names for every id-like string in the payloads: statuses, lists, users and tasks. */
async function labelsFor(payloads: Prisma.JsonValue[]): Promise<Map<string, string>> {
  const ids = [...new Set(payloads.flatMap((p) => idsIn((p ?? {}) as Record<string, unknown>)))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const where = { id: { in: ids } };
  const [statuses, lists, users, tasks] = await Promise.all([
    db.status.findMany({ where, select: { id: true, name: true } }),
    db.list.findMany({ where, select: { id: true, name: true } }),
    db.user.findMany({ where, select: { id: true, name: true } }),
    db.task.findMany({ where, select: { id: true, title: true } }),
  ]);
  for (const s of statuses) out.set(s.id, s.name);
  for (const l of lists) out.set(l.id, l.name);
  for (const u of users) out.set(u.id, u.name);
  for (const t of tasks) out.set(t.id, t.title);
  return out;
}
