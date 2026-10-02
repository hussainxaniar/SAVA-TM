import { db } from "../db";
import { decrypt, encrypt, signState, verifyState } from "../crypto";
import { AppError } from "../errors";
import { requireMember } from "../guards";
import { CALENDAR_SCOPE, googleApi, googleStatus, isInvalidGrant, type EventBody } from "../google/api";
import { logActivity } from "./activity";
import type { Ctx, GoogleEventDTO, GoogleEventsResult } from "./types";

/*
 * Section 10.2 / 10.3 (T-18): connecting Google Calendar and pushing time blocks to it.
 * Pushes run AFTER the DB transaction that changed the block has committed, never inside it:
 * the block is saved PENDING, then the Google call sets SYNCED (+ googleEventId/etag) or ERROR
 * (+ lastSyncError). Without a connection, blocks simply stay local (PENDING) and are pushed when
 * the user connects. Pulling changes back from Google is T-19.
 */

const REFRESH_MARGIN_MS = 60_000;
const RECONNECT = "Google Calendar access expired. Reconnect it in Integrations.";

// ---------- connection ----------

export type GoogleConnectionDTO = {
  /** GOOGLE_CLIENT_ID / SECRET / APP_URL are set on this deployment. */
  configured: boolean;
  connected: boolean;
  email: string | null;
  calendarId: string | null;
};

export async function getGoogleConnection(ctx: Ctx): Promise<GoogleConnectionDTO> {
  const conn = await db.googleCalendarConnection.findUnique({
    where: { userId: ctx.userId },
    select: { googleEmail: true, calendarId: true },
  });
  return {
    configured: googleApi.configured(),
    connected: !!conn,
    email: conn?.googleEmail ?? null,
    calendarId: conn?.calendarId ?? null,
  };
}

/** The Google consent URL. `spaceId` is where the callback returns the user (signed into `state`). */
export async function getGoogleAuthUrl(ctx: Ctx, input: { spaceId: string }): Promise<{ url: string }> {
  await requireMember(ctx.userId, input.spaceId);
  if (!googleApi.configured()) {
    throw new AppError("VALIDATION", "Google Calendar isn't set up on this server yet");
  }
  return { url: googleApi.authUrl(signState({ userId: ctx.userId, spaceId: input.spaceId })) };
}

/**
 * `/api/google/callback`: verifies the state, exchanges the code, stores the tokens encrypted,
 * then pushes the user's pending future blocks. Returns the space to send the user back to.
 */
export async function handleGoogleCallback(ctx: Ctx, input: { code: string; state: string }): Promise<{ spaceId: string }> {
  const { spaceId } = verifyState(input.state, ctx.userId);
  const tokens = await googleApi.exchangeCode(input.code);
  if (!tokens.scope.split(/\s+/).includes(CALENDAR_SCOPE)) {
    throw new AppError("VALIDATION", "Calendar access wasn't granted. Connect again and leave the calendar permission checked.");
  }
  const existing = await db.googleCalendarConnection.findUnique({
    where: { userId: ctx.userId },
    select: { refreshTokenEnc: true },
  });
  // prompt=consent always returns a refresh token; keep the old one if Google ever omits it.
  const refreshTokenEnc = tokens.refreshToken ? encrypt(tokens.refreshToken) : existing?.refreshTokenEnc;
  if (!refreshTokenEnc) throw new AppError("VALIDATION", "Google didn't grant offline access. Try connecting again.");

  const data = {
    googleEmail: tokens.email ?? "",
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
  };
  await db.googleCalendarConnection.upsert({
    where: { userId: ctx.userId },
    create: { userId: ctx.userId, calendarId: "primary", ...data },
    update: data,
  });
  await pushPendingForUser(ctx.userId);
  return { spaceId };
}

/** Revokes at Google (best effort) and forgets the tokens. Blocks and their events stay as they are. */
export async function disconnectGoogle(ctx: Ctx): Promise<void> {
  const conn = await db.googleCalendarConnection.findUnique({
    where: { userId: ctx.userId },
    select: { refreshTokenEnc: true },
  });
  if (!conn) return;
  try {
    await googleApi.revoke(decrypt(conn.refreshTokenEnc));
  } catch {
    // Already revoked, or Google is unreachable: forgetting the tokens is what matters.
  }
  await db.googleCalendarConnection.delete({ where: { userId: ctx.userId } });
}

/**
 * A valid access token for the user's calendar, refreshed when it expires within 60 seconds.
 * null without a connection. A dead refresh token (invalid_grant) deletes the connection and
 * throws the "Reconnect" message.
 */
async function accessFor(userId: string): Promise<{ token: string; calendarId: string } | null> {
  const conn = await db.googleCalendarConnection.findUnique({ where: { userId } });
  if (!conn) return null;
  if (conn.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    return { token: decrypt(conn.accessTokenEnc), calendarId: conn.calendarId };
  }
  try {
    const fresh = await googleApi.refresh(decrypt(conn.refreshTokenEnc));
    await db.googleCalendarConnection.update({
      where: { userId },
      data: { accessTokenEnc: encrypt(fresh.accessToken), expiresAt: fresh.expiresAt },
    });
    return { token: fresh.accessToken, calendarId: conn.calendarId };
  } catch (e) {
    if (isInvalidGrant(e)) {
      await db.googleCalendarConnection.deleteMany({ where: { userId } });
      throw new AppError("VALIDATION", RECONNECT);
    }
    throw e;
  }
}

// ---------- push ----------

const gone = (e: unknown) => googleStatus(e) === 404 || googleStatus(e) === 410;

function syncMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const status = googleStatus(e);
  const text = e instanceof Error ? e.message : String(e);
  return `Google Calendar${status ? ` (${status})` : ""}: ${text}`.slice(0, 300);
}

/**
 * Creates or patches the block's Google event (10.3) and records the outcome on the block.
 * No-op without a connection. `timeZone` is the browser's, sent with the write that triggered it.
 */
export async function pushTimeBlock(timeBlockId: string, timeZone?: string): Promise<void> {
  const block = await db.timeBlock.findUnique({
    where: { id: timeBlockId },
    select: {
      id: true,
      userId: true,
      start: true,
      end: true,
      googleEventId: true,
      task: {
        select: {
          id: true,
          title: true,
          spaceId: true,
          projectId: true,
          homeListId: true,
          deletedAt: true,
          project: { select: { name: true } },
          homeList: { select: { name: true } },
        },
      },
    },
  });
  if (!block || block.task.deletedAt) return;

  try {
    const access = await accessFor(block.userId);
    if (!access) return;
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const t = block.task;
    const body: EventBody = {
      summary: t.title,
      description: `${appUrl}/s/${t.spaceId}/p/${t.projectId}/l/${t.homeListId}?task=${t.id}\n${t.project.name} › ${t.homeList.name}`,
      start: { dateTime: block.start.toISOString(), ...(timeZone ? { timeZone } : {}) },
      end: { dateTime: block.end.toISOString(), ...(timeZone ? { timeZone } : {}) },
      extendedProperties: { private: { appTaskId: t.id, appTimeBlockId: block.id } },
      reminders: { useDefault: true },
    };

    let eventId = block.googleEventId;
    let etag: string | null;
    if (eventId) {
      try {
        ({ etag } = await googleApi.patchEvent(access.token, access.calendarId, eventId, body));
      } catch (e) {
        if (!gone(e)) throw e;
        ({ id: eventId, etag } = await googleApi.insertEvent(access.token, access.calendarId, body)); // deleted in Google: recreate
      }
    } else {
      ({ id: eventId, etag } = await googleApi.insertEvent(access.token, access.calendarId, body));
    }
    await db.timeBlock.update({
      where: { id: block.id },
      data: { googleEventId: eventId, googleEtag: etag, syncState: "SYNCED", lastSyncError: null },
    });
  } catch (e) {
    await db.timeBlock.updateMany({
      where: { id: block.id },
      data: { syncState: "ERROR", lastSyncError: syncMessage(e) },
    });
  }
}

/** Deletes a removed block's Google event (best effort; 404/410 count as done). */
export async function removeGoogleEvent(userId: string, googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    const access = await accessFor(userId);
    if (!access) return;
    await googleApi.deleteEvent(access.token, access.calendarId, googleEventId);
  } catch (e) {
    if (!gone(e)) console.error("Google event delete failed", e);
  }
}

/** A renamed task: patch the summary of its blocks that end in the future (10.3). */
export async function pushTaskRename(taskId: string): Promise<void> {
  const blocks = await db.timeBlock.findMany({
    where: { taskId, end: { gt: new Date() }, googleEventId: { not: null } },
    select: { id: true },
  });
  await Promise.all(blocks.map((b) => pushTimeBlock(b.id)));
}

/**
 * Deleted tasks (and their subtrees): delete the Google events of their future blocks (10.3) and
 * mark the blocks PENDING again, so a restore can push them back.
 */
export async function unpushTasks(taskIds: string[]): Promise<void> {
  const blocks = await db.timeBlock.findMany({
    where: { taskId: { in: taskIds }, end: { gt: new Date() }, googleEventId: { not: null } },
    select: { id: true, userId: true, googleEventId: true },
  });
  await Promise.all(
    blocks.map(async (b) => {
      await removeGoogleEvent(b.userId, b.googleEventId);
      await db.timeBlock.update({
        where: { id: b.id },
        data: { googleEventId: null, googleEtag: null, syncState: "PENDING", lastSyncError: null },
      });
    }),
  );
}

/** Restored tasks: push their future blocks that aren't on Google. */
export async function pushTasks(taskIds: string[]): Promise<void> {
  const blocks = await db.timeBlock.findMany({
    where: { taskId: { in: taskIds }, end: { gt: new Date() }, syncState: { not: "SYNCED" } },
    select: { id: true },
  });
  await Promise.all(blocks.map((b) => pushTimeBlock(b.id)));
}

/** After connecting: push the user's future blocks that aren't on Google yet (at most 100). */
async function pushPendingForUser(userId: string): Promise<void> {
  const blocks = await db.timeBlock.findMany({
    where: { userId, end: { gt: new Date() }, syncState: { not: "SYNCED" }, task: { deletedAt: null } },
    orderBy: { start: "asc" },
    take: 100,
    select: { id: true },
  });
  for (const b of blocks) await pushTimeBlock(b.id);
}

// ---------- pull (10.4) ----------

const instant = (e: EventBody["start"]) => (e?.dateTime ? new Date(e.dateTime).getTime() : null);

/**
 * Google → app, for the range the calendar is showing: reconciles my blocks with their events
 * (Google wins), then returns every other event as a read-only DTO.
 *  1. Events carrying our appTimeBlockId: moved → update the block and log SCHEDULED;
 *     cancelled → delete the block and log UNSCHEDULED. They're never returned as gray events.
 *  2. My synced blocks in range whose event didn't come back are checked with events.get: gone or
 *     cancelled → delete the block; moved elsewhere → update it.
 * Not connected: nothing. Google being unreachable returns nothing too (the calendar still works);
 * a dead refresh token throws the "Reconnect" message.
 */
export async function listGoogleEvents(
  ctx: Ctx,
  input: { rangeStart: string; rangeEnd: string },
): Promise<GoogleEventsResult> {
  const start = new Date(input.rangeStart);
  const end = new Date(input.rangeEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 62 * 86_400_000) {
    throw new AppError("VALIDATION", "Pick a shorter date range");
  }
  const access = await accessFor(ctx.userId); // throws the reconnect message when the grant is dead
  if (!access) return { events: [], changed: false };

  let items: EventBody[];
  try {
    items = await googleApi.listEvents(access.token, access.calendarId, start.toISOString(), end.toISOString());
  } catch (e) {
    console.error("Google events list failed", e);
    return { events: [], changed: false };
  }

  const blocks = await db.timeBlock.findMany({
    where: { userId: ctx.userId, googleEventId: { not: null }, start: { lt: end }, end: { gt: start }, task: { deletedAt: null } },
    select: { id: true, taskId: true, spaceId: true, start: true, end: true, googleEventId: true },
  });
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const seen = new Set<string>();
  let changed = false;

  const sync = async (blockId: string, event: EventBody) => {
    const block = await db.timeBlock.findFirst({
      where: { id: blockId, userId: ctx.userId },
      select: { id: true, taskId: true, spaceId: true, start: true, end: true },
    });
    if (!block) return;
    if (event.status === "cancelled") {
      await db.$transaction(async (tx) => {
        await tx.timeBlock.delete({ where: { id: block.id } });
        await logActivity(tx, { spaceId: block.spaceId, taskId: block.taskId, actorId: ctx.userId, type: "UNSCHEDULED", payload: { timeBlockId: block.id } });
      });
      changed = true;
      return;
    }
    const s = instant(event.start);
    const e = instant(event.end);
    if (s === null || e === null || e <= s) return; // an all-day event: not a slot we can mirror
    if (s === block.start.getTime() && e === block.end.getTime()) return;
    const newStart = new Date(s);
    const newEnd = new Date(e);
    await db.$transaction(async (tx) => {
      await tx.timeBlock.update({
        where: { id: block.id },
        data: { start: newStart, end: newEnd, googleEtag: event.etag ?? null, syncState: "SYNCED", lastSyncError: null },
      });
      await logActivity(tx, {
        spaceId: block.spaceId,
        taskId: block.taskId,
        actorId: ctx.userId,
        type: "SCHEDULED",
        payload: { timeBlockId: block.id, start: newStart.toISOString(), end: newEnd.toISOString() },
      });
    });
    changed = true;
  };

  const others: GoogleEventDTO[] = [];
  for (const event of items) {
    if (event.id) seen.add(event.id);
    const ours = event.extendedProperties?.private?.appTimeBlockId;
    if (ours) {
      await sync(ours, event);
      continue;
    }
    if (event.status === "cancelled" || !event.id) continue;
    const allDay = !!event.start?.date && !event.start?.dateTime;
    const from = allDay ? event.start?.date : event.start?.dateTime;
    const to = allDay ? event.end?.date : event.end?.dateTime;
    if (!from || !to) continue;
    others.push({
      id: event.id,
      title: event.summary || "(No title)",
      start: allDay ? from : new Date(from).toISOString(),
      end: allDay ? to : new Date(to).toISOString(),
      allDay,
      htmlLink: event.htmlLink ?? null,
    });
  }

  // My blocks whose event wasn't in range any more: moved away, or deleted in Google.
  for (const block of blocks) {
    if (!block.googleEventId || seen.has(block.googleEventId) || !blockById.has(block.id)) continue;
    let event: EventBody | null;
    try {
      event = await googleApi.getEvent(access.token, access.calendarId, block.googleEventId);
    } catch (e) {
      console.error("Google event lookup failed", e);
      continue;
    }
    await sync(block.id, event ?? { status: "cancelled" });
  }

  return { events: others, changed };
}
