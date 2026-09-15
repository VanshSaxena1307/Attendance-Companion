import { db, attendanceTable, subjectsTable, sectionsTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";

async function main() {
  const stats = await db.select({
    section: sectionsTable.code,
    subjectCode: subjectsTable.code,
    subjectName: subjectsTable.name,
    subjectType: subjectsTable.subjectType,
    totalRecords: sql<number>`count(*)`,
    presentCount: sql<number>`count(case when ${attendanceTable.status} in ('PRESENT', 'LATE', 'EXEMPTED') then 1 end)`,
    absentCount: sql<number>`count(case when ${attendanceTable.status} = 'ABSENT' then 1 end)`,
    exemptedCount: sql<number>`count(case when ${attendanceTable.status} = 'EXEMPTED' then 1 end)`,
  }).from(attendanceTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, attendanceTable.sectionId))
    .innerJoin(subjectsTable, eq(subjectsTable.id, attendanceTable.subjectId))
    .groupBy(sectionsTable.code, subjectsTable.code, subjectsTable.name, subjectsTable.subjectType)
    .orderBy(asc(sectionsTable.code), asc(subjectsTable.code));

  console.log("=== REAL ATTENDANCE STATS BY SECTION & SUBJECT IN DB ===");
  console.table(stats);
  process.exit(0);
}

main().catch(console.error);
