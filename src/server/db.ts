import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Prisma's 5s default is too tight for multi-query transactions over a remote Neon
    // connection (or a Neon compute waking from suspend).
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
