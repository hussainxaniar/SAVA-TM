import { z } from "zod";

export const empty = z.object({}).optional();
export const authUrlSchema = z.object({ spaceId: z.string().min(1) });
export const eventsRangeSchema = z.object({ rangeStart: z.string().min(1), rangeEnd: z.string().min(1) });
