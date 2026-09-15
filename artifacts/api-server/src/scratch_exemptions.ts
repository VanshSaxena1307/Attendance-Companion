import { db, exemptionRequestsTable } from "@workspace/db";

async function main() {
  const rows = await db.select().from(exemptionRequestsTable);
  console.log("=== EXEMPTION REQUESTS IN POSTGRESQL ===");
  console.log("Total rows:", rows.length);
  console.table(rows);
  process.exit(0);
}

main().catch(console.error);
