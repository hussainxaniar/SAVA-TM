import { z } from "zod";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Give the list a name").max(80, "Keep it under 80 characters");

export const createListSchema = z.object({ projectId: id, name });

export const updateListSchema = z.object({
  listId: id,
  name: name.optional(),
  subtaskDisplay: z.enum(["NESTED", "SEPARATE"]).optional(),
});

/** beforeId = item now directly above the moved one; afterId = directly below. See services/ordering.ts. */
export const reorderListSchema = z.object({
  listId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});

export const deleteListSchema = z.object({ listId: id, targetListId: id });
