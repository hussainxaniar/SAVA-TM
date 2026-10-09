"use server";

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications";
import { action } from "./action";
import { listNotificationsSchema, markNotificationReadSchema, spaceNotificationsSchema } from "./notifications.schema";

// Notification actions (Section 16). No refresh(): the bell keeps its data in TanStack Query
// (['notifications', spaceId, ...]) and polls, see src/hooks/use-notifications.ts.

export const listNotificationsAction = action(listNotificationsSchema, (input, ctx) => listNotifications(ctx, input));
export const getUnreadCountAction = action(spaceNotificationsSchema, (input, ctx) => getUnreadCount(ctx, input));
export const markNotificationReadAction = action(markNotificationReadSchema, (input, ctx) => markNotificationRead(ctx, input));
export const markAllNotificationsReadAction = action(spaceNotificationsSchema, (input, ctx) => markAllNotificationsRead(ctx, input));
