import type { ActivityType, Prisma } from "@prisma/client";
import { currentVia } from "../mcp/context";
import { notifyFromActivities } from "./notifications";

// Section 6.9 / 8.5. Activity is append-only and written ONLY through logActivity, inside the
// transaction of the mutation it describes. formatActivity arrives with the feed (T-15).

export type ActivityInput = {
  spaceId: string;
  taskId: string;
  actorId: string;
  type: ActivityType;
  payload?: Prisma.InputJsonValue;
};

/** The payload, plus `via` when the request runs through an API token (Section 15.1). */
function withVia(payload: Prisma.InputJsonValue | undefined): Prisma.InputJsonValue {
  const via = currentVia();
  const base = (payload ?? {}) as Prisma.InputJsonObject;
  return via ? { ...base, via } : base;
}

export async function logActivity(tx: Prisma.TransactionClient, input: ActivityInput): Promise<void> {
  await tx.activity.create({ data: { ...input, payload: withVia(input.payload) } });
  await notifyFromActivities(tx, [input]); // Section 16: same transaction
}

export async function logActivities(tx: Prisma.TransactionClient, inputs: ActivityInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await tx.activity.createMany({ data: inputs.map((i) => ({ ...i, payload: withVia(i.payload) })) });
  await notifyFromActivities(tx, inputs);
}
