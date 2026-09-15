import { db, studentsTable, usersTable, sectionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

async function main() {
  const mentors = await db.select({
    section: sectionsTable.code,
    mentorId: studentsTable.mentorId,
    mentorName: usersTable.name,
    mentorEmail: usersTable.email,
    count: sql<number>`count(*)`,
  }).from(studentsTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
    .leftJoin(usersTable, eq(usersTable.id, studentsTable.mentorId))
    .groupBy(sectionsTable.code, studentsTable.mentorId, usersTable.name, usersTable.email);

  console.log("=== REAL MENTORS BY SECTION ===");
  console.table(mentors);
  process.exit(0);
}

main().catch(console.error);
