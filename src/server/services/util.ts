import { Prisma } from "@prisma/client";
import { db } from "../db";
import { AppError } from "../errors";

/** Trims a user-entered name and enforces 1..max characters. */
export function cleanName(value: string, label: string, max = 80): string {
  const name = value.trim();
  if (!name) throw new AppError("VALIDATION", `${label} can't be empty`);
  if (name.length > max) throw new AppError("VALIDATION", `${label} must be at most ${max} characters`);
  return name;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function checkColor(color: string) {
  if (!HEX_COLOR.test(color)) throw new AppError("VALIDATION", "Color must be a hex value like #2563EB");
}

/**
 * A Serializable transaction, for checks that must hold across concurrent writers
 * ("keep at least one Owner", "keep at least one TODO and one DONE status"). Serialization
 * failures (P2034) are expected at this level and retried; if they persist the caller gets
 * CONFLICT with `conflictMessage`.
 */
export async function serializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  conflictMessage = "Someone else changed this at the same time. Try again.",
): Promise<T> {
  const attempts = 3;
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (!isRetryableConflict(e)) throw e;
      if (attempt === attempts) throw new AppError("CONFLICT", conflictMessage);
    }
  }
}

/**
 * Serialization failures and deadlocks: the database aborted one of two conflicting
 * transactions and the loser should simply retry. Prisma usually reports both as P2034, but
 * some paths surface the raw Postgres code (40001 serialization, 40P01 deadlock).
 */
function isRetryableConflict(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") return true;
  const message = e instanceof Error ? e.message : "";
  return /\b(40001|40P01)\b|deadlock detected|could not serialize access/.test(message);
}
