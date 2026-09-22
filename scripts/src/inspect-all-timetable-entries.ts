import { db, pool, timetableEntriesTable, timetablesTable, sectionsTable } from "../../lib/db/src/index";

async function main() {
  const allEntries = await db.select({
    day: timetableEntriesTable.dayOfWeek,
    startTime: timetableEntriesTable.startTime,
    endTime: timetableEntriesTable.endTime,
    subjectCode: timetableEntriesTable.subjectCode,
    subjectName: timetableEntriesTable.subjectName,
    sectionId: timetableEntriesTable.sectionId,
    batchType: timetableEntriesTable.batchType,
    batch: timetableEntriesTable.batch,
  }).from(timetableEntriesTable);

  console.log("Total timetable entries in DB:", allEntries.length);
  
  // Group by distinct startTime -> endTime
  const distinctSlots = new Map<string, number>();
  for (const e of allEntries) {
    const slot = `${e.startTime} - ${e.endTime}`;
    distinctSlots.set(slot, (distinctSlots.get(slot) || 0) + 1);
  }
  console.log("Distinct time slots in timetable_entries:");
  for (const [slot, count] of distinctSlots) {
    console.log(`  ${slot}: ${count} entries`);
  }

  await pool.end();
}

main().catch(console.error);
