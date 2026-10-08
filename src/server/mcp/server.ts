import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiTokenScope } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { AppError } from "../errors";
import { spaceIdOfList, spaceIdOfStatus, spaceIdOfTask } from "../guards";
import { addComment, getFeed } from "../services/comments";
import { getProjectSettings, getSidebar } from "../services/projects";
import { listMembers } from "../services/spaces";
import {
  createTask,
  getListView,
  getMyTasks,
  getTask,
  setAssignees,
  setCompleted,
  updateTask,
} from "../services/tasks";
import type { Ctx, TaskRowDTO } from "../services/types";
import { docToPlain, plainToDoc } from "@/lib/plain-to-doc";
import { parseQuickAdd } from "@/lib/quick-add-parser";

/*
 * Section 15.4. The tools of the MCP endpoint, for ONE request: built from the resolved token
 * ({ user, space, scope }), so a tool can't be called outside its scope (it isn't registered)
 * and can't reach another space (every id is checked against the token's space first; a
 * foreign id answers NOT_FOUND like a missing one). Everything else goes through the same
 * services as the web app, so guards, validation and activity logging apply unchanged.
 */

export type McpAuth = { userId: string; spaceId: string; scope: ApiTokenScope };

const INSTRUCTIONS =
  "Sava TM is a team task manager. Call whoami first, then list_projects to learn the list and status ids. " +
  "Tasks live in lists inside projects; every id you pass comes from these tools. Dates are ISO: " +
  "'2026-10-12' for a day, '2026-10-12T15:00:00Z' for a moment. Changes you make are shown in the app as made by the " +
  "token's owner, labelled 'via AI'.";

const priority = z.number().int().min(1).max(4).describe("1 = urgent, 2 = high, 3 = medium, 4 = none");
const dateText = z.string().describe("ISO date '2026-10-12' (a day) or datetime '2026-10-12T15:00:00Z' (a moment)");

const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (text: string) => ({ isError: true as const, content: [{ type: "text" as const, text }] });

async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof AppError) return fail(`${e.code}: ${e.message}`);
    console.error("mcp tool failed", e instanceof Error ? e.message : e);
    return fail("INTERNAL: Something went wrong. Try again.");
  }
}

const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);

/** A due/start date input as the services take it: date-only = UTC midnight of that day, no time. */
function toDate(value: string, label: string): { iso: string; hasTime: boolean } {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new AppError("VALIDATION", `${label} isn't a valid date`);
    return { iso: d.toISOString(), hasTime: false };
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new AppError("VALIDATION", `${label} isn't a valid date`);
  return { iso: d.toISOString(), hasTime: true };
}

const compactTask = (t: TaskRowDTO) => ({
  id: t.id,
  title: t.title,
  status: { id: t.status.id, name: t.status.name, category: t.status.category },
  completed: t.completedAt !== null,
  priority: t.priority,
  startDate: t.startDate,
  dueDate: t.dueDate,
  dueHasTime: t.dueHasTime,
  assignees: t.assignees.map((u) => ({ id: u.id, name: u.name })),
  parentId: t.parentId,
  subtasks: { total: t.subtaskCount, open: t.openSubtaskCount },
  comments: t.commentCount,
});

export function buildMcpServer(auth: McpAuth): McpServer {
  const ctx: Ctx = { userId: auth.userId };
  const { spaceId } = auth;
  const server = new McpServer({ name: "sava-tm", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  // The token's space is the only space there is: an id from elsewhere is "not found".
  const inSpace = async (resolve: Promise<string>, what: string) => {
    let found: string;
    try {
      found = await resolve;
    } catch {
      throw notFound(what);
    }
    if (found !== spaceId) throw notFound(what);
  };
  const taskOk = (taskId: string) => inSpace(spaceIdOfTask(taskId), "Task");
  const listOk = (listId: string) => inSpace(spaceIdOfList(listId), "List");

  function tool<S extends z.ZodRawShape>(
    name: string,
    description: string,
    needs: ApiTokenScope,
    shape: S,
    handler: (args: z.objectOutputType<S, z.ZodTypeAny>) => Promise<unknown>,
  ) {
    if (needs === "WRITE" && auth.scope !== "WRITE") return;
    server.registerTool(
      name,
      { description, inputSchema: shape, annotations: { readOnlyHint: needs === "READ", destructiveHint: false, openWorldHint: false } },
      (async (args: unknown) => run(() => handler(args as z.objectOutputType<S, z.ZodTypeAny>))) as never,
    );
  }

  // ---------- read ----------

  tool("whoami", "Who you are acting as, in which space, and whether this connection can write.", "READ", {}, async () => {
    const [user, space, member] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { id: true, name: true } }),
      db.space.findUniqueOrThrow({ where: { id: spaceId }, select: { id: true, name: true } }),
      db.spaceMember.findUniqueOrThrow({ where: { spaceId_userId: { spaceId, userId: ctx.userId } }, select: { role: true } }),
    ]);
    return { user, space, role: member.role, canWrite: auth.scope === "WRITE" };
  });

  tool("list_projects", "Projects in the space, each with its lists (id, name, open task count) and statuses (id, name, category).", "READ", {}, async () => {
    const { projects } = await getSidebar(ctx, { spaceId });
    return Promise.all(
      projects.map(async (p) => {
        const settings = await getProjectSettings(ctx, { projectId: p.id });
        return {
          id: p.id,
          name: p.name,
          lists: p.lists.map((l) => ({ id: l.id, name: l.name, openTasks: l.openTaskCount })),
          statuses: settings.statuses.map((s) => ({ id: s.id, name: s.name, category: s.category })),
        };
      }),
    );
  });

  tool("list_members", "Members of the space, for assigning tasks.", "READ", {}, async () =>
    (await listMembers(ctx, { spaceId })).map((m) => ({ id: m.id, name: m.name, role: m.role })),
  );

  tool(
    "list_tasks",
    "Tasks of one list, including subtasks (parentId is set for them).",
    "READ",
    { listId: z.string(), includeCompleted: z.boolean().optional().describe("Default false") },
    async ({ listId, includeCompleted }) => {
      await listOk(listId);
      const view = await getListView(ctx, { listId });
      const tasks = includeCompleted ? view.tasks : view.tasks.filter((t) => t.completedAt === null);
      return { list: { id: view.list.id, name: view.list.name }, tasks: tasks.map(compactTask) };
    },
  );

  tool("get_my_tasks", "Your open tasks across the space, with where each lives.", "READ", {}, async () => {
    const { tasks } = await getMyTasks(ctx, { spaceId });
    return tasks.map((t) => ({ ...compactTask(t), project: t.projectName, list: t.listName }));
  });

  tool("get_task", "One task in full: description, subtasks, lists and the latest comments and activity.", "READ", { taskId: z.string() }, async ({ taskId }) => {
    await taskOk(taskId);
    const [task, feed] = await Promise.all([getTask(ctx, { taskId }), getFeed(ctx, { taskId })]);
    return {
      ...compactTask(task),
      description: docToPlain(task.description),
      project: task.project.name,
      list: task.homeList.name,
      linkedLists: task.linkedLists.map((l) => l.name),
      breadcrumb: task.breadcrumb,
      subtaskList: task.subtasks.map(compactTask),
      createdBy: task.createdBy.name,
      createdAt: task.createdAt,
      feed: feed.slice(-20).map((item) =>
        item.kind === "comment"
          ? { kind: "comment", id: item.id, author: item.author.name, text: item.deleted ? "(deleted)" : docToPlain(item.body), at: item.createdAt, viaAI: item.via !== null }
          : { kind: "activity", type: item.type, by: item.actor.name, at: item.createdAt, details: item.payload },
      ),
    };
  });

  // ---------- write ----------

  tool(
    "create_task",
    "Creates a task in a list, or a subtask when parentId is given (it then lives in the parent's list).",
    "WRITE",
    {
      title: z.string().min(1),
      listId: z.string().describe("From list_projects"),
      parentId: z.string().optional().describe("Makes this a subtask of that task"),
      statusId: z.string().optional().describe("Default: the project's first To do status"),
      description: z.string().optional().describe("Plain text; blank lines separate paragraphs, lines starting '- ' are bullets"),
      priority: priority.optional(),
      startDate: dateText.optional(),
      dueDate: dateText.optional(),
      assigneeIds: z.array(z.string()).optional().describe("User ids from list_members"),
    },
    async (a) => {
      await listOk(a.listId);
      if (a.parentId) await taskOk(a.parentId);
      if (a.statusId) await inSpace(spaceIdOfStatus(a.statusId), "Status");
      const due = a.dueDate ? toDate(a.dueDate, "Due date") : null;
      const start = a.startDate ? toDate(a.startDate, "Start date") : null;
      const row = await createTask(ctx, {
        listId: a.listId,
        title: a.title,
        parentId: a.parentId ?? null,
        statusId: a.statusId ?? null,
        description: a.description ? plainToDoc(a.description) : null,
        priority: a.priority,
        startDate: start?.iso ?? null,
        dueDate: due?.iso ?? null,
        dueHasTime: due?.hasTime ?? false,
        assigneeIds: a.assigneeIds,
      });
      return compactTask(row);
    },
  );

  tool(
    "quick_add",
    "Creates a task from one line, like the app's quick add: 'Write brief tomorrow p1 @ada #design' sets the due date, priority P1, " +
      "assignee and list. Without listId (and no #list token) it goes to the first list of the first project.",
    "WRITE",
    { text: z.string().min(1), listId: z.string().optional() },
    async ({ text, listId }) => {
      let baseListId = listId;
      if (baseListId) await listOk(baseListId);
      const { projects } = await getSidebar(ctx, { spaceId });
      const project = baseListId ? projects.find((p) => p.lists.some((l) => l.id === baseListId)) : projects.find((p) => p.lists.length > 0);
      if (!project) throw new AppError("NOT_FOUND", "There is no list to add the task to");
      baseListId ??= project.lists[0].id;
      const members = (await listMembers(ctx, { spaceId })).map((m) => ({ id: m.id, name: m.name }));
      const parsed = parseQuickAdd(text, { members, lists: project.lists.map((l) => ({ id: l.id, name: l.name })) });
      if (!parsed.title) throw new AppError("VALIDATION", "Add a task name besides the dates and tags");
      const row = await createTask(ctx, {
        listId: parsed.listId ?? baseListId,
        title: parsed.title,
        priority: parsed.priority ?? undefined,
        dueDate: parsed.dueDate,
        dueHasTime: parsed.dueHasTime,
        assigneeIds: parsed.assigneeIds,
      });
      return compactTask(row);
    },
  );

  tool(
    "update_task",
    "Edits fields of a task. Only the fields you pass change; pass null to clear a description or a date.",
    "WRITE",
    {
      taskId: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      priority: priority.optional(),
      startDate: dateText.nullable().optional(),
      dueDate: dateText.nullable().optional(),
    },
    async (a) => {
      await taskOk(a.taskId);
      const due = a.dueDate ? toDate(a.dueDate, "Due date") : null;
      const start = a.startDate ? toDate(a.startDate, "Start date") : null;
      const row = await updateTask(ctx, {
        taskId: a.taskId,
        title: a.title,
        description: a.description === undefined ? undefined : a.description === null || a.description.trim() === "" ? null : plainToDoc(a.description),
        priority: a.priority,
        startDate: a.startDate === undefined ? undefined : (start?.iso ?? null),
        dueDate: a.dueDate === undefined ? undefined : (due?.iso ?? null),
        dueHasTime: a.dueDate === undefined ? undefined : (due?.hasTime ?? false),
      });
      return compactTask(row);
    },
  );

  tool(
    "set_task_status",
    "Moves a task to a status (statusId from list_projects), or completes / reopens it (completed: true | false). Pass exactly one of them.",
    "WRITE",
    { taskId: z.string(), statusId: z.string().optional(), completed: z.boolean().optional() },
    async ({ taskId, statusId, completed }) => {
      if ((statusId === undefined) === (completed === undefined)) {
        throw new AppError("VALIDATION", "Pass either statusId or completed");
      }
      await taskOk(taskId);
      if (statusId !== undefined) {
        await inSpace(spaceIdOfStatus(statusId), "Status");
        return compactTask(await updateTask(ctx, { taskId, statusId }));
      }
      await setCompleted(ctx, { taskId, completed: completed! });
      return compactTask((await getTask(ctx, { taskId })));
    },
  );

  tool(
    "assign_task",
    "Replaces the assignees of a task (user ids from list_members; an empty list unassigns everyone).",
    "WRITE",
    { taskId: z.string(), userIds: z.array(z.string()) },
    async ({ taskId, userIds }) => {
      await taskOk(taskId);
      await setAssignees(ctx, { taskId, userIds });
      return compactTask(await getTask(ctx, { taskId }));
    },
  );

  tool("add_comment", "Adds a comment to a task (plain text).", "WRITE", { taskId: z.string(), text: z.string().min(1) }, async ({ taskId, text }) => {
    await taskOk(taskId);
    const item = await addComment(ctx, { taskId, body: plainToDoc(text) });
    return { id: item.id, createdAt: item.createdAt };
  });

  return server;
}
