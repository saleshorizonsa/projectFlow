import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    // connection_limit=1 ensures each serverless function instance holds at most
    // one DB connection, staying within Supabase's pgBouncer pool limit.
    const base = process.env.DATABASE_URL ?? "";
    const url = base.includes("connection_limit")
      ? base
      : `${base}${base.includes("?") ? "&" : "?"}connection_limit=1`;
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url } },
    });
  }

  return globalForPrisma.prisma;
}
