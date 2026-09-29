"use server";

import { refresh } from "next/cache";
import { createStatus, deleteStatus, reorderStatus, updateStatus } from "../services/statuses";
import { action } from "./action";
import { createStatusSchema, deleteStatusSchema, reorderStatusSchema, updateStatusSchema } from "./statuses.schema";

// Each mutation calls refresh() so the project settings page re-renders with fresh data.

export const createStatusAction = action(createStatusSchema, async (input, ctx) => {
  const status = await createStatus(ctx, input);
  refresh();
  return status;
});

export const updateStatusAction = action(updateStatusSchema, async (input, ctx) => {
  await updateStatus(ctx, input);
  refresh();
});

export const reorderStatusAction = action(reorderStatusSchema, async (input, ctx) => {
  await reorderStatus(ctx, input);
  refresh();
});

export const deleteStatusAction = action(deleteStatusSchema, async (input, ctx) => {
  await deleteStatus(ctx, input);
  refresh();
});
