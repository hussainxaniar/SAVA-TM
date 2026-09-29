"use server";

import { refresh } from "next/cache";
import { archiveProject, createProject, reorderProject, updateProject } from "../services/projects";
import { action } from "./action";
import {
  archiveProjectSchema,
  createProjectSchema,
  reorderProjectSchema,
  updateProjectSchema,
} from "./projects.schema";

// Each mutation calls refresh() so the sidebar (rendered by the space layout) re-renders.

/** Returns `{ projectId, firstListId }`; the client navigates to the new project's first list. */
export const createProjectAction = action(createProjectSchema, async (input, ctx) => {
  const result = await createProject(ctx, input);
  refresh();
  return result;
});

export const updateProjectAction = action(updateProjectSchema, async (input, ctx) => {
  await updateProject(ctx, input);
  refresh();
});

export const reorderProjectAction = action(reorderProjectSchema, async (input, ctx) => {
  await reorderProject(ctx, input);
  refresh();
});

export const archiveProjectAction = action(archiveProjectSchema, async (input, ctx) => {
  await archiveProject(ctx, input);
  refresh();
});
