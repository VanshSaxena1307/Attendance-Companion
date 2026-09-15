import { getDepartmentSchedule } from "./lib/postgres-timetable-repository";

async function main() {
  const schedule = await getDepartmentSchedule("2026-09-14");
  console.log("=== API RESPONSE FOR getDepartmentSchedule('2026-09-14') ===");
  console.log("Total scheduled:", schedule.totalScheduled);
  console.log("Marked count:", schedule.markedCount);
  console.log("Pending count:", schedule.pendingCount);
  console.log("Cancelled count:", schedule.cancelledCount);
  console.log(`Lectures count: ${schedule.lectures.length}`);
  console.table(schedule.lectures.map(l => ({
    id: l.id,
    time: l.time,
    section: l.section,
    subjectCode: l.subjectCode,
    subjectName: l.subjectName,
    teacher: l.teacherName,
    room: l.room,
    status: l.status,
    attStatus: l.attendanceStatus,
  })));
  process.exit(0);
}

main().catch(console.error);
