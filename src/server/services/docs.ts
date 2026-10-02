import type { Prisma } from "@prisma/client";
import { positionAfter } from "@/lib/position";
import { db } from "../db";
import { AppError } from "../errors";
import { requireMember, spaceIdOfDoc, spaceIdOfDocPage, spaceIdOfProject } from "../guards";
import { positionForMove, type MoveTarget } from "./ordering";
import type { Ctx, DocPageDTO, DocViewDTO, PageTreeNodeDTO, SavePageResult, UserLite } from "./types";
import { cleanName } from "./util";

/*
 * Section 8.7 / 11. A project holds docs; a doc is a tree of pages, three levels deep at most
 * (depth 0, 1, 2). Every member can create, edit, move, delete and archive. Pages save with
 * last-write-wins plus a conflict check on `updatedAt` (11.2).
 */

const MAX_PAGE_DEPTH = 2;
const TITLE_MAX = 200;
const CONTENT_MAX_BYTES = 500_000;
const EMPTY_DOC = { type: "doc", content: [] } as const;

async function userById(id: string): Promise<UserLite> {
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, image: true } });
  return user ?? { id, name: "Deleted user", image: null };
}

// ---------- Docs ----------

/** A new doc at the end of the project's docs, with one empty page; returns where to open it. */
export async function createDoc(
  ctx: Ctx,
  input: { projectId: string; title?: string },
): Promise<{ docId: string; firstPageId: string }> {
  const spaceId = await spaceIdOfProject(input.projectId);
  await requireMember(ctx.userId, spaceId);
  const title = cleanName(input.title ?? "Untitled doc", "Doc title", TITLE_MAX);
  return db.$transaction(async (tx) => {
    const last = await tx.doc.findFirst({
      where: { projectId: input.projectId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const doc = await tx.doc.create({
      data: { spaceId, projectId: input.projectId, title, position: positionAfter(last?.position), createdById: ctx.userId },
      select: { id: true },
    });
    const page = await tx.docPage.create({
      data: { docId: doc.id, content: EMPTY_DOC, position: positionAfter(null), createdById: ctx.userId, updatedById: ctx.userId },
      select: { id: true },
    });
    return { docId: doc.id, firstPageId: page.id };
  });
}

export async function renameDoc(ctx: Ctx, input: { docId: string; title: string }): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfDoc(input.docId));
  await db.doc.update({ where: { id: input.docId }, data: { title: cleanName(input.title, "Doc title", TITLE_MAX) } });
}

/** Among the project's active docs; see MoveTarget for beforeId/afterId. */
export async function reorderDoc(ctx: Ctx, input: { docId: string } & MoveTarget): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfDoc(input.docId));
  await db.$transaction(async (tx) => {
    const { projectId } = await tx.doc.findUniqueOrThrow({ where: { id: input.docId }, select: { projectId: true } });
    const siblings = await tx.doc.findMany({ where: { projectId, archivedAt: null }, select: { id: true, position: true } });
    await tx.doc.update({ where: { id: input.docId }, data: { position: positionForMove(siblings, input.docId, input) } });
  });
}

/** Everyone may archive; archived docs leave the sidebar (and their pages stay in the database). */
export async function archiveDoc(ctx: Ctx, input: { docId: string }): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfDoc(input.docId));
  await db.doc.update({ where: { id: input.docId }, data: { archivedAt: new Date() } });
}

// ---------- Pages: reads ----------

export async function getPageTree(ctx: Ctx, input: { docId: string }): Promise<PageTreeNodeDTO[]> {
  await requireMember(ctx.userId, await spaceIdOfDoc(input.docId));
  return treeOf(input.docId);
}

async function treeOf(docId: string, client: Pick<typeof db, "docPage"> = db): Promise<PageTreeNodeDTO[]> {
  const pages = await client.docPage.findMany({
    where: { docId },
    select: { id: true, title: true, parentId: true, position: true },
  });
  return pages;
}

export async function getPage(ctx: Ctx, input: { pageId: string }): Promise<DocPageDTO> {
  await requireMember(ctx.userId, await spaceIdOfDocPage(input.pageId));
  const page = await db.docPage.findUnique({
    where: { id: input.pageId },
    select: { id: true, docId: true, title: true, content: true, updatedAt: true, updatedById: true },
  });
  if (!page) throw notFound("Page");
  const { updatedById, ...rest } = page;
  return { ...rest, updatedAt: page.updatedAt.toISOString(), updatedBy: await userById(updatedById) };
}

/** The doc view's first paint: the doc, its page tree and one page. The page must belong to the doc. */
export async function getDocView(ctx: Ctx, input: { docId: string; pageId: string }): Promise<DocViewDTO> {
  const spaceId = await spaceIdOfDoc(input.docId);
  await requireMember(ctx.userId, spaceId);
  const doc = await db.doc.findUniqueOrThrow({
    where: { id: input.docId },
    select: { id: true, title: true, projectId: true, spaceId: true, archivedAt: true, project: { select: { name: true, color: true } } },
  });
  if (doc.archivedAt) throw notFound("Doc");
  const page = await getPage(ctx, { pageId: input.pageId });
  if (page.docId !== doc.id) throw notFound("Page");
  return {
    doc: { id: doc.id, title: doc.title, projectId: doc.projectId, spaceId: doc.spaceId, projectName: doc.project.name, projectColor: doc.project.color },
    tree: await treeOf(doc.id),
    page,
  };
}

// ---------- Pages: writes ----------

/** A new page (child of `parentId`, else top level) at the end of its siblings. Depth ≤ 3 levels. */
export async function createPage(
  ctx: Ctx,
  input: { docId: string; parentId?: string | null; title?: string },
): Promise<{ pageId: string }> {
  await requireMember(ctx.userId, await spaceIdOfDoc(input.docId));
  const title = cleanName(input.title ?? "Untitled", "Page title", TITLE_MAX);
  return db.$transaction(async (tx) => {
    if (input.parentId) {
      const parent = await tx.docPage.findFirst({ where: { id: input.parentId, docId: input.docId }, select: { id: true } });
      if (!parent) throw notFound("Page");
      if ((await depthOf(tx, parent.id)) + 1 > MAX_PAGE_DEPTH) {
        throw new AppError("VALIDATION", "Pages can only go three levels deep");
      }
    }
    const last = await tx.docPage.findFirst({
      where: { docId: input.docId, parentId: input.parentId ?? null },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const page = await tx.docPage.create({
      data: {
        docId: input.docId,
        parentId: input.parentId ?? null,
        title,
        content: EMPTY_DOC,
        position: positionAfter(last?.position),
        createdById: ctx.userId,
        updatedById: ctx.userId,
      },
      select: { id: true },
    });
    return { pageId: page.id };
  });
}

/**
 * Saves a page's title and/or content (11.2). `baseUpdatedAt` is the version the client last
 * loaded or saved: if someone else saved since, nothing is written and the result says who, with
 * the server's current version (Overwrite resends with it). The check and the write are one
 * conditional update, so two saves can't both pass.
 */
export async function savePage(
  ctx: Ctx,
  input: { pageId: string; title?: string; content?: unknown; baseUpdatedAt: string },
): Promise<SavePageResult> {
  await requireMember(ctx.userId, await spaceIdOfDocPage(input.pageId));
  const base = new Date(input.baseUpdatedAt);
  if (Number.isNaN(base.getTime())) throw new AppError("VALIDATION", "Missing page version");
  const data: Prisma.DocPageUncheckedUpdateManyInput = { updatedById: ctx.userId };
  if (input.title !== undefined) data.title = cleanName(input.title, "Page title", TITLE_MAX);
  if (input.content !== undefined) data.content = checkContent(input.content);

  const written = await db.docPage.updateMany({ where: { id: input.pageId, updatedAt: base }, data });
  const page = await db.docPage.findUniqueOrThrow({
    where: { id: input.pageId },
    select: { updatedAt: true, updatedById: true },
  });
  if (written.count === 1) return { updatedAt: page.updatedAt.toISOString() };
  return { conflict: true, updatedBy: await userById(page.updatedById), updatedAt: page.updatedAt.toISOString() };
}

/**
 * Re-parents and/or reorders a page (`parentId` null = top level) among its new siblings, keeping
 * its subtree. Same doc only, no cycles, and the whole moved subtree must stay within three levels.
 */
export async function movePage(ctx: Ctx, input: { pageId: string; parentId?: string | null } & MoveTarget): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfDocPage(input.pageId));
  await db.$transaction(async (tx) => {
    const page = await tx.docPage.findUniqueOrThrow({ where: { id: input.pageId }, select: { id: true, docId: true, parentId: true } });
    const parentId = input.parentId === undefined ? page.parentId : input.parentId;
    const all = await tx.docPage.findMany({ where: { docId: page.docId }, select: { id: true, parentId: true, position: true } });
    const byId = new Map(all.map((p) => [p.id, p]));

    const below = descendantsOf(all, page.id);
    if (parentId !== null) {
      if (parentId === page.id || below.has(parentId)) throw new AppError("VALIDATION", "A page can't move under itself");
      if (!byId.has(parentId)) throw notFound("Page");
    }
    const newDepth = parentId === null ? 0 : depthIn(byId, parentId) + 1;
    if (newDepth + subtreeHeight(all, page.id) > MAX_PAGE_DEPTH) {
      throw new AppError("VALIDATION", "That would put pages more than three levels deep");
    }
    const siblings = all.filter((p) => p.parentId === parentId);
    const position = positionForMove(siblings, page.id, input);
    await tx.docPage.update({ where: { id: page.id }, data: { parentId, position } });
  });
}

/** Deletes the page and its children. A doc keeps at least one page. */
export async function deletePage(ctx: Ctx, input: { pageId: string }): Promise<void> {
  await requireMember(ctx.userId, await spaceIdOfDocPage(input.pageId));
  await db.$transaction(async (tx) => {
    const page = await tx.docPage.findUniqueOrThrow({ where: { id: input.pageId }, select: { id: true, docId: true } });
    const all = await tx.docPage.findMany({ where: { docId: page.docId }, select: { id: true, parentId: true, position: true } });
    if (descendantsOf(all, page.id).size + 1 >= all.length) {
      throw new AppError("VALIDATION", "A doc needs at least one page");
    }
    await tx.docPage.delete({ where: { id: page.id } }); // children cascade
  });
}

// ---------- helpers ----------

type Row = { id: string; parentId: string | null };

function notFound(what: string) {
  return new AppError("NOT_FOUND", `${what} not found`);
}

function checkContent(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== "object" || (value as { type?: unknown }).type !== "doc") {
    throw new AppError("VALIDATION", "Page content must be rich-text JSON");
  }
  if (JSON.stringify(value).length > CONTENT_MAX_BYTES) throw new AppError("VALIDATION", "This page is too long to save");
  return value as Prisma.InputJsonValue;
}

/** 0 for a top-level page. */
async function depthOf(tx: Prisma.TransactionClient, pageId: string): Promise<number> {
  let depth = 0;
  let current: string | null = pageId;
  while (current) {
    const row: { parentId: string | null } | null = await tx.docPage.findUnique({ where: { id: current }, select: { parentId: true } });
    current = row?.parentId ?? null;
    if (current) depth += 1;
  }
  return depth;
}

function depthIn(byId: Map<string, Row>, id: string): number {
  let depth = 0;
  for (let p = byId.get(id)?.parentId; p; p = byId.get(p)?.parentId) depth += 1;
  return depth;
}

function descendantsOf(all: Row[], id: string): Set<string> {
  const out = new Set<string>();
  let frontier = [id];
  while (frontier.length) {
    const next = all.filter((p) => p.parentId !== null && frontier.includes(p.parentId)).map((p) => p.id);
    next.forEach((n) => out.add(n));
    frontier = next;
  }
  return out;
}

/** Levels below `id` (0 for a leaf). */
function subtreeHeight(all: Row[], id: string): number {
  let height = 0;
  let frontier = [id];
  for (;;) {
    frontier = all.filter((p) => p.parentId !== null && frontier.includes(p.parentId)).map((p) => p.id);
    if (!frontier.length) return height;
    height += 1;
  }
}
