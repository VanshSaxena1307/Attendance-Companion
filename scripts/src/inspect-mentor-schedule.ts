import { db, pool, teachersTable, usersTable, timetableEntriesTable, eq } from "../../lib/db/src/index";
import { getMentorSchedule } from "../../artifacts/api-server/src/lib/postgres-timetable-repository";

async function main() {
  const teachers = await db.select({
    id: teachersTable.id,
    code: teachersTable.teacherCode,
    name: usersTable.name,
    initials: usersTable.initials,
  }).from(teachersTable).innerJoin(usersTable, eq(usersTable.id, teachersTable.id));

  console.log("Teachers count:", teachers.length);

  for (const t of teachers) {
    const sched = await getMentorSchedule(t.id, "2026-09-22");
    if (sched && sched.lectures.length > 0) {
      console.log(`\nTeacher: ${t.name} (${t.initials}, ${t.code}, id: ${t.id}) on 2026-09-22 (Tuesday):`);
      for (const l of sched.lectures) {
        console.log(`  ${l.startTime} - ${l.endTime} | ${l.section} | ${l.subjectCode} - ${l.subjectName} | Batch: ${l.batchType}/${l.batch} | State: ${l.classState}`);
      }
    }
  }

  await pool.end();
}

main().catch(console.error);
