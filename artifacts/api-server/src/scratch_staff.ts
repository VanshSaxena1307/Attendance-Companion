import { db, usersTable } from "@workspace/db";
import { ne, eq } from "drizzle-orm";

async function main() {
  const staff = await db.select().from(usersTable).where(ne(usersTable.role, 'STUDENT'));
  console.log("=== STAFF USERS ===");
  console.table(staff);
  process.exit(0);
}

main().catch(console.error);
