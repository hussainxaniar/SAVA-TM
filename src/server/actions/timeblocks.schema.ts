import { z } from "zod";

const id = z.string().min(1);
const instant = z.string().min(1);

export const rangeSchema = z.object({ spaceId: id, rangeStart: instant, rangeEnd: instant });
export const unscheduledSchema = z.object({ spaceId: id, projectId: id.nullable().optional() });
export const createTimeBlockSchema = z.object({ taskId: id, start: instant, end: instant, timeZone: z.string().min(1) });
export const updateTimeBlockSchema = z.object({ timeBlockId: id, start: instant, end: instant, timeZone: z.string().min(1) });
export const timeBlockSchema = z.object({ timeBlockId: id });
