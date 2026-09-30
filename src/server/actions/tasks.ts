"use server";

import {
  addTaskToList,
  createTask,
  deleteTask,
  getListView,
  getMyTasks,
  getTask,
  moveTask,
  removeTaskFromList,
  reorderTask,
  restoreTask,
  setAssignees,
  setCompleted,
  setParent,
  updateTask,
} from "../services/tasks";
import { action } from "./action";
import {
  createTaskSchema,
  listViewSchema,
  moveTaskSchema,
  myTasksSchema,
  reorderTaskSchema,
  setAssigneesSchema,
  setCompletedSchema,
  setParentSchema,
  taskListLinkSchema,
  taskSchema,
  updateTaskSchema,
} from "./tasks.schema";

// Task actions. Unlike settings actions, these do NOT call refresh(): task UIs keep their data
// in TanStack Query (query keys ['tasks', listId], ['task', taskId]) with optimistic updates,
// rollback on error and invalidation on settle (Section 4). The read actions are what those
// queries fetch with after the server-rendered first paint.

// ---------- Reads ----------
export const getListViewAction = action(listViewSchema, (input, ctx) => getListView(ctx, input));
export const getTaskAction = action(taskSchema, (input, ctx) => getTask(ctx, input));
export const getMyTasksAction = action(myTasksSchema, (input, ctx) => getMyTasks(ctx, input));

// ---------- Mutations ----------
/** Returns the new TaskRowDTO. */
export const createTaskAction = action(createTaskSchema, (input, ctx) => createTask(ctx, input));
/** Returns the updated TaskRowDTO. */
export const updateTaskAction = action(updateTaskSchema, (input, ctx) => updateTask(ctx, input));
export const setCompletedAction = action(setCompletedSchema, (input, ctx) => setCompleted(ctx, input));
export const setAssigneesAction = action(setAssigneesSchema, (input, ctx) => setAssignees(ctx, input));
export const reorderTaskAction = action(reorderTaskSchema, (input, ctx) => reorderTask(ctx, input));
/** "Move to…" and a plain sidebar drop (6.5): top-level tasks only. */
export const moveTaskAction = action(moveTaskSchema, (input, ctx) => moveTask(ctx, input));
/** "Add to list…" and an Alt sidebar drop (6.6). */
export const addTaskToListAction = action(taskListLinkSchema, (input, ctx) => addTaskToList(ctx, input));
/** "Remove from this list" (linked rows only) and the dialog's list chip ×. */
export const removeTaskFromListAction = action(taskListLinkSchema, (input, ctx) => removeTaskFromList(ctx, input));
/** "Make subtask of…" (parentId) / "Convert to task" (parentId: null), rules 6.4.3. */
export const setParentAction = action(setParentSchema, (input, ctx) => setParent(ctx, input));
/** Soft delete; pair with restoreTaskAction for the 10-second Undo toast (6.4.5). */
export const deleteTaskAction = action(taskSchema, (input, ctx) => deleteTask(ctx, input));
export const restoreTaskAction = action(taskSchema, (input, ctx) => restoreTask(ctx, input));
