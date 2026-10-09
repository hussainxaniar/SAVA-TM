import { z } from "zod";

// Section 11.4. Safe to import from client components.

const id = z.string().min(1);

export const searchTasksSchema = z.object({ spaceId: id, query: z.string().max(100).optional() });
export const taskLabelsSchema = z.object({ spaceId: id, taskIds: z.array(id).min(1).max(100) });
