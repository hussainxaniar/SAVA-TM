import { z } from "zod";

export const savePushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(2048),
  auth: z.string().min(1).max(2048),
  userAgent: z.string().max(300).nullish(),
});

export const deletePushSubscriptionSchema = z.object({ endpoint: z.string().min(1).max(2048) });

export const noInputSchema = z.object({});
