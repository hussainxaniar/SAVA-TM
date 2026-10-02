import { z } from "zod";

const id = z.string().min(1);
const title = z.string().min(1, "Give it a title").max(200, "Keep the title under 200 characters");
const doc = z.object({ type: z.literal("doc") }).passthrough();

export const createDocSchema = z.object({ projectId: id, title: title.optional() });
export const renameDocSchema = z.object({ docId: id, title });
export const reorderDocSchema = z.object({ docId: id, beforeId: id.nullable().optional(), afterId: id.nullable().optional() });
export const docSchema = z.object({ docId: id });
export const pageSchema = z.object({ pageId: id });
export const createPageSchema = z.object({ docId: id, parentId: id.nullable().optional(), title: title.optional() });
export const savePageSchema = z.object({
  pageId: id,
  title: title.optional(),
  content: doc.optional(),
  baseUpdatedAt: z.string().min(1),
});
export const movePageSchema = z.object({
  pageId: id,
  parentId: id.nullable().optional(),
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});
