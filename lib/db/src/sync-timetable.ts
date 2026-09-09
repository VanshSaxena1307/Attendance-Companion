import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";
import {
  db,
  pool,
  sectionsTable,
  studentsTable,
  subjectsTable,
  teachersTable,
  timetablesTable,
  timetableEntriesTable,
  usersTable,
} from "./index";

const dataDir = process.env.SEED_DATA_DIR ?? path.resolve(process.cwd(), "../../data/seed");
const makeId = (prefix: string, value: string) =>
  `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
const text = (value: unknown) => (value == null ? "" : String(value).trim());
const cleanVal = (value: unknown) => {
  const t = text(value).replace(/\r\n|\r|\n/g, "").trim();
  return t.length > 0 ? t : null;
};

export async function syncTimetable() {
  console.log("=== Starting Timetable & Student Batch Foundation Sync ===");

  // 1. Sync Student Batch Data from student_combined_data.xlsx
  console.log("\n1. Syncing student batches and sections...");
  const studentsBookPath = path.join(dataDir, "student_combined_data.xlsx");
  const studentsBook = XLSX.readFile(studentsBookPath, { cellDates: true });
  const studentRows = XLSX.utils.sheet_to_json<unknown[]>(
    studentsBook.Sheets[studentsBook.SheetNames[0]],
    { header: 1, raw: true, defval: "" }
  ).slice(3).filter((row) => text(row[1]));

  const sections = await db.select().from(sectionsTable);
  const cse34Sec = sections.find((s) => s.code.replace(/[\s-]/g, "").toUpperCase() === "CSE34");
  const cse35Sec = sections.find((s) => s.code.replace(/[\s-]/g, "").toUpperCase() === "CSE35");

  if (!cse34Sec || !cse35Sec) {
    throw new Error("Could not find sections CSE34 and CSE35 in the database.");
  }

  let batchesUpdated = 0;
  let sectionFixed = 0;

  for (const row of studentRows) {
    const sNo = Number(row[0]);
    const rollNo = text(row[1]);
    const admNo = text(row[2]);
    const studentName = text(row[3]);
    const rawSection = text(row[5]).replace(/[\s-]/g, "").toUpperCase();
    const labBatch = cleanVal(row[7]);
    const pythonBatch = cleanVal(row[8]);
    const cloudBatch = cleanVal(row[9]);

    // Official rule: S.No 1..67 belong to CSE-34, S.No 68..134 belong to CSE-35
    // Roll 2503201001290 (Vansh Saxena, S.No 36) was incorrectly assigned to CSE-35 in earlier DB seeds
    const targetSectionId = (sNo <= 67) ? cse34Sec.id : cse35Sec.id;

    const res = await db.execute(sql`
      UPDATE students
      SET lab_batch = ${labBatch},
          python_batch = ${pythonBatch},
          cloud_batch = ${cloudBatch},
          section_id = ${targetSectionId}
      WHERE roll_no = ${rollNo}
    `);

    batchesUpdated += 1;
    if (rollNo === "2503201001290") {
      sectionFixed += 1;
    }
  }

  // Verify student counts per section
  const studentCountCheck = await db.execute(sql`
    SELECT s.code, count(*) as count
    FROM students st
    JOIN sections s ON st.section_id = s.id
    GROUP BY s.code
    ORDER BY s.code
  `);
  console.log("Students per section after batch sync:", studentCountCheck.rows);

  const batchDistributionCheck = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE lab_batch = 'B1') as lab_b1,
      count(*) FILTER (WHERE lab_batch = 'B2') as lab_b2,
      count(*) FILTER (WHERE python_batch IS NOT NULL) as python_total,
      count(*) FILTER (WHERE cloud_batch IS NOT NULL) as cloud_total,
      count(*) FILTER (WHERE python_batch IS NOT NULL AND cloud_batch IS NOT NULL) as mutual_conflict
    FROM students
  `);
  console.log("Batch distribution in DB:", batchDistributionCheck.rows[0]);

  // 2. Load and Resolve Teachers and Subjects
  console.log("\n2. Resolving teachers and subjects...");
  const dbSubjects = await db.select().from(subjectsTable);
  const subjectByCode = new Map(dbSubjects.map((s) => [s.code.toUpperCase(), s]));

  // Build teacher map by initials and names
  const dbTeachers = await db.execute(sql`
    SELECT t.id, t.teacher_code, u.name, u.initials
    FROM teachers t
    JOIN users u ON t.id = u.id
  `);

  // Map known initials to teacher IDs
  const teacherByInitials = new Map<string, { id: string; name: string }>();
  for (const t of dbTeachers.rows as Array<{ id: string; teacher_code: string; name: string; initials: string }>) {
    teacherByInitials.set(t.initials.toUpperCase(), { id: t.id, name: t.name });
    // Also map specific teacher codes and well-known initials
    if (t.teacher_code === "MTR_ADS_01") teacherByInitials.set("MG", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_ADS_02") teacherByInitials.set("AKS", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_AMCA_02") teacherByInitials.set("MPS", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_OOP_01") teacherByInitials.set("NY", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_OS_01") teacherByInitials.set("HSD", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_OS_02") teacherByInitials.set("BS", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_UHV_01") teacherByInitials.set("SG", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_UHV_02") teacherByInitials.set("AU", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_DV_09") teacherByInitials.set("DKM", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_DV_10") teacherByInitials.set("PKS", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_CC_11") teacherByInitials.set("RR", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_CC_12") teacherByInitials.set("SSI", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_ES_01") teacherByInitials.set("MJ", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_VA_01") teacherByInitials.set("BC", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_FSD_05") teacherByInitials.set("VM", { id: t.id, name: t.name });
    if (t.teacher_code === "MTR_FSD_06") teacherByInitials.set("AK", { id: t.id, name: t.name });
  }

  // 3. Upsert Timetable Definition Headers
  console.log("\n3. Upserting timetable version headers...");
  const cse34TimetableId = "tt-cse34-sem3-2026-2027";
  const cse35TimetableId = "tt-cse35-sem3-2026-2027";

  await db.insert(timetablesTable).values([
    {
      id: cse34TimetableId,
      academicSession: "2026-2027",
      semester: "III",
      sectionId: cse34Sec.id,
      effectiveFrom: "2026-08-31",
      effectiveTo: null,
      status: "ACTIVE",
      uploadedBy: null,
    },
    {
      id: cse35TimetableId,
      academicSession: "2026-2027",
      semester: "III",
      sectionId: cse35Sec.id,
      effectiveFrom: "2026-08-31",
      effectiveTo: null,
      status: "ACTIVE",
      uploadedBy: null,
    },
  ]).onConflictDoUpdate({
    target: [timetablesTable.id],
    set: {
      academicSession: sql`excluded.academic_session`,
      semester: sql`excluded.semester`,
      sectionId: sql`excluded.section_id`,
      effectiveFrom: sql`excluded.effective_from`,
      status: sql`excluded.status`,
    },
  });

  // 4. Load Structured Timetable Entries from timetable_seed.xlsx
  console.log("\n4. Reading timetable_seed.xlsx and inserting entries...");
  const timetableSeedPath = path.join(dataDir, "timetable_seed.xlsx");
  const timetableBook = XLSX.readFile(timetableSeedPath);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    timetableBook.Sheets["All Entries"] || timetableBook.Sheets[timetableBook.SheetNames[0]]
  );

  const report = {
    totalRows: rows.length,
    cse34Rows: 0,
    cse35Rows: 0,
    insertedOrUpdated: 0,
    unresolvedTeachers: new Set<string>(),
    unresolvedSubjects: new Set<string>(),
  };

  const entriesToUpsert: Array<typeof timetableEntriesTable.$inferInsert> = [];

  for (const r of rows) {
    const secCode = text(r.section).toUpperCase();
    const isCse34 = secCode.includes("34");
    const sectionId = isCse34 ? cse34Sec.id : cse35Sec.id;
    const timetableId = isCse34 ? cse34TimetableId : cse35TimetableId;

    if (isCse34) report.cse34Rows++;
    else report.cse35Rows++;

    const dayOfWeek = text(r.day_of_week).toUpperCase();
    const startTime = text(r.start_time);
    const endTime = text(r.end_time);
    const batchType = text(r.batch_type).toUpperCase();
    const batch = text(r.batch).toUpperCase();
    const room = text(r.room);
    const lectureType = text(r.lecture_type).toUpperCase();

    // Subject resolution
    const rawSubjectCode = text(r.subject_code).toUpperCase() || null;
    let subjectId: string | null = null;
    let subjectCode: string | null = rawSubjectCode;
    let subjectName: string = text(r.subject_name);

    if (rawSubjectCode) {
      const dbSub = subjectByCode.get(rawSubjectCode);
      if (dbSub) {
        subjectId = dbSub.id;
        subjectName = dbSub.name;
      } else {
        report.unresolvedSubjects.add(rawSubjectCode);
      }
    } else {
      report.unresolvedSubjects.add(`${subjectName} (No Code)`);
    }

    // Teacher resolution
    const rawInitials = text(r.teacher_initials);
    let teacherId: string | null = null;
    let teacherName: string | null = text(r.teacher_name) || null;

    if (rawInitials) {
      // Check single initial first
      const singleMatch = teacherByInitials.get(rawInitials.toUpperCase());
      if (singleMatch) {
        teacherId = singleMatch.id;
        teacherName = singleMatch.name;
      } else if (rawInitials.includes(",")) {
        // Multi-teacher slot e.g. "AK,DK" or "MG,NY"
        const parts = rawInitials.split(",").map((p) => p.trim().toUpperCase());
        const primary = parts[0];
        const primaryMatch = teacherByInitials.get(primary);
        if (primaryMatch) {
          teacherId = primaryMatch.id;
        }
        // Note unresolved co-teachers
        for (const p of parts) {
          if (!teacherByInitials.has(p)) {
            report.unresolvedTeachers.add(p);
          }
        }
      } else {
        report.unresolvedTeachers.add(rawInitials);
      }
    }

    const entryId = makeId("tte", `${timetableId}:${dayOfWeek}:${startTime}:${batchType}:${batch}`);

    entriesToUpsert.push({
      id: entryId,
      timetableId,
      sectionId,
      dayOfWeek,
      startTime,
      endTime,
      subjectId,
      subjectCode,
      subjectName,
      teacherId,
      teacherName,
      teacherInitials: rawInitials || null,
      batchType,
      batch,
      room,
      lectureType,
    });
  }

  // Batch insert with onConflictDoUpdate
  console.log(`Upserting ${entriesToUpsert.length} timetable entries...`);
  for (let i = 0; i < entriesToUpsert.length; i += 25) {
    const chunk = entriesToUpsert.slice(i, i + 25);
    await db.insert(timetableEntriesTable).values(chunk).onConflictDoUpdate({
      target: [
        timetableEntriesTable.timetableId,
        timetableEntriesTable.dayOfWeek,
        timetableEntriesTable.startTime,
        timetableEntriesTable.batchType,
        timetableEntriesTable.batch,
      ],
      set: {
        sectionId: sql`excluded.section_id`,
        endTime: sql`excluded.end_time`,
        subjectId: sql`excluded.subject_id`,
        subjectCode: sql`excluded.subject_code`,
        subjectName: sql`excluded.subject_name`,
        teacherId: sql`excluded.teacher_id`,
        teacherName: sql`excluded.teacher_name`,
        teacherInitials: sql`excluded.teacher_initials`,
        room: sql`excluded.room`,
        lectureType: sql`excluded.lecture_type`,
      },
    });
    report.insertedOrUpdated += chunk.length;
  }

  console.log("\n=== Timetable & Batch Sync Complete ===");
  console.log(JSON.stringify({
    ...report,
    unresolvedTeachers: [...report.unresolvedTeachers],
    unresolvedSubjects: [...report.unresolvedSubjects],
  }, null, 2));

  return report;
}

if (process.argv[1] && process.argv[1].includes("sync-timetable")) {
  syncTimetable()
    .catch((err) => {
      console.error("Sync failed:", err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
