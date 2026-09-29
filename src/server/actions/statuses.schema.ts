import { z } from "zod";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Give the status a name").max(40, "Keep it under 40 characters");
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color");
const category = z.enum(["TODO", "ACTIVE", "DONE"]);

export const createStatusSchema = z.object({ projectId: id, name, color, category });

export const updateStatusSchema = z.object({
  statusId: id,
  name: name.optional(),
  color: color.optional(),
  category: category.optional(),
});

/** beforeId = item now directly above the moved one; afterId = directly below. See services/ordering.ts. */
export const reorderStatusSchema = z.object({
  statusId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});

export const deleteStatusSchema = z.object({ statusId: id, replacementStatusId: id });
