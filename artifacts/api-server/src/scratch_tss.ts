import { db, teacherSubjectSectionsTable, teachersTable, usersTable, subjectsTable, sectionsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

async function main() {
  const tss = await db.select({
    section: sectionsTable.code,
    subject: subjectsTable.name,
    subjectCode: subjectsTable.code,
    teacher: usersTable.name,
    subjectType: teacherSubjectSectionsTable.subjectType,
  }).from(teacherSubjectSectionsTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, teacherSubjectSectionsTable.sectionId))
    .innerJoin(subjectsTable, eq(subjectsTable.id, teacherSubjectSectionsTable.subjectId))
    .innerJoin(teachersTable, eq(teachersTable.id, teacherSubjectSectionsTable.teacherId))
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .orderBy(asc(sectionsTable.code), asc(subjectsTable.code));

  console.log("=== TEACHER SUBJECT SECTIONS ===");
  console.table(tss);
  process.exit(0);
}

main().catch(console.error);
