import { pool } from "../../lib/db/src/index";
import crypto from "node:crypto";

const DAYS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

async function runPhase5Migration() {
  console.log("==================================================");
  console.log("PHASE 5 — DATABASE MIGRATION & HISTORICAL BACKFILL");
  console.log("==================================================");

  const client = await pool.connect();

  try {
    // 1. Pre-checks
    console.log("\n[STEP 1] Running Pre-Migration Verification...");
    const totalAttRes = await client.query("SELECT COUNT(*) as count FROM attendance;");
    const totalAttendance = parseInt(totalAttRes.rows[0].count, 10);
    console.log(`Total attendance rows: ${totalAttendance}`);

    const statusCountsRes = await client.query(
      "SELECT status, COUNT(*) as count FROM attendance GROUP BY status ORDER BY status;"
    );
    console.log("Attendance counts by status:", statusCountsRes.rows);

    const presentRow = statusCountsRes.rows.find((r: any) => r.status === "PRESENT");
    const absentRow = statusCountsRes.rows.find((r: any) => r.status === "ABSENT");
    const initialPresent = parseInt(presentRow?.count || "0", 10);
    const initialAbsent = parseInt(absentRow?.count || "0", 10);

    if (totalAttendance !== 36277) {
      throw new Error(`PRE-CHECK FAILED: Expected 36,277 attendance records, found ${totalAttendance}`);
    }
    if (initialPresent !== 29901 || initialAbsent !== 6376) {
      throw new Error(`PRE-CHECK FAILED: Expected 29,901 PRESENT and 6,376 ABSENT, found ${initialPresent} and ${initialAbsent}`);
    }

    const timetableCountRes = await client.query("SELECT COUNT(*) as count FROM timetables;");
    const timetableEntriesCountRes = await client.query("SELECT COUNT(*) as count FROM timetable_entries;");
    console.log(`Timetables count: ${timetableCountRes.rows[0].count}`);
    console.log(`Timetable entries count: ${timetableEntriesCountRes.rows[0].count}`);

    // Begin Transaction
    await client.query("BEGIN;");

    // 2. DDL Execution
    console.log("\n[STEP 2] Executing Schema Changes (DDL)...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS lecture_instances (
        id TEXT PRIMARY KEY,
        timetable_entry_id TEXT REFERENCES timetable_entries(id) ON DELETE SET NULL,
        section_id TEXT NOT NULL REFERENCES sections(id),
        subject_id TEXT NOT NULL REFERENCES subjects(id),
        teacher_id TEXT REFERENCES teachers(id),
        teacher_name TEXT,
        teacher_initials TEXT,
        actual_teacher_id TEXT REFERENCES teachers(id),
        date DATE NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT NOT NULL,
        batch_type TEXT NOT NULL,
        batch TEXT NOT NULL,
        lecture_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        attendance_status TEXT NOT NULL DEFAULT 'UNMARKED',
        marked_by TEXT REFERENCES users(id),
        marked_at TIMESTAMPTZ,
        is_adhoc BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS lecture_instances_timetable_date_unique 
        ON lecture_instances (timetable_entry_id, date) 
        WHERE timetable_entry_id IS NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS lecture_instances_adhoc_slot_unique 
        ON lecture_instances (section_id, date, start_time, batch_type, batch) 
        WHERE timetable_entry_id IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS lecture_instances_section_date_idx 
        ON lecture_instances (section_id, date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS lecture_instances_teacher_date_idx 
        ON lecture_instances (teacher_id, date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS lecture_instances_subject_date_idx 
        ON lecture_instances (subject_id, date);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS lecture_instances_timetable_idx 
        ON lecture_instances (timetable_entry_id);
    `);

    // Modify attendance table
    await client.query(`
      ALTER TABLE attendance 
      ADD COLUMN IF NOT EXISTS lecture_instance_id TEXT REFERENCES lecture_instances(id);
    `);

    await client.query(`
      ALTER TABLE attendance 
      DROP CONSTRAINT IF EXISTS attendance_student_subject_date_unique;
    `);

    await client.query(`
      DROP INDEX IF EXISTS attendance_student_subject_date_unique;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_instance_unique 
        ON attendance (student_id, lecture_instance_id) 
        WHERE lecture_instance_id IS NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS attendance_legacy_student_subject_date_unique 
        ON attendance (student_id, subject_id, date) 
        WHERE lecture_instance_id IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS attendance_instance_idx 
        ON attendance (lecture_instance_id);
    `);

    console.log("Schema changes applied successfully.");

    // 3. Historical Backfill
    console.log("\n[STEP 3] Performing Historical Backfill Analysis & Mapping...");

    // Fetch timetable entries
    const ttEntriesRes = await client.query(`
      SELECT 
        te.id,
        te.timetable_id,
        te.section_id,
        te.day_of_week,
        te.start_time,
        te.end_time,
        te.subject_id,
        te.subject_code,
        te.subject_name,
        te.teacher_id,
        te.teacher_name,
        te.teacher_initials,
        te.batch_type,
        te.batch,
        te.room,
        te.lecture_type
      FROM timetable_entries te
      JOIN timetables t ON te.timetable_id = t.id
      WHERE t.status = 'ACTIVE';
    `);
    const timetableEntries = ttEntriesRes.rows;
    console.log(`Loaded ${timetableEntries.length} active timetable entries.`);

    // Fetch students with batch information
    const studentsRes = await client.query(`
      SELECT id, section_id, lab_batch, python_batch, cloud_batch FROM students;
    `);
    const studentMap = new Map<string, any>();
    for (const s of studentsRes.rows) {
      studentMap.set(s.id, s);
    }
    console.log(`Loaded ${studentMap.size} students.`);

    // Fetch all attendance records
    const attendanceRes = await client.query(`
      SELECT id, student_id, subject_id, section_id, date::text as date, status
      FROM attendance;
    `);
    const allAttendance = attendanceRes.rows;
    console.log(`Analyzing ${allAttendance.length} attendance records for deterministic match...`);

    let deterministicCount = 0;
    let ambiguousCount = 0;
    let unmappableCount = 0;

    // Group deterministic matches by (timetable_entry_id, date) -> array of attendance IDs
    const instanceAttendanceGroups = new Map<string, { entry: any; date: string; attendanceIds: string[] }>();

    for (const att of allAttendance) {
      const student = studentMap.get(att.student_id);
      if (!student) {
        unmappableCount++;
        continue;
      }

      // Compute day of week from date (YYYY-MM-DD)
      const d = new Date(att.date + "T12:00:00Z");
      const dayOfWeek = DAYS[d.getUTCDay()];

      // Filter matching timetable entries
      const matchingEntries = timetableEntries.filter((te: any) => {
        if (te.section_id !== att.section_id) return false;
        if (te.subject_id !== att.subject_id) return false;
        if (te.day_of_week !== dayOfWeek) return false;

        if (te.batch_type === "FULL" || te.batch === "ALL") return true;
        if (te.batch_type === "LAB" && student.lab_batch && te.batch.toUpperCase() === student.lab_batch.toUpperCase()) return true;
        if (te.batch_type === "PYTHON" && student.python_batch && te.batch.toUpperCase() === student.python_batch.toUpperCase()) return true;
        if (te.batch_type === "CLOUD" && student.cloud_batch && te.batch.toUpperCase() === student.cloud_batch.toUpperCase()) return true;

        return false;
      });

      if (matchingEntries.length === 1) {
        deterministicCount++;
        const entry = matchingEntries[0];
        const groupKey = `${entry.id}_${att.date}`;
        let group = instanceAttendanceGroups.get(groupKey);
        if (!group) {
          group = { entry, date: att.date, attendanceIds: [] };
          instanceAttendanceGroups.set(groupKey, group);
        }
        group.attendanceIds.push(att.id);
      } else if (matchingEntries.length > 1) {
        ambiguousCount++;
      } else {
        unmappableCount++;
      }
    }

    console.log(`Deterministic (Mappable): ${deterministicCount}`);
    console.log(`Ambiguous: ${ambiguousCount}`);
    console.log(`Unmappable: ${unmappableCount}`);
    console.log(`Total Legacy (Ambiguous + Unmappable): ${ambiguousCount + unmappableCount}`);
    console.log(`Distinct Lecture Instances to create: ${instanceAttendanceGroups.size}`);

    if (deterministicCount !== 11723) {
      throw new Error(`CRITICAL STOP: Expected 11,723 deterministic records, got ${deterministicCount}. Halting migration.`);
    }
    if (ambiguousCount + unmappableCount !== 24554) {
      throw new Error(`CRITICAL STOP: Expected 24,554 legacy records, got ${ambiguousCount + unmappableCount}. Halting migration.`);
    }

    // Create lecture instances and link attendance records in batches
    console.log("\n[STEP 4] Inserting Lecture Instances and Linking Attendance...");

    let totalLinked = 0;
    for (const [key, group] of instanceAttendanceGroups.entries()) {
      const instanceId = `inst_${group.entry.id}_${group.date.replace(/-/g, "")}`;

      // Insert lecture instance
      await client.query(
        `
        INSERT INTO lecture_instances (
          id, timetable_entry_id, section_id, subject_id,
          teacher_id, teacher_name, teacher_initials,
          date, start_time, end_time, room,
          batch_type, batch, lecture_type,
          status, attendance_status, is_adhoc, notes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14,
          'COMPLETED', 'MARKED', FALSE, 'Historical lecture instance generated via Phase 5 migration'
        )
        ON CONFLICT (timetable_entry_id, date) WHERE timetable_entry_id IS NOT NULL
        DO UPDATE SET status = 'COMPLETED', attendance_status = 'MARKED'
        RETURNING id;
      `,
        [
          instanceId,
          group.entry.id,
          group.entry.section_id,
          group.entry.subject_id,
          group.entry.teacher_id,
          group.entry.teacher_name,
          group.entry.teacher_initials,
          group.date,
          group.entry.start_time,
          group.entry.end_time,
          group.entry.room,
          group.entry.batch_type,
          group.entry.batch,
          group.entry.lecture_type,
        ]
      );

      // Link attendance records in batches of 500
      const ids = group.attendanceIds;
      for (let i = 0; i < ids.length; i += 500) {
        const batchIds = ids.slice(i, i + 500);
        const updateRes = await client.query(
          `
          UPDATE attendance 
          SET lecture_instance_id = $1 
          WHERE id = ANY($2::text[]);
        `,
          [instanceId, batchIds]
        );
        totalLinked += updateRes.rowCount || 0;
      }
    }

    console.log(`Total attendance rows linked to lecture instances: ${totalLinked}`);

    // 4. Post-Migration Verification
    console.log("\n[STEP 5] Running Post-Migration Invariant Verifications...");

    const postTotalRes = await client.query("SELECT COUNT(*) as count FROM attendance;");
    const postTotalAttendance = parseInt(postTotalRes.rows[0].count, 10);

    const postStatusRes = await client.query(
      "SELECT status, COUNT(*) as count FROM attendance GROUP BY status ORDER BY status;"
    );
    const postPresent = parseInt(
      postStatusRes.rows.find((r: any) => r.status === "PRESENT")?.count || "0",
      10
    );
    const postAbsent = parseInt(
      postStatusRes.rows.find((r: any) => r.status === "ABSENT")?.count || "0",
      10
    );

    const mappedRes = await client.query(
      "SELECT COUNT(*) as count FROM attendance WHERE lecture_instance_id IS NOT NULL;"
    );
    const postMapped = parseInt(mappedRes.rows[0].count, 10);

    const legacyRes = await client.query(
      "SELECT COUNT(*) as count FROM attendance WHERE lecture_instance_id IS NULL;"
    );
    const postLegacy = parseInt(legacyRes.rows[0].count, 10);

    const instanceCountRes = await client.query("SELECT COUNT(*) as count FROM lecture_instances;");
    const totalInstances = parseInt(instanceCountRes.rows[0].count, 10);

    console.log("--------------------------------------------------");
    console.log(`Attendance Rows: Before=${totalAttendance}, After=${postTotalAttendance}`);
    console.log(`PRESENT Rows:    Before=${initialPresent}, After=${postPresent}`);
    console.log(`ABSENT Rows:     Before=${initialAbsent}, After=${postAbsent}`);
    console.log(`Mapped Rows:     ${postMapped} (Expected 11,723)`);
    console.log(`Legacy Rows:     ${postLegacy} (Expected 24,554)`);
    console.log(`Lecture Instances Created: ${totalInstances}`);
    console.log("--------------------------------------------------");

    if (postTotalAttendance !== 36277) {
      throw new Error(`POST-CHECK FAILED: Total attendance count changed to ${postTotalAttendance}`);
    }
    if (postPresent !== initialPresent) {
      throw new Error(`POST-CHECK FAILED: PRESENT count changed from ${initialPresent} to ${postPresent}`);
    }
    if (postAbsent !== initialAbsent) {
      throw new Error(`POST-CHECK FAILED: ABSENT count changed from ${initialAbsent} to ${postAbsent}`);
    }
    if (postMapped !== 11723) {
      throw new Error(`POST-CHECK FAILED: Mapped count is ${postMapped}, expected 11,723`);
    }
    if (postLegacy !== 24554) {
      throw new Error(`POST-CHECK FAILED: Legacy count is ${postLegacy}, expected 24,554`);
    }

    // Commit Transaction
    await client.query("COMMIT;");
    console.log("\n>>> TRANSACTION COMMITTED SUCCESSFULLY! Zero data loss verified.");
  } catch (error) {
    await client.query("ROLLBACK;");
    console.error("\n>>> TRANSACTION ROLLED BACK DUE TO ERROR:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runPhase5Migration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
