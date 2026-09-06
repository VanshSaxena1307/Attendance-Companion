import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app";
import { logger } from "./lib/logger";

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

const rawPort = process.env["PORT"] ?? "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const host = process.env["HOST"] ?? "0.0.0.0";

const server = app.listen(port, host, () => {
  logger.info({ port, host }, "Server listening");
});

server.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
