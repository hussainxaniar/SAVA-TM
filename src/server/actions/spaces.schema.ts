import { z } from "zod";

// Schemas live beside their "use server" file (which may only export async functions)
// and are safe to import from client components for form validation.

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1, "Give your space a name").max(80, "Keep it under 80 characters"),
});

const id = z.string().min(1);

export const renameSpaceSchema = z.object({ spaceId: id, name: createSpaceSchema.shape.name });

export const changeRoleSchema = z.object({ spaceId: id, userId: id, role: z.enum(["OWNER", "ADMIN", "MEMBER"]) });

export const removeMemberSchema = z.object({ spaceId: id, userId: id });

export const leaveSpaceSchema = z.object({ spaceId: id });

export const createInviteSchema = z.object({
  spaceId: id,
  role: z.enum(["ADMIN", "MEMBER"]),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]),
  maxUses: z.number().int("Max uses must be a whole number").min(1, "Max uses must be at least 1").max(1000).nullable().optional(),
});

export const revokeInviteSchema = z.object({ inviteId: id });

export const acceptInviteSchema = z.object({ token: id });
