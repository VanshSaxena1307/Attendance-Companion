import { db, attendanceTable, subjectsTable, sectionsTable, teacherSubjectSectionsTable, teachersTable, usersTable } from "@workspace/db";
import { eq, sql, asc, and } from "drizzle-orm";

async function main() {
  const stats = await db.select({
    section: sectionsTable.code,
    subjectCode: subjectsTable.code,
    subjectName: subjectsTable.name,
    subjectType: subjectsTable.subjectType,
    color: subjectsTable.color,
    teacher: usersTable.name,
    totalRecords: sql<number>`count(${attendanceTable.id})::int`,
    presentCount: sql<number>`count(case when ${attendanceTable.status} in ('PRESENT', 'LATE', 'EXEMPTED') then 1 end)::int`,
    absentCount: sql<number>`count(case when ${attendanceTable.status} = 'ABSENT' then 1 end)::int`,
    exemptedCount: sql<number>`count(case when ${attendanceTable.status} = 'EXEMPTED' then 1 end)::int`,
    lecturesConducted: sql<number>`count(distinct ${attendanceTable.date})::int`,
  }).from(attendanceTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, attendanceTable.sectionId))
    .innerJoin(subjectsTable, eq(subjectsTable.id, attendanceTable.subjectId))
    .leftJoin(teacherSubjectSectionsTable, and(
      eq(teacherSubjectSectionsTable.subjectId, subjectsTable.id),
      eq(teacherSubjectSectionsTable.sectionId, sectionsTable.id)
    ))
    .leftJoin(teachersTable, eq(teachersTable.id, teacherSubjectSectionsTable.teacherId))
    .leftJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .groupBy(
      sectionsTable.code,
      subjectsTable.code,
      subjectsTable.name,
      subjectsTable.subjectType,
      subjectsTable.color,
      usersTable.name
    )
    .orderBy(asc(sectionsTable.code), asc(subjectsTable.code));

  console.log(`Total real cumulative subjects found: ${stats.length}`);
  console.table(stats.slice(0, 15));
  process.exit(0);
}

main().catch(console.error);
