import { z } from "zod";

// Section 16. Safe to import from client components.

const id = z.string().min(1);

export const listNotificationsSchema = z.object({
  spaceId: id,
  limit: z.number().int().min(1).max(100).optional(),
  unreadOnly: z.boolean().optional(),
});
export const spaceNotificationsSchema = z.object({ spaceId: id });
export const markNotificationReadSchema = z.object({ notificationId: id });
