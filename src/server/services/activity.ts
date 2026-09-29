import type { ActivityType, Prisma } from "@prisma/client";

// Section 6.9 / 8.5. Activity is append-only and written ONLY through logActivity, inside the
// transaction of the mutation it describes. formatActivity arrives with the feed (T-15).

export type ActivityInput = {
  spaceId: string;
  taskId: string;
  actorId: string;
  type: ActivityType;
  payload?: Prisma.InputJsonValue;
};

export async function logActivity(tx: Prisma.TransactionClient, input: ActivityInput): Promise<void> {
  await tx.activity.create({ data: { ...input, payload: input.payload ?? {} } });
}

export async function logActivities(tx: Prisma.TransactionClient, inputs: ActivityInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await tx.activity.createMany({ data: inputs.map((i) => ({ ...i, payload: i.payload ?? {} })) });
}
