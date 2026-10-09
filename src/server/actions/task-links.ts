"use server";

import { getTaskLabels, searchTasks } from "../services/task-links";
import { action } from "./action";
import { searchTasksSchema, taskLabelsSchema } from "./task-links.schema";

// Task links in docs (Section 11.4): the insert popover's search and the chips' live labels. Read-only,
// so no refresh(); the editor keeps them in TanStack Query (src/hooks/use-task-links.ts).

export const searchTasksAction = action(searchTasksSchema, (input, ctx) => searchTasks(ctx, input));
export const getTaskLabelsAction = action(taskLabelsSchema, (input, ctx) => getTaskLabels(ctx, input));
