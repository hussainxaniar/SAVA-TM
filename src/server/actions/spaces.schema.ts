import { z } from "zod";

// Schemas live beside their "use server" file (which may only export async functions)
// and are safe to import from client components for form validation.

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1, "Give your space a name").max(80, "Keep it under 80 characters"),
});
