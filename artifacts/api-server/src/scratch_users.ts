import { db, usersTable } from "@workspace/db";
import { asc } from "drizzle-orm";

async function main() {
  const users = await db.select().from(usersTable).orderBy(asc(usersTable.role), asc(usersTable.name));
  console.log("=== USERS IN DATABASE ===");
  console.table(users.map(u => ({ id: u.id, name: u.name, role: u.role, dept: u.department })));
  process.exit(0);
}

main().catch(console.error);
