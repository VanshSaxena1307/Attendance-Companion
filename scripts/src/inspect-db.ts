import {
  db,
  pool,
  timetablesTable,
  timetableEntriesTable,
  sectionsTable,
  subjectsTable,
  teachersTable,
  lectureInstancesTable,
  exemptionRequestsTable,
  usersTable,
  eq,
} from "../../lib/db/src/index";
import { getDepartmentSchedule, getLocalDateString } from "../../artifacts/api-server/src/lib/postgres-timetable-repository";

async function main() {
  console.log("=== DATE CHECK ===");
  const today = getLocalDateString();
  console.log("getLocalDateString():", today);
  const now = new Date();
  console.log("new Date():", now.toISOString());

  console.log("\n=== SECTIONS ===");
  const sections = await db.select().from(sectionsTable);
  console.log(sections);

  console.log("\n=== TIMETABLES ===");
  const timetables = await db.select().from(timetablesTable);
  console.log(timetables);

  console.log("\n=== SUBJECTS COUNT & SAMPLE ===");
  const subjects = await db.select().from(subjectsTable);
  console.log("Total subjects:", subjects.length);
  console.log("Sample subjects:", subjects.slice(0, 5));

  console.log("\n=== TEACHERS COUNT & SAMPLE ===");
  const teachers = await db.select().from(teachersTable).innerJoin(usersTable, eq(usersTable.id, teachersTable.id));
  console.log("Total teachers:", teachers.length);
  console.log("Sample teachers:", teachers.slice(0, 5).map(t => ({ id: t.teachers.id, code: t.teachers.teacherCode, name: t.users.name })));

  console.log("\n=== TIMETABLE ENTRIES FOR MONDAY ===");
  const mondayEntries = await db
    .select({
      id: timetableEntriesTable.id,
      day: timetableEntriesTable.dayOfWeek,
      time: timetableEntriesTable.startTime,
      subjectCode: timetableEntriesTable.subjectCode,
      subjectName: timetableEntriesTable.subjectName,
      teacherName: timetableEntriesTable.teacherName,
      teacherInitials: timetableEntriesTable.teacherInitials,
      room: timetableEntriesTable.room,
      batchType: timetableEntriesTable.batchType,
      batch: timetableEntriesTable.batch,
    })
    .from(timetableEntriesTable)
    .where(eq(timetableEntriesTable.dayOfWeek, "MONDAY"))
    .limit(10);
  console.log("Monday sample entries:", mondayEntries);

  console.log("\n=== GET DEPARTMENT SCHEDULE FOR TODAY ===");
  const todaySchedule = await getDepartmentSchedule();
  console.log("Today Schedule date:", todaySchedule.date, "day:", todaySchedule.day, "totalScheduled:", todaySchedule.totalScheduled);
  console.log("Today Schedule lectures sample (first 5):", todaySchedule.lectures.slice(0, 5));

  console.log("\n=== GET DEPARTMENT SCHEDULE FOR 2026-09-14 (MONDAY) ===");
  const mondaySchedule = await getDepartmentSchedule("2026-09-14");
  console.log("Monday Schedule date:", mondaySchedule.date, "day:", mondaySchedule.day, "totalScheduled:", mondaySchedule.totalScheduled);
  console.log("Monday Schedule lectures (first 5):", mondaySchedule.lectures.slice(0, 5));

  console.log("\n=== LECTURE INSTANCES IN DB ===");
  const instances = await db.select().from(lectureInstancesTable).limit(10);
  console.log("Instances count in DB:", instances.length);
  console.log("Sample instances:", instances);

  console.log("\n=== EXEMPTION REQUESTS IN DB ===");
  const exemptions = await db.select().from(exemptionRequestsTable);
  console.log("Exemption requests count in DB:", exemptions.length);
  console.log("Exemption requests:", exemptions);

  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
