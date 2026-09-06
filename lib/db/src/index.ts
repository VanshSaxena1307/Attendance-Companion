import { drizzle } from "drizzle-orm/node-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import * as schema from "./schema";

const envCandidates = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
  path.resolve(process.cwd(), ".env"),
];

if (typeof process.loadEnvFile === "function") {
  for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
      try {
        process.loadEnvFile(envPath);
        break;
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error?.code !== "ENOENT") {
          throw err;
        }
      }
    }
  }
}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15_000, query_timeout: 30_000 });
export const db = drizzle(pool, { schema });

export * from "./schema";
