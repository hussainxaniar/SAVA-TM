import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { pushApi, type PushPayload, type PushTarget } from "@/server/push/api";
import { addComment } from "@/server/services/comments";
import { createProject } from "@/server/services/projects";
import { deletePushSubscription, dispatchPendingPushes, getPushConfig, savePushSubscription } from "@/server/services/push";
import { createTask, setAssignees } from "@/server/services/tasks";
import { makeSpace, resetDb } from "../helpers/db";

beforeAll(resetDb);

const as = (userId: string) => ({ userId });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const sub = (name: string) => ({ endpoint: `https://push.example/${name}-${crypto.randomUUID()}`, p256dh: `p-${name}`, auth: `a-${name}` });

let s: Awaited<ReturnType<typeof makeSpace<"ada" | "ben" | "cy">>>;
let ada: { userId: string };
let ben: { userId: string };
let cy: { userId: string };
let spaceId: string;
let listId: string;
let projectId: string;
let sent: { target: PushTarget; payload: PushPayload }[];
let outcome: (target: PushTarget) => "sent" | "gone" | Error;

beforeEach(async () => {
  s = await makeSpace({ ada: "OWNER", ben: "MEMBER", cy: "MEMBER" });
  spaceId = s.space.id;
  ada = as(s.users.ada.id);
  ben = as(s.users.ben.id);
  cy = as(s.users.cy.id);
  const p = await createProject(ada, { spaceId, name: "P" });
  listId = p.firstListId;
  projectId = p.projectId;
  // Rows left by earlier tests must not be picked up by this test's dispatch.
  await db.notification.updateMany({ where: { pushedAt: null }, data: { pushedAt: new Date() } });
  sent = [];
  outcome = () => "sent";
  vi.spyOn(pushApi, "isConfigured").mockReturnValue(true);
  vi.spyOn(pushApi, "send").mockImplementation(async (target, payload) => {
    const result = outcome(target);
    if (result instanceof Error) throw result;
    sent.push({ target, payload });
    return result;
  });
});

afterEach(() => vi.restoreAllMocks());

/** Ada creates a task and assigns Ben: one ASSIGNED notification for Ben. */
async function assignToBen(title = "Write the brief") {
  const task = await createTask(ada, { listId, title });
  await setAssignees(ada, { taskId: task.id, userIds: [ben.userId] });
  return task;
}

describe("subscriptions", () => {
  it("saves a device once and lets its owner remove it", async () => {
    const device = sub("phone");
    await savePushSubscription(ben, device);
    await savePushSubscription(ben, { ...device, userAgent: "Phone" });
    expect(await db.pushSubscription.count({ where: { userId: ben.userId } })).toBe(1);

    await deletePushSubscription(cy, { endpoint: device.endpoint }); // not Cy's: nothing happens
    expect(await db.pushSubscription.count({ where: { endpoint: device.endpoint } })).toBe(1);
    await deletePushSubscription(ben, { endpoint: device.endpoint });
    expect(await db.pushSubscription.count({ where: { endpoint: device.endpoint } })).toBe(0);
  });

  it("moves a shared device to whoever subscribed last", async () => {
    const device = sub("shared");
    await savePushSubscription(ben, device);
    await savePushSubscription(cy, device);
    const row = await db.pushSubscription.findUniqueOrThrow({ where: { endpoint: device.endpoint } });
    expect(row.userId).toBe(cy.userId);
  });

  it("refuses an endpoint that is not an https URL", async () => {
    await expect(savePushSubscription(ben, { endpoint: "http://push.example/x", p256dh: "p", auth: "a" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(savePushSubscription(ben, { endpoint: "nonsense", p256dh: "p", auth: "a" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("reports whether push is configured", () => {
    expect(getPushConfig().configured).toBe(true);
    vi.spyOn(pushApi, "isConfigured").mockReturnValue(false);
    expect(getPushConfig().configured).toBe(false);
  });
});

describe("dispatchPendingPushes", () => {
  it("sends a notification to every device of its recipient, worded like the bell, linking to the task", async () => {
    const phone = sub("phone");
    const laptop = sub("laptop");
    await savePushSubscription(ben, phone);
    await savePushSubscription(ben, laptop);
    await savePushSubscription(cy, sub("cy")); // uninvolved
    const task = await assignToBen();

    await dispatchPendingPushes();

    expect(sent.map((x) => x.target.endpoint).sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    expect(sent[0].payload).toMatchObject({
      title: "ada",
      body: "assigned you to Write the brief",
      url: `/s/${spaceId}/p/${projectId}/l/${listId}?task=${task.id}`,
    });
    expect(sent[0].payload.tag).toBeTruthy();
  });

  it("never pushes to the person who did it, and sends nothing to people without a device", async () => {
    await savePushSubscription(ada, sub("ada"));
    await assignToBen(); // Ben has no device; Ada is the actor
    await dispatchPendingPushes();
    expect(sent).toEqual([]);
  });

  it("pushes each notification once, also when two requests finish together", async () => {
    await savePushSubscription(ben, sub("phone"));
    await assignToBen();
    await Promise.all([dispatchPendingPushes(), dispatchPendingPushes()]);
    await dispatchPendingPushes();
    expect(sent).toHaveLength(1);
  });

  it("leaves old notifications alone", async () => {
    await savePushSubscription(ben, sub("phone"));
    await assignToBen();
    await db.notification.updateMany({ where: { pushedAt: null }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    await dispatchPendingPushes();
    expect(sent).toEqual([]);
  });

  it("deletes a subscription the push service reports as gone and still serves the others", async () => {
    const dead = sub("dead");
    const live = sub("live");
    await savePushSubscription(ben, dead);
    await savePushSubscription(ben, live);
    outcome = (target) => (target.endpoint === dead.endpoint ? "gone" : "sent");
    await assignToBen();

    await dispatchPendingPushes();

    expect(await db.pushSubscription.count({ where: { endpoint: dead.endpoint } })).toBe(0);
    const kept = await db.pushSubscription.findUniqueOrThrow({ where: { endpoint: live.endpoint } });
    expect(kept.lastUsedAt).not.toBeNull();
  });

  it("swallows a failing push service: the notification stays in the bell and is not retried", async () => {
    await savePushSubscription(ben, sub("phone"));
    outcome = () => new Error("push service down");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await assignToBen();

    await expect(dispatchPendingPushes()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(await db.notification.count({ where: { userId: ben.userId, pushedAt: null } })).toBe(0);
    expect(await db.notification.count({ where: { userId: ben.userId } })).toBe(1);
    expect(await db.pushSubscription.count({ where: { userId: ben.userId } })).toBe(1);
  });

  it("covers the other notification types (a comment reaches assignee and creator, not the author)", async () => {
    await savePushSubscription(ada, sub("ada"));
    await savePushSubscription(ben, sub("ben"));
    const task = await assignToBen();
    await dispatchPendingPushes();
    sent = [];

    await addComment(ben, { taskId: task.id, body: doc("On it") });
    await dispatchPendingPushes();

    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ title: "ben", body: "commented on Write the brief" });
  });

  it("does nothing when push is not configured", async () => {
    await savePushSubscription(ben, sub("phone"));
    await assignToBen();
    vi.spyOn(pushApi, "isConfigured").mockReturnValue(false);
    await dispatchPendingPushes();
    expect(sent).toEqual([]);
    expect(await db.notification.count({ where: { userId: ben.userId, pushedAt: null } })).toBe(1);
  });
});
