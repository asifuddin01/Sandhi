import "server-only";

export {
  createPrismaClient,
  getDb,
  isDatabaseConfigured,
} from "@/lib/db-runtime";
