import { PrismaClient } from "@prisma/client";

/**
 * Neon suspends idle computes; the first connection after a pause can take several seconds,
 * longer than Prisma's 5s connect timeout ("Can't reach database server", P1001). Add
 * generous connection defaults unless the URL already sets them, so every environment
 * (local .env, tests, Vercel) gets them without editing connection strings.
 */
function withConnectionDefaults(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return url;
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: withConnectionDefaults(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Prisma's 5s default is too tight for multi-query transactions over a remote Neon
    // connection (or a Neon compute waking from suspend).
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
