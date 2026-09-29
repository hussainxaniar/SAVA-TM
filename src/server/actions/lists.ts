"use server";

import { refresh } from "next/cache";
import { createList, deleteList, reorderList, updateList } from "../services/lists";
import { action } from "./action";
import { createListSchema, deleteListSchema, reorderListSchema, updateListSchema } from "./lists.schema";

// Each mutation calls refresh() so the settings page and the sidebar re-render.

export const createListAction = action(createListSchema, async (input, ctx) => {
  const result = await createList(ctx, input);
  refresh();
  return result;
});

export const updateListAction = action(updateListSchema, async (input, ctx) => {
  await updateList(ctx, input);
  refresh();
});

export const reorderListAction = action(reorderListSchema, async (input, ctx) => {
  await reorderList(ctx, input);
  refresh();
});

/** If the user is viewing the deleted list, the client navigates to the target list. */
export const deleteListAction = action(deleteListSchema, async (input, ctx) => {
  await deleteList(ctx, input);
  refresh();
});
