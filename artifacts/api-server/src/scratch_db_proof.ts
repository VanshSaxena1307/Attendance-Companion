import { db, sectionsTable, subjectsTable, teachersTable, timetableEntriesTable, lectureInstancesTable, usersTable, timetablesTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";

async function main() {
  console.log("=== C. SUBJECTS ===");
  const subjects = await db.select({
    id: subjectsTable.id,
    code: subjectsTable.code,
    name: subjectsTable.name,
    teacher: subjectsTable.teacher,
  }).from(subjectsTable).orderBy(asc(subjectsTable.code));
  console.log(`Total subjects: ${subjects.length}`);
  console.table(subjects);

  console.log("\n=== D. TEACHERS ===");
  const teachers = await db.select({
    id: teachersTable.id,
    name: usersTable.name,
    teacherCode: teachersTable.teacherCode,
  }).from(teachersTable)
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .orderBy(asc(usersTable.name));
  console.log(`Total teachers: ${teachers.length}`);
  console.table(teachers);

  console.log("\n=== E. SECTIONS ===");
  const sections = await db.select().from(sectionsTable);
  console.table(sections);

  console.log("\n=== A. TIMETABLE ENTRIES FOR CSE34 / CSE35 ===");
  const entries = await db.select({
    section: sectionsTable.code,
    day: timetableEntriesTable.dayOfWeek,
    time: timetableEntriesTable.startTime,
    endTime: timetableEntriesTable.endTime,
    subjectCode: timetableEntriesTable.subjectCode,
    subjectName: subjectsTable.name,
    teacherName: timetableEntriesTable.teacherName,
    room: timetableEntriesTable.room,
  }).from(timetableEntriesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, timetableEntriesTable.sectionId))
    .leftJoin(subjectsTable, eq(subjectsTable.id, timetableEntriesTable.subjectId))
    .orderBy(asc(sectionsTable.code), asc(timetableEntriesTable.dayOfWeek), asc(timetableEntriesTable.startTime));
  console.log(`Total timetable entries: ${entries.length}`);
  // Sample print per section and day
  const mondayEntries = entries.filter(e => e.day.toUpperCase().startsWith("MON"));
  console.log("Monday entries sample:");
  console.table(mondayEntries.slice(0, 10));

  console.log("\n=== B. TODAY'S LECTURE INSTANCES ===");
  // Find whatever dates exist in lecture_instances
  const sampleDates = await db.selectDistinct({ date: lectureInstancesTable.date }).from(lectureInstancesTable).orderBy(asc(lectureInstancesTable.date));
  console.log("Dates in lecture_instances:", sampleDates.map(d => d.date));

  const today = '2026-09-14';
  console.log("Current system date (Today):", today);
  const todayInstances = await db.select({
    id: lectureInstancesTable.id,
    date: lectureInstancesTable.date,
    section: sectionsTable.code,
    subject: subjectsTable.name,
    subjectCode: subjectsTable.code,
    teacher: lectureInstancesTable.teacherName,
    time: lectureInstancesTable.startTime,
    endTime: lectureInstancesTable.endTime,
    room: lectureInstancesTable.room,
    status: lectureInstancesTable.status,
    attendanceStatus: lectureInstancesTable.attendanceStatus,
  }).from(lectureInstancesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, lectureInstancesTable.sectionId))
    .innerJoin(subjectsTable, eq(subjectsTable.id, lectureInstancesTable.subjectId))
    .where(eq(lectureInstancesTable.date, today))
    .orderBy(asc(sectionsTable.code), asc(lectureInstancesTable.startTime));
  
  console.log(`Total lecture instances for ${today}: ${todayInstances.length}`);
  console.table(todayInstances);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
