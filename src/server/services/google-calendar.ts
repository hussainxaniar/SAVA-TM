import { db } from "../db";
import { decrypt, encrypt, signState, verifyState } from "../crypto";
import { AppError } from "../errors";
import { requireMember } from "../guards";
import { CALENDAR_SCOPE, googleApi, googleStatus, isInvalidGrant, type EventBody } from "../google/api";
import type { Ctx } from "./types";

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
