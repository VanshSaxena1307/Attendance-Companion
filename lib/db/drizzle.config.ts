import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

const envCandidates = [
  path.resolve(__dirname, "../../.env"),
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

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/attendance.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
