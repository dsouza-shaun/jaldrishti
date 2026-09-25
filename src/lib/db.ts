import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Query logs can contain project names, notes, and coordinates. Keep only
    // non-sensitive diagnostics in production and development.
    log: ["error"],
  });

globalForPrisma.prisma = db;
