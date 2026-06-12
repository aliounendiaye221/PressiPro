import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import dns from "node:dns";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const logLevels: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
  const shouldUseNeonAdapter = process.env.PRISMA_USE_NEON_ADAPTER === "1" || !process.env.VERCEL;

  if (shouldUseNeonAdapter) {
    const adapterConnectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

    if (!adapterConnectionString) {
      throw new Error("DATABASE_URL must be set");
    }

    try {
      dns.setDefaultResultOrder("ipv4first");
    } catch {
      // Ignore when DNS order cannot be configured in current runtime.
    }

    neonConfig.webSocketConstructor = ws;
    const adapter = new PrismaNeon({ connectionString: adapterConnectionString });

    return new PrismaClient({
      adapter,
      log: logLevels,
    });
  }

  return new PrismaClient({
    log: logLevels,
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
