import { db, pool, lectureInstancesTable } from "../../lib/db/src/index";

async function main() {
  const instances = await db.select({
    id: lectureInstancesTable.id,
    date: lectureInstancesTable.date,
    startTime: lectureInstancesTable.startTime,
    endTime: lectureInstancesTable.endTime,
    status: lectureInstancesTable.status,
    attendanceStatus: lectureInstancesTable.attendanceStatus,
    markedAt: lectureInstancesTable.markedAt,
  }).from(lectureInstancesTable);

  console.log("Total lecture instances in DB:", instances.length);
  for (const inst of instances) {
    console.log(`  [${inst.id}] Date: ${inst.date} | ${inst.startTime} - ${inst.endTime} | Status: ${inst.status} | Att: ${inst.attendanceStatus} | MarkedAt: ${inst.markedAt}`);
  }

  await pool.end();
}

main().catch(console.error);
