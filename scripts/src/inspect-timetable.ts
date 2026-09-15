import {
  db,
  pool,
  timetablesTable,
  timetableEntriesTable,
  sectionsTable,
  subjectsTable,
  teachersTable,
  lectureInstancesTable,
  eq,
} from "../../lib/db/src/index";
import { getDepartmentSchedule, getLocalDateString } from "../../artifacts/api-server/src/lib/postgres-timetable-repository";

async function main() {
  const localDate = getLocalDateString();
  console.log("Local date from getLocalDateString():", localDate);

  const sched = await getDepartmentSchedule();
  console.log("Department schedule date:", sched.date, "day:", sched.day, "count:", sched.totalScheduled);
  console.log("Lectures in Department schedule:");
  for (const l of sched.lectures) {
    console.log(`  [${l.section}] ${l.time} | ${l.subjectCode} - ${l.subjectName} | ${l.teacherName} (${l.teacherInitials}) | Room: ${l.room} | Batch: ${l.batchType}/${l.batch} | Status: ${l.status}`);
  }

  console.log("\nUnique Subject Codes in timetableEntriesTable:");
  const entries = await db.select({
    code: timetableEntriesTable.subjectCode,
    name: timetableEntriesTable.subjectName,
    sectionId: timetableEntriesTable.sectionId,
    day: timetableEntriesTable.dayOfWeek,
  }).from(timetableEntriesTable);

  const subMap = new Map<string, string>();
  for (const e of entries) {
    subMap.set(e.code || "NO_CODE", e.name || "NO_NAME");
  }
  for (const [code, name] of subMap) {
    console.log(`  ${code}: ${name}`);
  }

  console.log("\nSubjects in subjectsTable:");
  const allSubs = await db.select().from(subjectsTable);
  for (const s of allSubs) {
    console.log(`  ${s.code}: ${s.name} (id: ${s.id})`);
  }

  await pool.end();
}

main().catch(console.error);
