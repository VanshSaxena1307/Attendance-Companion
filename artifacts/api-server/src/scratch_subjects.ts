import { db, subjectsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

async function main() {
  const subjects = await db.select().from(subjectsTable).orderBy(asc(subjectsTable.code));
  console.log("=== ALL SUBJECTS ===");
  console.table(subjects);
  process.exit(0);
}

main().catch(console.error);
