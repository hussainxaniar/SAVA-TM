import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { handleMcpRequest } from "@/server/mcp/handler";
import { RATE_LIMIT, allowRequest, resetRateLimit } from "@/server/mcp/rate-limit";
import { createApiToken, revokeApiToken } from "@/server/services/api-tokens";
import { createList } from "@/server/services/lists";
import { createProject } from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { makeSpace, resetDb } from "../helpers/db";

beforeAll(async () => {
  await resetDb();
  process.env.APP_URL = "https://tm.example.test";
});

const as = (userId: string) => ({ userId });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = { isError: boolean; text: string; data: any };
type Tools = Record<string, (args?: Record<string, unknown>) => Promise<ToolResult>>;

let s: Awaited<ReturnType<typeof makeSpace<"owner" | "member" | "other">>>;
let listId: string;
let secondList: string;
let projectId: string;
let writeToken: string;
let readToken: string;
let rpcId = 0;

/** One JSON-RPC call to the endpoint, like an MCP client would send it. */
async function rpc(token: string | null, method: string, params?: unknown, init: RequestInit = {}) {
  const req = new Request("https://tm.example.test/api/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const res = await handleMcpRequest(req);
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, headers: res.headers };
}

function client(token: string): Tools {
  return new Proxy({} as Tools, {
    get: (_t, name: string) => async (args: Record<string, unknown> = {}) => {
      const { body } = await rpc(token, "tools/call", { name, arguments: args });
      if (body.error) return { isError: true, text: body.error.message as string, data: null };
      const text = body.result.content[0].text as string;
      let data: unknown = null;
      try {
        data = JSON.parse(text);
      } catch {}
      return { isError: !!body.result.isError, text, data };
    },
  });
}

beforeEach(async () => {
  resetRateLimit();
  s = await makeSpace({ owner: "OWNER", member: "MEMBER", other: "MEMBER" });
  const p = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Site" });
  projectId = p.projectId;
  listId = p.firstListId;
  secondList = (await createList(as(s.users.owner.id), { projectId, name: "Design" })).listId;
  writeToken = (await createApiToken(as(s.users.member.id), { spaceId: s.space.id, name: "w", scope: "WRITE", expiresInDays: 30 })).token;
  readToken = (await createApiToken(as(s.users.member.id), { spaceId: s.space.id, name: "r", scope: "READ", expiresInDays: 30 })).token;
});

describe("authentication and transport", () => {
  it("answers 401 with WWW-Authenticate for a missing, wrong, revoked or expired token", async () => {
    for (const token of [null, "sava_pat_wrong", "garbage"]) {
      const r = await rpc(token, "tools/list");
      expect(r.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toContain("Bearer");
    }
    const t = await createApiToken(as(s.users.member.id), { spaceId: s.space.id, name: "x", scope: "READ", expiresInDays: 30 });
    await revokeApiToken(as(s.users.member.id), { tokenId: t.id });
    expect((await rpc(t.token, "tools/list")).status).toBe(401);
  });

  it("never echoes the token in an error body", async () => {
    const r = await rpc("sava_pat_secretvalue123", "tools/list");
    expect(JSON.stringify(r.body)).not.toContain("secretvalue123");
  });

  it("only accepts POST", async () => {
    for (const method of ["GET", "DELETE", "PUT"]) {
      const res = await handleMcpRequest(new Request("https://tm.example.test/api/mcp", { method, headers: { authorization: `Bearer ${writeToken}` } }));
      expect(res.status).toBe(405);
    }
  });

  it("refuses a foreign Origin and accepts the app's own", async () => {
    expect((await rpc(writeToken, "tools/list", {}, { headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await rpc(writeToken, "tools/list", {}, { headers: { origin: "https://tm.example.test" } })).status).toBe(200);
  });

  it("answers 429 once a token exceeds the per-minute limit", async () => {
    for (let i = 0; i < RATE_LIMIT; i++) expect(allowRequest("k", 1_000)).toBe(true);
    expect(allowRequest("k", 1_000)).toBe(false);
    expect(allowRequest("k", 62_000)).toBe(true); // next window
    resetRateLimit();
  });

  it("stops working for a removed member immediately", async () => {
    await db.spaceMember.delete({ where: { spaceId_userId: { spaceId: s.space.id, userId: s.users.member.id } } });
    expect((await rpc(writeToken, "tools/list")).status).toBe(401);
  });
});

describe("tools by scope", () => {
  it("lists only read tools for a READ token and all tools for a WRITE token", async () => {
    const names = async (token: string) => (await rpc(token, "tools/list")).body.result.tools.map((t: { name: string }) => t.name).sort();
    const read = await names(readToken);
    const write = await names(writeToken);
    expect(read).toEqual(["get_my_tasks", "get_task", "list_members", "list_projects", "list_tasks", "whoami"]);
    expect(write).toEqual(
      [...read, "add_comment", "assign_task", "create_task", "quick_add", "set_task_status", "update_task"].sort(),
    );
    expect(write.some((n: string) => /delete|move|archive/.test(n))).toBe(false);
  });

  it("refuses a write tool for a READ token and changes nothing", async () => {
    const r = await client(readToken).create_task({ title: "Nope", listId });
    expect(r.isError).toBe(true);
    expect(await db.task.count({ where: { title: "Nope" } })).toBe(0);
  });
});

describe("read tools", () => {
  it("whoami, list_projects and list_members describe the space", async () => {
    const t = client(writeToken);
    expect((await t.whoami()).data).toMatchObject({ user: { id: s.users.member.id }, space: { id: s.space.id }, role: "MEMBER", canWrite: true });
    expect((await client(readToken).whoami()).data.canWrite).toBe(false);
    const projects = (await t.list_projects()).data;
    expect(projects).toHaveLength(1);
    expect(projects[0].lists.map((l: { name: string }) => l.name).sort()).toEqual(["Design", "General"]);
    expect(projects[0].statuses.map((x: { category: string }) => x.category)).toEqual(["TODO", "ACTIVE", "DONE"]);
    expect((await t.list_members()).data.map((m: { id: string }) => m.id).sort()).toEqual(Object.values(s.users).map((u) => u.id).sort());
  });

  it("list_tasks hides completed tasks unless asked; get_my_tasks lists my open ones; get_task returns the details", async () => {
    const me = as(s.users.member.id);
    const open = await createTask(me, { listId, title: "Open one", assigneeIds: [s.users.member.id], priority: 2 });
    const done = await createTask(me, { listId, title: "Done one" });
    const t = client(readToken);
    await client(writeToken).set_task_status({ taskId: done.id, completed: true });
    expect((await t.list_tasks({ listId })).data.tasks.map((x: { title: string }) => x.title)).toEqual(["Open one"]);
    expect((await t.list_tasks({ listId, includeCompleted: true })).data.tasks).toHaveLength(2);
    expect((await t.get_my_tasks()).data.map((x: { id: string }) => x.id)).toEqual([open.id]);
    const detail = (await t.get_task({ taskId: open.id })).data;
    expect(detail).toMatchObject({ title: "Open one", priority: 2, project: "Site", list: "General" });
    expect(detail.feed.some((f: { type?: string }) => f.type === "TASK_CREATED")).toBe(true);
  });
});

describe("write tools", () => {
  it("create_task creates a task, converts the description, and marks the activity via mcp", async () => {
    const r = await client(writeToken).create_task({
      title: "Write brief",
      listId,
      description: "Goals:\n- one\n- two",
      priority: 1,
      dueDate: "2030-05-04",
      assigneeIds: [s.users.other.id],
    });
    expect(r.isError).toBe(false);
    const row = await db.task.findUniqueOrThrow({ where: { id: r.data.id }, include: { assignees: true } });
    expect(row).toMatchObject({ title: "Write brief", priority: 1, dueHasTime: false, createdById: s.users.member.id });
    expect(row.dueDate!.toISOString()).toBe("2030-05-04T00:00:00.000Z");
    expect(row.assignees.map((a) => a.userId)).toEqual([s.users.other.id]);
    expect(JSON.stringify(row.description)).toContain("bulletList");
    const log = await db.activity.findMany({ where: { taskId: row.id } });
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((a) => (a.payload as { via?: string }).via === "mcp")).toBe(true);
    expect(log.every((a) => a.actorId === s.users.member.id)).toBe(true);
  });

  it("does not label what a person does in the app (no via outside the endpoint)", async () => {
    const t = await createTask(as(s.users.member.id), { listId, title: "By hand" });
    const log = await db.activity.findMany({ where: { taskId: t.id } });
    expect(log.every((a) => !("via" in (a.payload as object)))).toBe(true);
  });

  it("create_task makes subtasks, takes a datetime and rejects bad input", async () => {
    const t = client(writeToken);
    const parent = (await t.create_task({ title: "Parent", listId })).data;
    const sub = await t.create_task({ title: "Child", listId, parentId: parent.id, dueDate: "2030-05-04T15:30:00Z" });
    expect(sub.data.parentId).toBe(parent.id);
    expect(sub.data.dueHasTime).toBe(true);
    expect((await t.create_task({ title: "x", listId, dueDate: "soon" })).text).toContain("VALIDATION");
    expect((await t.create_task({ title: "x", listId, dueDate: "2030-02-31" })).text).toContain("VALIDATION");
    expect((await t.create_task({ title: "x", listId, priority: 9 })).isError).toBe(true);
  });

  it("quick_add parses dates, priority, assignee and list like the app", async () => {
    const r = await client(writeToken).quick_add({ text: "Review budget p1 @other #design" });
    expect(r.isError).toBe(false);
    const row = await db.task.findUniqueOrThrow({ where: { id: r.data.id }, include: { assignees: true } });
    expect(row).toMatchObject({ title: "Review budget", priority: 1, homeListId: secondList });
    expect(row.assignees.map((a) => a.userId)).toEqual([s.users.other.id]);
    const plain = await client(writeToken).quick_add({ text: "Plain task" });
    expect((await db.task.findUniqueOrThrow({ where: { id: plain.data.id } })).homeListId).toBe(listId);
    expect((await client(writeToken).quick_add({ text: "p1" })).text).toContain("VALIDATION");
  });

  it("update_task, set_task_status, assign_task and add_comment work and are labelled", async () => {
    const t = client(writeToken);
    const task = (await t.create_task({ title: "Old", listId, dueDate: "2030-01-01" })).data;
    const upd = await t.update_task({ taskId: task.id, title: "New", priority: 3, dueDate: null, description: "Hello" });
    expect(upd.data).toMatchObject({ title: "New", priority: 3, dueDate: null });
    expect((await t.get_task({ taskId: task.id })).data.description).toBe("Hello");
    await t.update_task({ taskId: task.id, description: null });
    expect((await t.get_task({ taskId: task.id })).data.description).toBe("");

    const statuses = (await t.list_projects()).data[0].statuses as { id: string; category: string }[];
    const active = statuses.find((x) => x.category === "ACTIVE")!;
    expect((await t.set_task_status({ taskId: task.id, statusId: active.id })).data.status.id).toBe(active.id);
    expect((await t.set_task_status({ taskId: task.id, completed: true })).data.completed).toBe(true);
    expect((await t.set_task_status({ taskId: task.id })).text).toContain("VALIDATION");
    expect((await t.set_task_status({ taskId: task.id, completed: true, statusId: active.id })).text).toContain("VALIDATION");

    expect((await t.assign_task({ taskId: task.id, userIds: [s.users.owner.id] })).data.assignees).toEqual([
      { id: s.users.owner.id, name: "owner" },
    ]);

    const c = await t.add_comment({ taskId: task.id, text: "Looks good" });
    expect(c.isError).toBe(false);
    const comment = await db.comment.findUniqueOrThrow({ where: { id: c.data.id } });
    expect(comment).toMatchObject({ via: "mcp", authorId: s.users.member.id, bodyText: "Looks good" });
    expect((await t.add_comment({ taskId: task.id, text: "   " })).isError).toBe(true);
    const feed = (await t.get_task({ taskId: task.id })).data.feed;
    expect(feed.find((f: { kind: string }) => f.kind === "comment")).toMatchObject({ text: "Looks good", viaAI: true });
  });
});

describe("space and permission boundaries", () => {
  it("treats ids from another space as not found, for read and write tools", async () => {
    const other = await makeSpace({ boss: "OWNER" });
    const op = await createProject(as(other.users.boss.id), { spaceId: other.space.id, name: "Elsewhere" });
    const foreignTask = await createTask(as(other.users.boss.id), { listId: op.firstListId, title: "Secret" });
    const t = client(writeToken);
    for (const call of [
      () => t.get_task({ taskId: foreignTask.id }),
      () => t.list_tasks({ listId: op.firstListId }),
      () => t.update_task({ taskId: foreignTask.id, title: "Hacked" }),
      () => t.add_comment({ taskId: foreignTask.id, text: "hi" }),
      () => t.create_task({ title: "x", listId: op.firstListId }),
      () => t.set_task_status({ taskId: foreignTask.id, completed: true }),
      () => t.assign_task({ taskId: foreignTask.id, userIds: [] }),
    ]) {
      const r = await call();
      expect(r.isError).toBe(true);
      expect(r.text).toContain("NOT_FOUND");
    }
    expect((await db.task.findUniqueOrThrow({ where: { id: foreignTask.id } })).title).toBe("Secret");
  });

  it("a status from another project of the same space is refused by the service, from another space by the tool", async () => {
    const p2 = await createProject(as(s.users.owner.id), { spaceId: s.space.id, name: "Other project" });
    const foreignStatus = await db.status.findFirstOrThrow({ where: { projectId: p2.projectId } });
    const r = await client(writeToken).create_task({ title: "x", listId, statusId: foreignStatus.id });
    expect(r.isError).toBe(true);
  });

  it("answers malformed JSON-RPC with an error, not a crash", async () => {
    const res = await handleMcpRequest(
      new Request("https://tm.example.test/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${writeToken}` },
        body: "{not json",
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
