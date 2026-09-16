import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  sandhiPrisma?: PrismaClient;
};

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and provide a PostgreSQL connection string.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

/** Lazily create one client per development process and one per serverless isolate. */
export function getDb(): PrismaClient {
  if (!globalForPrisma.sandhiPrisma) {
    globalForPrisma.sandhiPrisma = createPrismaClient();
  }

  return globalForPrisma.sandhiPrisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
