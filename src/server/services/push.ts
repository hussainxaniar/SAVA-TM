import { after } from "next/server";
import { notificationHref } from "@/lib/notification-format";
import { pushText } from "@/lib/push-text";
import { db } from "../db";
import { AppError } from "../errors";
import { pushApi, type PushPayload } from "../push/api";
import type { Ctx } from "./types";

/*
 * Section 17: web push. The bell's notifications are also sent to every device the recipient
 * turned push on for.
 *
 * Outbox: Notification rows are written inside the transaction of the activity that caused them
 * (16.1). Sending there would put a network call inside a transaction and let a failing push
 * service fail the user's action. Instead a row is born with `pushedAt = null`, and after the
 * response `dispatchPendingPushes` claims the unpushed rows and sends them. It is scheduled from
 * the only two doors a change comes through: the action wrapper and the MCP handler.
 */

/** Only fresh rows are pushed: a notification that waited longer is old news (it is in the bell). */
const FRESH_MS = 10 * 60_000;
const MAX_FIELD = 2048;

// ---------- Subscriptions (a user's own devices; no space involved, so the session is the guard) ----------

export function getPushConfig(): { configured: boolean; publicKey: string | null } {
  return { configured: pushApi.isConfigured(), publicKey: pushApi.publicKey() };
}

/** Stores this browser's subscription for the caller. A device another user had subscribed moves to the caller. */
export async function savePushSubscription(
  ctx: Ctx,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
): Promise<void> {
  let url: URL;
  try {
    url = new URL(input.endpoint);
  } catch {
    throw new AppError("VALIDATION", "Invalid push subscription");
  }
  if (url.protocol !== "https:" || input.endpoint.length > MAX_FIELD || !input.p256dh || !input.auth) {
    throw new AppError("VALIDATION", "Invalid push subscription");
  }
  const data = {
    userId: ctx.userId,
    p256dh: input.p256dh.slice(0, MAX_FIELD),
    auth: input.auth.slice(0, MAX_FIELD),
    userAgent: input.userAgent?.slice(0, 300) ?? null,
  };
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });
}

/** Removes one of the caller's subscriptions. An unknown endpoint, or someone else's, is a no-op. */
export async function deletePushSubscription(ctx: Ctx, input: { endpoint: string }): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint: input.endpoint, userId: ctx.userId } });
}

// ---------- Sending ----------

// Set when this process wrote notification rows, so the many read-only requests skip the outbox query.
let pending = false;

/** Called where notification rows are created (notifyFromActivities). */
export function markPushPending(): void {
  pending = true;
}

/**
 * Sends what is waiting, once the response has gone out. Call it at the end of a request that may
 * have changed something. Safe anywhere: without a request scope it just runs in the background.
 */
export function schedulePushDispatch(): void {
  if (!pending || !pushApi.isConfigured()) return;
  try {
    after(() => dispatchPendingPushes());
  } catch {
    void dispatchPendingPushes(); // no request scope (a script, a test)
  }
}

/**
 * Claims the unpushed notifications of the last ten minutes and sends each to its recipient's
 * devices. The claim is one UPDATE … RETURNING, so two requests finishing together never send the
 * same notification twice. Never throws: a push that cannot be sent is dropped (it stays in the bell).
 */
export async function dispatchPendingPushes(): Promise<void> {
  if (!pushApi.isConfigured()) return;
  pending = false;
  try {
    const claimed = await db.notification.updateManyAndReturn({
      where: { pushedAt: null, createdAt: { gt: new Date(Date.now() - FRESH_MS) } },
      data: { pushedAt: new Date() },
      select: { id: true },
    });
    if (claimed.length === 0) return;

    const rows = await db.notification.findMany({
      where: { id: { in: claimed.map((c) => c.id) }, task: { deletedAt: null } },
      select: {
        id: true,
        spaceId: true,
        userId: true,
        type: true,
        payload: true,
        actor: { select: { name: true } },
        task: { select: { id: true, title: true, projectId: true, homeListId: true } },
      },
    });
    if (rows.length === 0) return;
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subscriptions.length === 0) return;

    const statusIds = rows
      .filter((r) => r.type === "STATUS_CHANGED")
      .map((r) => (r.payload as Record<string, unknown>).to)
      .filter((x): x is string => typeof x === "string");
    const statuses = statusIds.length
      ? await db.status.findMany({ where: { id: { in: statusIds } }, select: { id: true, name: true } })
      : [];
    const statusName = new Map(statuses.map((s) => [s.id, s.name]));

    const gone: string[] = [];
    const used: string[] = [];
    await Promise.all(
      rows.flatMap((row) => {
        const p = row.payload as Record<string, unknown>;
        const text = pushText({
          type: row.type,
          actorName: row.actor.name,
          taskTitle: row.task.title,
          statusName: typeof p.to === "string" ? (statusName.get(p.to) ?? null) : null,
          completed: typeof p.completed === "boolean" ? p.completed : null,
          dueDate: row.type === "DUE_DATE_CHANGED" && typeof p.to === "string" ? p.to : null,
          dueHasTime: p.toHasTime === true,
          dueCleared: row.type === "DUE_DATE_CHANGED" && typeof p.to !== "string",
        });
        const payload: PushPayload = { ...text, url: notificationHref(row.spaceId, row), tag: row.id };
        return subscriptions
          .filter((s) => s.userId === row.userId)
          .map(async (s) => {
            try {
              const result = await pushApi.send(s, payload);
              (result === "gone" ? gone : used).push(s.id);
            } catch (e) {
              console.error("web push failed", e instanceof Error ? e.message : e);
            }
          });
      }),
    );
    if (gone.length > 0) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    const alive = [...new Set(used)].filter((id) => !gone.includes(id));
    if (alive.length > 0) await db.pushSubscription.updateMany({ where: { id: { in: alive } }, data: { lastUsedAt: new Date() } });
  } catch (e) {
    console.error("web push dispatch failed", e instanceof Error ? e.message : e);
  }
}
