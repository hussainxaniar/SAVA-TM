// Dev seed (blueprint T-02): 2 users, 1 space, 2 projects with default statuses,
// 3 lists, 15 tasks incl. 2 levels of subtasks, 1 linked subtask, 1 doc with 3 pages.
// Idempotent: removes only data owned by the seed users before recreating it.
// Seed users sign in with SEED_PASSWORD.

import { PrismaClient, type ActivityType, type Prisma, type StatusCategory } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { positionAfter } from "../src/lib/position";
import { DEFAULT_STATUSES } from "../src/server/defaults";

const db = new PrismaClient();

const SEED_PASSWORD = "password123";
const SEED_USERS = [
  { name: "Ada Owner", email: "ada@sava.test" },
  { name: "Ben Member", email: "ben@sava.test" },
];

const DAY = 24 * 60 * 60 * 1000;
const today = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
const inDays = (n: number) => new Date(today.getTime() + n * DAY);

const doc = (text: string): Prisma.InputJsonValue => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function reset() {
  const users = await db.user.findMany({
    where: { email: { in: SEED_USERS.map((u) => u.email) } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;
  const spaces = await db.space.findMany({ where: { createdById: { in: userIds } }, select: { id: true } });
  const spaceIds = spaces.map((s) => s.id);
  // Tasks first: Task → List/Status are RESTRICT, and Comment/Activity → User are RESTRICT.
  await db.task.deleteMany({ where: { spaceId: { in: spaceIds } } });
  await db.space.deleteMany({ where: { id: { in: spaceIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createUser(name: string, email: string) {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name,
      email,
      emailVerified: false,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(SEED_PASSWORD),
        },
      },
    },
  });
}

async function createProject(spaceId: string, name: string, color: string, position: string, listNames: string[]) {
  let statusPos: string | null = null;
  let listPos: string | null = null;
  return db.project.create({
    data: {
      spaceId,
      name,
      color,
      position,
      statuses: {
        create: DEFAULT_STATUSES.map((s) => ({ ...s, position: (statusPos = positionAfter(statusPos)) })),
      },
      lists: {
        create: listNames.map((n) => ({ name: n, position: (listPos = positionAfter(listPos)) })),
      },
    },
    include: { statuses: true, lists: true },
  });
}

type ProjectWithChildren = Awaited<ReturnType<typeof createProject>>;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

  await reset();

  const [ada, ben] = [
    await createUser(SEED_USERS[0].name, SEED_USERS[0].email),
    await createUser(SEED_USERS[1].name, SEED_USERS[1].email),
  ];

  const space = await db.space.create({
    data: {
      name: "Sava Team",
      createdById: ada.id,
      members: {
        create: [
          { userId: ada.id, role: "OWNER" },
          { userId: ben.id, role: "MEMBER" },
        ],
      },
    },
  });

  const web = await createProject(space.id, "Website relaunch", "#2563EB", positionAfter(null), ["Backlog", "Design"]);
  const ops = await createProject(space.id, "Operations", "#16A34A", positionAfter(positionAfter(null)), ["General"]);

  const listByName = (p: ProjectWithChildren, name: string) => p.lists.find((l) => l.name === name)!;
  const statusOf = (p: ProjectWithChildren, c: StatusCategory) => p.statuses.find((s) => s.category === c)!;

  // Last sibling position per (homeListId, parentId), so each insert lands at the end.
  const lastPos = new Map<string, string>();

  async function log(taskId: string, actorId: string, type: ActivityType, payload: Prisma.InputJsonValue = {}) {
    await db.activity.create({ data: { spaceId: space.id, taskId, actorId, type, payload } });
  }

  async function task(input: {
    project: ProjectWithChildren;
    list?: string;
    parent?: { id: string; homeListId: string; depth: number };
    title: string;
    category?: StatusCategory;
    priority?: number;
    startDate?: Date;
    dueDate?: Date;
    dueHasTime?: boolean;
    description?: string;
    assignees?: { id: string }[];
    by?: { id: string };
  }) {
    const by = input.by ?? ada;
    const homeListId = input.parent?.homeListId ?? listByName(input.project, input.list!).id;
    const key = `${homeListId}:${input.parent?.id ?? ""}`;
    const position = positionAfter(lastPos.get(key));
    lastPos.set(key, position);
    const category = input.category ?? "TODO";

    const t = await db.task.create({
      data: {
        spaceId: space.id,
        projectId: input.project.id,
        homeListId,
        parentId: input.parent?.id,
        depth: input.parent ? input.parent.depth + 1 : 0,
        title: input.title,
        description: input.description ? doc(input.description) : undefined,
        statusId: statusOf(input.project, category).id,
        priority: input.priority ?? 4,
        startDate: input.startDate,
        dueDate: input.dueDate,
        dueHasTime: input.dueHasTime ?? false,
        position,
        completedAt: category === "DONE" ? new Date() : null,
        createdById: by.id,
        assignees: { create: (input.assignees ?? []).map((u) => ({ userId: u.id })) },
      },
    });

    await log(t.id, by.id, "TASK_CREATED");
    if (input.parent) await log(input.parent.id, by.id, "SUBTASK_ADDED", { subtaskId: t.id });
    for (const u of input.assignees ?? []) await log(t.id, by.id, "ASSIGNEE_ADDED", { userId: u.id });
    if (category === "DONE") await log(t.id, by.id, "TASK_COMPLETED");
    return t;
  }

  // ---- Website relaunch / Backlog ----
  const brief = await task({
    project: web,
    list: "Backlog",
    title: "Write launch brief",
    priority: 1,
    dueDate: inDays(1),
    description: "One page: goals, audience, launch date, owners.",
    assignees: [ada],
  });
  const input = await task({ project: web, parent: brief, title: "Collect stakeholder input", priority: 2, assignees: [ben] });
  await task({ project: web, parent: input, title: "Email marketing team", assignees: [ben] });
  await task({ project: web, parent: input, title: "Schedule sales sync", dueDate: inDays(2) });
  await task({ project: web, parent: brief, title: "Draft outline", category: "DONE" });
  await task({
    project: web,
    list: "Backlog",
    title: "Audit current site content",
    category: "ACTIVE",
    priority: 3,
    startDate: inDays(-3),
    dueDate: inDays(4),
    assignees: [ben],
    by: ben,
  });
  await task({ project: web, list: "Backlog", title: "Set up analytics", priority: 2, dueDate: inDays(-2), assignees: [ada] });
  await task({ project: web, list: "Backlog", title: "Fix footer links", category: "DONE", priority: 3, by: ben });

  // ---- Website relaunch / Design ----
  const wireframes = await task({
    project: web,
    list: "Design",
    title: "Homepage wireframes",
    priority: 2,
    dueDate: inDays(3),
    assignees: [ben, ada],
  });
  await task({ project: web, parent: wireframes, title: "Hero section variants", assignees: [ben] });
  await task({ project: web, parent: wireframes, title: "Mobile layout" });
  await task({ project: web, list: "Design", title: "Pick typography", priority: 4 });

  // Linked subtask: "Collect stakeholder input" (home: Backlog) also appears in Design.
  const design = listByName(web, "Design");
  const linkPos = positionAfter(lastPos.get(`${design.id}:`));
  lastPos.set(`${design.id}:`, linkPos);
  await db.taskListLink.create({ data: { taskId: input.id, listId: design.id, position: linkPos, addedById: ada.id } });
  await log(input.id, ada.id, "ADDED_TO_LIST", { listId: design.id });

  // ---- Operations / General ----
  await task({ project: ops, list: "General", title: "Renew domain", priority: 1, dueDate: inDays(5), assignees: [ada] });
  await task({ project: ops, list: "General", title: "Order office supplies", by: ben, assignees: [ben] });
  await task({
    project: ops,
    list: "General",
    title: "Quarterly budget review",
    priority: 2,
    dueDate: new Date(inDays(7).getTime() + 14 * 60 * 60 * 1000),
    dueHasTime: true,
    assignees: [ada, ben],
  });

  // One comment, so the feed has both kinds of item.
  const comment = await db.comment.create({
    data: {
      taskId: brief.id,
      authorId: ben.id,
      body: doc("I can take the audience section."),
      bodyText: "I can take the audience section.",
    },
  });
  await log(brief.id, ben.id, "COMMENT_ADDED", { commentId: comment.id });

  // ---- Doc with 3 pages (one nested) ----
  const handbook = await db.doc.create({
    data: {
      spaceId: space.id,
      projectId: web.id,
      title: "Team handbook",
      position: positionAfter(null),
      createdById: ada.id,
    },
  });
  const welcomePos = positionAfter(null);
  await db.docPage.create({
    data: {
      docId: handbook.id,
      title: "Welcome",
      content: doc("Start here."),
      position: welcomePos,
      createdById: ada.id,
      updatedById: ada.id,
    },
  });
  const onboarding = await db.docPage.create({
    data: {
      docId: handbook.id,
      title: "Onboarding",
      content: doc("How we get new people productive."),
      position: positionAfter(welcomePos),
      createdById: ada.id,
      updatedById: ada.id,
    },
  });
  await db.docPage.create({
    data: {
      docId: handbook.id,
      parentId: onboarding.id,
      title: "First week",
      content: doc("Accounts, intros, first task."),
      position: positionAfter(null),
      createdById: ben.id,
      updatedById: ben.id,
    },
  });

  const [tasks, lists, pages] = await Promise.all([
    db.task.count({ where: { spaceId: space.id } }),
    db.list.count({ where: { project: { spaceId: space.id } } }),
    db.docPage.count({ where: { docId: handbook.id } }),
  ]);
  console.log(
    `Seeded space "${space.name}": 2 users, 2 projects, ${lists} lists, ${tasks} tasks, 1 doc with ${pages} pages.`,
  );
  console.log(`Sign in as ${SEED_USERS.map((u) => u.email).join(" or ")} with password "${SEED_PASSWORD}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
