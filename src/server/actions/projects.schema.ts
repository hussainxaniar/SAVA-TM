import { z } from "zod";

const id = z.string().min(1);
const name = z.string().trim().min(1, "Give the project a name").max(80, "Keep it under 80 characters");
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a color");

export const createProjectSchema = z.object({
  spaceId: id,
  name,
  color: color.optional(),
  copyStatusesFromProjectId: id.optional(),
});

export const updateProjectSchema = z.object({
  projectId: id,
  name: name.optional(),
  color: color.optional(),
  icon: z.string().trim().max(16).nullable().optional(),
});

/** beforeId = item now directly above the moved one; afterId = directly below. See services/ordering.ts. */
export const reorderProjectSchema = z.object({
  projectId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});

export const archiveProjectSchema = z.object({ projectId: id });
