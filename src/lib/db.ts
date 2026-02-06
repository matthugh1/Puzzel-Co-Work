import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbInstance =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Disable query logging to reduce noise - enable only when debugging DB issues
    // log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    log: process.env.PRISMA_LOG_QUERIES === "true" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = dbInstance;
}

// Export with explicit assignment to ensure it's not undefined
export const db = dbInstance;
