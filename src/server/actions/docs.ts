"use server";

import { refresh } from "next/cache";
import {
  archiveDoc,
  createDoc,
  createPage,
  deletePage,
  getPage,
  getPageTree,
  movePage,
  renameDoc,
  reorderDoc,
  savePage,
} from "../services/docs";
import { action } from "./action";
import {
  createDocSchema,
  createPageSchema,
  docSchema,
  movePageSchema,
  pageSchema,
  renameDocSchema,
  reorderDocSchema,
  savePageSchema,
} from "./docs.schema";

// Doc actions (Section 8.7). Doc-level changes call refresh() so the sidebar's docs list updates;
// page edits don't: the doc view keeps its pages in TanStack Query (['doc', docId, …]).

export const createDocAction = action(createDocSchema, async (input, ctx) => {
  const result = await createDoc(ctx, input);
  refresh();
  return result;
});
export const renameDocAction = action(renameDocSchema, async (input, ctx) => {
  await renameDoc(ctx, input);
  refresh();
});
export const reorderDocAction = action(reorderDocSchema, async (input, ctx) => {
  await reorderDoc(ctx, input);
  refresh();
});
export const archiveDocAction = action(docSchema, async (input, ctx) => {
  await archiveDoc(ctx, input);
  refresh();
});

export const getPageTreeAction = action(docSchema, (input, ctx) => getPageTree(ctx, input));
export const getPageAction = action(pageSchema, (input, ctx) => getPage(ctx, input));
export const createPageAction = action(createPageSchema, (input, ctx) => createPage(ctx, input));
/** Returns { updatedAt } or { conflict: true, updatedBy, updatedAt } (11.2). */
export const savePageAction = action(savePageSchema, (input, ctx) => savePage(ctx, input));
export const movePageAction = action(movePageSchema, (input, ctx) => movePage(ctx, input));
export const deletePageAction = action(pageSchema, (input, ctx) => deletePage(ctx, input));
