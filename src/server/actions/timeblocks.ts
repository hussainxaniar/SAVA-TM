"use server";

import {
  createTimeBlock,
  deleteTimeBlock,
  listDueChips,
  listTimeBlocks,
  listUnscheduled,
  retrySync,
  updateTimeBlock,
} from "../services/timeblocks";
import { action } from "./action";
import {
  createTimeBlockSchema,
  rangeSchema,
  retrySyncSchema,
  timeBlockSchema,
  unscheduledSchema,
  updateTimeBlockSchema,
} from "./timeblocks.schema";

// Calendar actions (Section 8.6, local half). The calendar keeps its data in TanStack Query
// (['calendar', spaceId, …]) with optimistic updates; no refresh().

export const listTimeBlocksAction = action(rangeSchema, (input, ctx) => listTimeBlocks(ctx, input));
export const listDueChipsAction = action(rangeSchema, (input, ctx) => listDueChips(ctx, input));
export const listUnscheduledAction = action(unscheduledSchema, (input, ctx) => listUnscheduled(ctx, input));
export const createTimeBlockAction = action(createTimeBlockSchema, (input, ctx) => createTimeBlock(ctx, input));
export const updateTimeBlockAction = action(updateTimeBlockSchema, (input, ctx) => updateTimeBlock(ctx, input));
export const deleteTimeBlockAction = action(timeBlockSchema, (input, ctx) => deleteTimeBlock(ctx, input));
/** An ERROR block's Retry: push it to Google again (10.1). */
export const retrySyncAction = action(retrySyncSchema, (input, ctx) => retrySync(ctx, input));
