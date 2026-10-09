import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createProject } from "@/server/services/projects";
import { createTask, deleteTask, setCompleted } from "@/server/services/tasks";
import {
  createTimeBlock,
  deleteTimeBlock,
  listDueChips,
  listTimeBlocks,
  listCalendarTasks,
  updateTimeBlock,
} from "@/server/services/timeblocks";
import { makeSpace, makeUser, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const tz = "America/Sao_Paulo";
const iso = (d: Date) => d.toISOString();
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member" | "other">>>;
let me: { userId: string };
let listId: string;

beforeEach(async () => {
  s = await makeSpace({ owner: "OWNER", member: "MEMBER", other: "MEMBER" });
  me = as(s.users.member.id);
  listId = (await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "P" })).firstListId;
});

const range = (from: number, to: number) => ({ spaceId: s.space.id, rangeStart: iso(hoursFromNow(from)), rangeEnd: iso(hoursFromNow(to)) });

describe("createTimeBlock / listTimeBlocks", () => {
  it("schedules several slots for one task, lists mine in range, logs SCHEDULED", async () => {
    const t = await createTask(me, { listId, title: "Write brief" });
    const a = await createTimeBlock(me, { taskId: t.id, start: iso(hoursFromNow(2)), end: iso(hoursFromNow(3)), timeZone: tz });
    await createTimeBlock(me, { taskId: t.id, start: iso(hoursFromNow(26)), end: iso(hoursFromNow(27)), timeZone: tz });
    expect(a).toMatchObject({ taskId: t.id, taskTitle: "Write brief", syncState: "PENDING", completed: false });

    expect((await listTimeBlocks(me, range(0, 48))).map((b) => b.taskTitle)).toEqual(["Write brief", "Write brief"]);
    expect(await listTimeBlocks(me, range(4, 20))).toEqual([]);
    expect(await listTimeBlocks(as(s.users.other.id), range(0, 48))).toEqual([]); // only my calendar
    const log = await db.activity.findMany({ where: { taskId: t.id, type: "SCHEDULED" } });
    expect(log).toHaveLength(2);

    await setCompleted(me, { taskId: t.id, completed: true });
    expect((await listTimeBlocks(me, range(0, 48)))[0].completed).toBe(true);
    await deleteTask(me, { taskId: t.id });
    expect(await listTimeBlocks(me, range(0, 48))).toEqual([]);
  });

  it("validates the slot, the zone and the range", async () => {
    const t = await createTask(me, { listId, title: "T" });
    const at = (h: number) => iso(hoursFromNow(h));
    await expect(createTimeBlock(me, { taskId: t.id, start: at(2), end: at(2.1), timeZone: tz })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTimeBlock(me, { taskId: t.id, start: at(2), end: at(30), timeZone: tz })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createTimeBlock(me, { taskId: t.id, start: at(2), end: at(3), timeZone: "Mars/Base" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(listTimeBlocks(me, range(0, 24 * 70))).rejects.toMatchObject({ code: "VALIDATION" });
    const outsider = await makeUser("outsider-blocks");
    await expect(createTimeBlock(as(outsider.id), { taskId: t.id, start: at(2), end: at(3), timeZone: tz })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("updateTimeBlock / deleteTimeBlock", () => {
  it("lets only the owner move or remove a block", async () => {
    const t = await createTask(me, { listId, title: "T" });
    const b = await createTimeBlock(me, { taskId: t.id, start: iso(hoursFromNow(2)), end: iso(hoursFromNow(3)), timeZone: tz });
    const moved = await updateTimeBlock(me, { timeBlockId: b.id, start: iso(hoursFromNow(5)), end: iso(hoursFromNow(6.5)), timeZone: tz });
    expect(new Date(moved.end).getTime() - new Date(moved.start).getTime()).toBe(90 * 60_000);
    await expect(updateTimeBlock(as(s.users.other.id), { timeBlockId: b.id, start: moved.start, end: moved.end, timeZone: tz })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteTimeBlock(as(s.users.other.id), { timeBlockId: b.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deleteTimeBlock(me, { timeBlockId: b.id });
    expect(await db.timeBlock.count({ where: { id: b.id } })).toBe(0);
    const types = (await db.activity.findMany({ where: { taskId: t.id }, orderBy: { createdAt: "asc" } })).map((a) => a.type);
    expect(types.filter((x) => x === "SCHEDULED" || x === "UNSCHEDULED")).toEqual(["SCHEDULED", "SCHEDULED", "UNSCHEDULED"]);
  });
});

describe("listCalendarTasks / listDueChips", () => {
  it("lists my open tasks without future blocks, and date-only dues in range", async () => {
    const free = await createTask(me, { listId, title: "Free", assigneeIds: [me.userId] });
    const booked = await createTask(me, { listId, title: "Booked", assigneeIds: [me.userId] });
    const past = await createTask(me, { listId, title: "Past only", assigneeIds: [me.userId] });
    await createTask(me, { listId, title: "Not mine", assigneeIds: [s.users.other.id] });
    await createTimeBlock(me, { taskId: booked.id, start: iso(hoursFromNow(2)), end: iso(hoursFromNow(3)), timeZone: tz });
    await db.timeBlock.create({ data: { taskId: past.id, userId: me.userId, spaceId: s.space.id, start: hoursFromNow(-5), end: hoursFromNow(-4) } });
    // Every open task of mine stays in the rail; scheduled ones carry their next slot and come last.
    const rail = await listCalendarTasks(me, { spaceId: s.space.id });
    expect(rail.map((t) => t.title)).toEqual(["Free", "Past only", "Booked"]); // unscheduled first, scheduled last
    const bookedStart = (await db.timeBlock.findFirstOrThrow({ where: { taskId: booked.id } })).start.toISOString();
    expect(rail.map((t) => t.nextBlockStart)).toEqual([null, null, bookedStart]); // an ended block isn't upcoming

    // a second, earlier slot becomes the next one
    const earlier = await createTimeBlock(me, { taskId: booked.id, start: iso(hoursFromNow(1)), end: iso(hoursFromNow(1.5)), timeZone: tz });
    const again = await listCalendarTasks(me, { spaceId: s.space.id });
    expect(again.find((t) => t.id === booked.id)?.nextBlockStart).toBe(earlier.start);

    // a block on someone else's calendar doesn't mark my row
    await db.timeBlock.create({ data: { taskId: free.id, userId: s.users.other.id, spaceId: s.space.id, start: hoursFromNow(5), end: hoursFromNow(6) } });
    expect((await listCalendarTasks(me, { spaceId: s.space.id })).find((t) => t.id === free.id)?.nextBlockStart).toBeNull();

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const due = new Date(Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate())).toISOString();
    await db.task.update({ where: { id: free.id }, data: { dueDate: due } });
    await db.task.update({ where: { id: past.id }, data: { dueDate: hoursFromNow(30), dueHasTime: true } }); // timed: not a chip
    const chips = await listDueChips(me, range(-24, 24 * 7));
    expect(chips.map((c) => [c.title, c.dueDate])).toEqual([["Free", due]]);
  });
});
