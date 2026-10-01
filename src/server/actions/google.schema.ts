import { z } from "zod";

export const empty = z.object({}).optional();
export const authUrlSchema = z.object({ spaceId: z.string().min(1) });
