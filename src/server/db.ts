import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma CLI stores `file:./dev.db` next to the schema (`prisma/dev.db`).
 * The query engine resolves a relative file URL from the process cwd, which
 * for `next dev` is the repo root. Point both at the same file.
 */
export function resolveDatabaseUrl(raw = process.env.DATABASE_URL ?? "file:./dev.db"): string {
  if (!raw.startsWith("file:")) return raw;
  const spec = raw.slice("file:".length);
  if (spec === "./dev.db" || spec === "dev.db") {
    return `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
  }
  if (spec.startsWith("/") || spec.startsWith("//")) return raw;
  return `file:${path.resolve(process.cwd(), spec)}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
