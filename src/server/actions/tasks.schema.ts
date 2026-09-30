import { z } from "zod";

const id = z.string().min(1);
const title = z.string().trim().min(1, "Give the task a title").max(500, "Keep the title under 500 characters");
const priority = z.number().int().min(1).max(4);
/** ISO date-time string; null clears the date. */
const date = z.string().min(1).nullable();
/** Tiptap JSON document; null clears the description. */
const description = z.object({ type: z.literal("doc") }).passthrough().nullable();

export const listViewSchema = z.object({ listId: id });
export const taskSchema = z.object({ taskId: id });
export const myTasksSchema = z.object({ spaceId: id });

export const createTaskSchema = z.object({
  listId: id,
  title,
  parentId: id.nullable().optional(),
  description: description.optional(),
  priority: priority.optional(),
  statusId: id.nullable().optional(),
  startDate: date.optional(),
  dueDate: date.optional(),
  dueHasTime: z.boolean().optional(),
  assigneeIds: z.array(id).max(50).optional(),
  afterTaskId: id.nullable().optional(),
});

export const updateTaskSchema = z.object({
  taskId: id,
  title: title.optional(),
  description: description.optional(),
  priority: priority.optional(),
  statusId: id.optional(),
  startDate: date.optional(),
  dueDate: date.optional(),
  dueHasTime: z.boolean().optional(),
  completeSubtasks: z.boolean().optional(),
});

export const setCompletedSchema = z.object({
  taskId: id,
  completed: z.boolean(),
  includeSubtasks: z.boolean().optional(),
});

export const setAssigneesSchema = z.object({ taskId: id, userIds: z.array(id).max(50) });

/** Within `listId`: beforeId = task now directly above; afterId = directly below (services/ordering.ts). */
/** Section 6.5: beforeId/afterId place it among the target's roots (a sidebar drop sends neither = last). */
export const moveTaskSchema = z.object({
  taskId: id,
  toListId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});

/** Section 6.6: addTaskToList / removeTaskFromList. */
export const taskListLinkSchema = z.object({
  taskId: id,
  listId: id,
});

/** null = "Convert to task" (promote to top level). */
export const setParentSchema = z.object({
  taskId: id,
  parentId: id.nullable(),
});

export const reorderTaskSchema = z.object({
  taskId: id,
  listId: id,
  beforeId: id.nullable().optional(),
  afterId: id.nullable().optional(),
});
