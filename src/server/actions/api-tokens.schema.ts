import { z } from "zod";

// Section 15. Safe to import from client components for form validation.

const id = z.string().min(1);

export const createApiTokenSchema = z.object({
  spaceId: id,
  name: z.string().trim().min(1, "Give the token a name").max(60, "Keep it under 60 characters"),
  scope: z.enum(["READ", "WRITE"]),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]),
});

export const revokeApiTokenSchema = z.object({ tokenId: id });
