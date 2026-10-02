import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { db } from "@/server/db";
import { decrypt, encrypt, verifyState } from "@/server/crypto";
import { CALENDAR_SCOPE, googleApi } from "@/server/google/api";
import {
  disconnectGoogle,
  getGoogleAuthUrl,
  getGoogleConnection,
  handleGoogleCallback,
  listGoogleEvents,
} from "@/server/services/google-calendar";
import { createProject } from "@/server/services/projects";
import { createTask, deleteTask, restoreTask, updateTask } from "@/server/services/tasks";
import { createTimeBlock, deleteTimeBlock, retrySync, updateTimeBlock } from "@/server/services/timeblocks";
import { signState } from "@/server/crypto";
import { makeSpace, resetDb } from "../helpers/db";

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  process.env.AUTH_SECRET ??= "test-secret";
  process.env.APP_URL = "http://localhost:3000";
  await resetDb();
});

const as = (userId: string) => ({ userId });
const tz = "Asia/Kabul";
const later = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member">>>;
let me: { userId: string };
let listId: string;
type Api = typeof googleApi;
let api: {
  insertEvent: MockInstance<Api["insertEvent"]>;
  patchEvent: MockInstance<Api["patchEvent"]>;
  deleteEvent: MockInstance<Api["deleteEvent"]>;
  refresh: MockInstance<Api["refresh"]>;
  revoke: MockInstance<Api["revoke"]>;
};
let nextId = 0;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", member: "MEMBER" });
  me = as(s.users.member.id);
  listId = (await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" })).firstListId;
  vi.spyOn(googleApi, "configured").mockReturnValue(true);
  api = {
    insertEvent: vi.spyOn(googleApi, "insertEvent").mockImplementation(async () => ({ id: `ev${++nextId}`, etag: '"1"' })),
    patchEvent: vi.spyOn(googleApi, "patchEvent").mockResolvedValue({ etag: '"2"' }),
    deleteEvent: vi.spyOn(googleApi, "deleteEvent").mockResolvedValue(undefined),
    refresh: vi.spyOn(googleApi, "refresh").mockResolvedValue({ accessToken: "fresh", expiresAt: new Date(Date.now() + 3_600_000) }),
    revoke: vi.spyOn(googleApi, "revoke").mockResolvedValue(undefined),
  };
});
afterEach(() => vi.restoreAllMocks());

const connect = (userId: string, expiresInMs = 3_600_000) =>
  db.googleCalendarConnection.create({
    data: {
      userId,
      googleEmail: "me@gmail.com",
      accessTokenEnc: encrypt("access"),
      refreshTokenEnc: encrypt("refresh"),
      expiresAt: new Date(Date.now() + expiresInMs),
      scope: `openid email ${CALENDAR_SCOPE}`,
    },
  });
const block = (id: string) => db.timeBlock.findUniqueOrThrow({ where: { id } });

describe("connect", () => {
  it("builds a consent URL whose state is signed for this user and space", async () => {
    vi.spyOn(googleApi, "authUrl").mockImplementation((state) => `https://accounts.google.com/o?state=${state}`);
    const { url } = await getGoogleAuthUrl(me, { spaceId: s.space.id });
    const state = new URL(url).searchParams.get("state")!;
    expect(verifyState(state, me.userId)).toEqual({ userId: me.userId, spaceId: s.space.id });
  });

  it("stores tokens encrypted and pushes my pending future blocks", async () => {
    const t = await createTask(me, { listId, title: "Plan" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    expect(b.syncState).toBe("PENDING"); // not connected yet: stays local
    expect(api.insertEvent).not.toHaveBeenCalled();

    vi.spyOn(googleApi, "exchangeCode").mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: `openid email ${CALENDAR_SCOPE}`,
      email: "me@gmail.com",
    });
    const state = signState({ userId: me.userId, spaceId: s.space.id });
    expect(await handleGoogleCallback(me, { code: "c", state })).toEqual({ spaceId: s.space.id });

    const conn = await db.googleCalendarConnection.findUniqueOrThrow({ where: { userId: me.userId } });
    expect(conn.accessTokenEnc).not.toContain("access");
    expect(decrypt(conn.refreshTokenEnc)).toBe("refresh");
    expect(await getGoogleConnection(me)).toMatchObject({ connected: true, email: "me@gmail.com", calendarId: "primary" });
    expect((await block(b.id)).syncState).toBe("SYNCED");
  });

  it("refuses a state for someone else and a consent without the calendar scope", async () => {
    vi.spyOn(googleApi, "exchangeCode").mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: "openid email",
      email: "me@gmail.com",
    });
    const theirs = signState({ userId: s.users.owner.id, spaceId: s.space.id });
    await expect(handleGoogleCallback(me, { code: "c", state: theirs })).rejects.toMatchObject({ code: "VALIDATION" });
    const mine = signState({ userId: me.userId, spaceId: s.space.id });
    await expect(handleGoogleCallback(me, { code: "c", state: mine })).rejects.toThrow(/Calendar access/);
    expect(await db.googleCalendarConnection.count({ where: { userId: me.userId } })).toBe(0);
  });

  it("disconnect revokes and forgets the tokens, leaving blocks alone", async () => {
    await connect(me.userId);
    const t = await createTask(me, { listId, title: "Plan" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    await disconnectGoogle(me);
    expect(api.revoke).toHaveBeenCalledWith("refresh");
    expect(await getGoogleConnection(me)).toMatchObject({ connected: false });
    expect((await block(b.id)).googleEventId).not.toBeNull();
  });
});

describe("push (10.3)", () => {
  it("creates, patches and deletes the Google event for a block", async () => {
    await connect(me.userId);
    const t = await createTask(me, { listId, title: "Write brief" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    expect(b.syncState).toBe("SYNCED");
    const [, calendarId, body] = api.insertEvent.mock.calls[0];
    expect(calendarId).toBe("primary");
    expect(body).toMatchObject({
      summary: "Write brief",
      start: { timeZone: tz },
      extendedProperties: { private: { appTaskId: t.id, appTimeBlockId: b.id } },
    });
    expect(String(body.description)).toContain(`?task=${t.id}`);

    await updateTimeBlock(me, { timeBlockId: b.id, start: later(4), end: later(5), timeZone: tz });
    expect(api.patchEvent).toHaveBeenCalledWith("access", "primary", (await block(b.id)).googleEventId, expect.anything());

    const eventId = (await block(b.id)).googleEventId;
    await deleteTimeBlock(me, { timeBlockId: b.id });
    expect(api.deleteEvent).toHaveBeenCalledWith("access", "primary", eventId);
  });

  it("recreates an event deleted in Google, and marks failures ERROR with a working Retry", async () => {
    await connect(me.userId);
    const t = await createTask(me, { listId, title: "T" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    api.patchEvent.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { code: 404 }));
    const moved = await updateTimeBlock(me, { timeBlockId: b.id, start: later(4), end: later(5), timeZone: tz });
    expect(moved.syncState).toBe("SYNCED");
    expect(api.insertEvent).toHaveBeenCalledTimes(2);

    api.patchEvent.mockRejectedValueOnce(Object.assign(new Error("Rate limit"), { code: 429 }));
    const failed = await updateTimeBlock(me, { timeBlockId: b.id, start: later(6), end: later(7), timeZone: tz });
    expect(failed).toMatchObject({ syncState: "ERROR", lastSyncError: "Google Calendar (429): Rate limit" });
    expect(await retrySync(me, { timeBlockId: b.id, timeZone: tz })).toMatchObject({ syncState: "SYNCED", lastSyncError: null });
  });

  it("refreshes an access token that expires within a minute; a dead refresh token asks to reconnect", async () => {
    await connect(me.userId, 30_000);
    const t = await createTask(me, { listId, title: "T" });
    await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    expect(api.refresh).toHaveBeenCalledWith("refresh");
    expect(api.insertEvent.mock.calls[0][0]).toBe("fresh");
    const conn = await db.googleCalendarConnection.findUniqueOrThrow({ where: { userId: me.userId } });
    expect(decrypt(conn.accessTokenEnc)).toBe("fresh");

    await db.googleCalendarConnection.update({ where: { userId: me.userId }, data: { expiresAt: new Date() } });
    api.refresh.mockRejectedValueOnce(Object.assign(new Error("invalid_grant"), { response: { data: { error: "invalid_grant" } } }));
    const b = await createTimeBlock(me, { taskId: t.id, start: later(4), end: later(5), timeZone: tz });
    expect(b).toMatchObject({ syncState: "ERROR", lastSyncError: expect.stringMatching(/Reconnect/) });
    expect(await getGoogleConnection(me)).toMatchObject({ connected: false });
  });

  it("follows the task: rename patches future events, delete removes them, restore pushes them back", async () => {
    await connect(me.userId);
    const t = await createTask(me, { listId, title: "Old" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    api.patchEvent.mockClear();

    await updateTask(me, { taskId: t.id, title: "New" });
    expect(api.patchEvent).toHaveBeenCalledWith("access", "primary", expect.any(String), expect.objectContaining({ summary: "New" }));
    await updateTask(me, { taskId: t.id, priority: 1 });
    expect(api.patchEvent).toHaveBeenCalledTimes(1); // only renames touch Google

    const eventId = (await block(b.id)).googleEventId;
    await deleteTask(me, { taskId: t.id });
    expect(api.deleteEvent).toHaveBeenCalledWith("access", "primary", eventId);
    expect(await block(b.id)).toMatchObject({ googleEventId: null, syncState: "PENDING" });

    await restoreTask(me, { taskId: t.id });
    expect((await block(b.id)).syncState).toBe("SYNCED");
  });
});

describe("pull (10.4)", () => {
  const hours = (h: number) => new Date(Date.now() + h * 3_600_000);
  const range = (from: number, to: number) => ({ rangeStart: hours(from).toISOString(), rangeEnd: hours(to).toISOString() });
  const ours = (blockId: string, extra: Record<string, unknown> = {}) => ({
    id: googleEventIdOf.get(blockId),
    status: "confirmed",
    etag: '"9"',
    extendedProperties: { private: { appTimeBlockId: blockId } },
    ...extra,
  });
  const stub = (items: unknown[]) => vi.spyOn(googleApi, "listEvents").mockResolvedValue(items as never);

  const googleEventIdOf = new Map<string, string | null>();
  async function scheduled() {
    if (!(await db.googleCalendarConnection.count({ where: { userId: me.userId } }))) await connect(me.userId);
    const t = await createTask(me, { listId, title: "Write brief" });
    const b = await createTimeBlock(me, { taskId: t.id, start: later(2), end: later(3), timeZone: tz });
    const eventId = (await block(b.id)).googleEventId!;
    googleEventIdOf.set(b.id, eventId);
    return { t, b, eventId };
  }

  it("returns other events (timed and all-day) and nothing without a connection", async () => {
    expect(await listGoogleEvents(me, range(0, 48))).toEqual({ events: [], changed: false });
    await connect(me.userId);
    stub([
      { id: "a", summary: "Standup", status: "confirmed", start: { dateTime: hours(5).toISOString() }, end: { dateTime: hours(6).toISOString() }, htmlLink: "https://google/a" },
      { id: "b", status: "confirmed", start: { date: "2026-10-02" }, end: { date: "2026-10-03" } },
      { id: "c", summary: "Cancelled", status: "cancelled" },
    ]);
    const { events, changed } = await listGoogleEvents(me, range(0, 48));
    expect(changed).toBe(false);
    expect(events).toEqual([
      expect.objectContaining({ id: "a", title: "Standup", allDay: false, htmlLink: "https://google/a" }),
      expect.objectContaining({ id: "b", title: "(No title)", allDay: true, start: "2026-10-02", end: "2026-10-03" }),
    ]);
  });

  it("moves my block when its event moved in Google, logging SCHEDULED, and never lists it as gray", async () => {
    const { b, t } = await scheduled();
    const start = hours(10);
    const end = hours(11.5);
    stub([ours(b.id, { start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } })]);
    const { events, changed } = await listGoogleEvents(me, range(0, 48));
    expect(events).toEqual([]);
    expect(changed).toBe(true);
    expect(await block(b.id)).toMatchObject({ start, end, googleEtag: '"9"', syncState: "SYNCED" });
    const log = await db.activity.findMany({ where: { taskId: t.id, type: "SCHEDULED" } });
    expect(log).toHaveLength(2); // creating + the pulled move
    // Same times again: nothing changes.
    expect((await listGoogleEvents(me, range(0, 48))).changed).toBe(false);
  });

  it("deletes my block when its event was cancelled, logging UNSCHEDULED", async () => {
    const { b, t } = await scheduled();
    stub([ours(b.id, { status: "cancelled" })]);
    expect((await listGoogleEvents(me, range(0, 48))).changed).toBe(true);
    expect(await db.timeBlock.count({ where: { id: b.id } })).toBe(0);
    expect(await db.activity.count({ where: { taskId: t.id, type: "UNSCHEDULED" } })).toBe(1);
  });

  it("checks blocks whose event didn't come back: deleted → block removed, moved away → block updated", async () => {
    const { b } = await scheduled();
    stub([]);
    const get = vi.spyOn(googleApi, "getEvent").mockResolvedValue(null);
    expect((await listGoogleEvents(me, range(0, 48))).changed).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
    expect(await db.timeBlock.count({ where: { id: b.id } })).toBe(0);

    const { b: b2 } = await scheduled();
    const moved = hours(300);
    get.mockResolvedValue(ours(b2.id, { start: { dateTime: moved.toISOString() }, end: { dateTime: new Date(moved.getTime() + 3_600_000).toISOString() } }) as never);
    await listGoogleEvents(me, range(0, 48));
    expect((await block(b2.id)).start).toEqual(moved);
  });

  it("returns nothing when Google is unreachable, and asks to reconnect on a dead grant", async () => {
    await connect(me.userId);
    vi.spyOn(googleApi, "listEvents").mockRejectedValue(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await listGoogleEvents(me, range(0, 48))).toEqual({ events: [], changed: false });
    await db.googleCalendarConnection.update({ where: { userId: me.userId }, data: { expiresAt: new Date() } });
    api.refresh.mockRejectedValueOnce(Object.assign(new Error("invalid_grant"), { response: { data: { error: "invalid_grant" } } }));
    await expect(listGoogleEvents(me, range(0, 48))).rejects.toThrow(/Reconnect/);
    await expect(listGoogleEvents(me, { rangeStart: "x", rangeEnd: "y" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
