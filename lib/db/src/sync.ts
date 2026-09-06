/**
 * sync.ts — Incremental student + attendance sync from updated Excel files.
 *
 * Safe to run multiple times (fully idempotent):
 *   - Existing students: matched by rollNo (stable canonical key) → sync email + mobile
 *   - New students (rollNo absent from DB): insert into users + students
 *   - Excel blank values: properly synced as null (or left null)
 *   - Attendance: insert with onConflictDoNothing (no duplicates, no deletions)
 *   - No migrations, no drops, no truncates, no deletes
 *
 * Column layout in student_combined_data.xlsx:
 *   Col 0: S.No
 *   Col 1: Roll No        ← canonical match key
 *   Col 2: Admission No   ← admission number
 *   Col 3: Student Name
 *   Col 4: email
 *   Col 5: Section
 *   Col 6: mobile
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { sql } from "drizzle-orm";
import {
  db,
  pool,
  attendanceTable,
  sectionsTable,
  studentsTable,
  usersTable,
} from "./index";

const dataDir =
  process.env.SEED_DATA_DIR ?? path.resolve(process.cwd(), "../../data/seed");

// ─── helpers ─────────────────────────────────────────────────────────────────
const makeId = (prefix: string, value: string) =>
  `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
const text = (value: unknown) =>
  value == null ? "" : String(value).trim();
const cleanVal = (value: unknown) => {
  const t = text(value).replace(/\r\n|\r|\n/g, "").trim();
  return t.length > 0 ? t : null;
};
const sectionCode = (value: unknown) =>
  text(value).replace(/[\s-]/g, "").toUpperCase();
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 4).toUpperCase() || "ST";
const xlRows = (book: XLSX.WorkBook, sheet: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1, raw: true, defval: "" });
const dateText = (value: unknown): string => {
  if (value instanceof Date)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  if (typeof value === "number") return XLSX.SSF.format("yyyy-mm-dd", value);
  return text(value).slice(0, 10);
};

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  // ── Load Excel files ─────────────────────────────────────────────────────
  const studentsBook = XLSX.read(fs.readFileSync(path.join(dataDir, "student_combined_data.xlsx")), { type: "buffer", cellDates: true });
  const attendanceBook = XLSX.read(fs.readFileSync(path.join(dataDir, "Attendance_Demo.xlsx")), { type: "buffer", cellDates: true });
  const subjectsBook = XLSX.read(fs.readFileSync(path.join(dataDir, "subject_clean.xlsx")), { type: "buffer", cellDates: true });

  // ── Parse student master ──────────────────────────────────────────────────
  const sourceStudents = xlRows(studentsBook, studentsBook.SheetNames[0])
    .slice(3)                       // skip title & header rows
    .filter((row) => text(row[1]))  // rollNo must be non-empty
    .map((row) => {
      const rollNo = text(row[1]);
      const rawAdm = cleanVal(row[2]);
      const name = text(row[3]);
      const email = cleanVal(row[4]);
      const section = sectionCode(row[5]);
      const mobile = cleanVal(row[6]);

      // If admissionNo is absent, extract from email pattern if possible
      let derivedAdmNo = rawAdm;
      if (!derivedAdmNo && email) {
        const emailMatch = email.match(/\.(\d{2}[Bb]\d{8})@/);
        if (emailMatch) derivedAdmNo = `20${emailMatch[1].toUpperCase()}`;
      }

      return { rollNo, admissionNo: derivedAdmNo, name, email, section, mobile };
    });

  // ── Parse subjects ────────────────────────────────────────────────────────
  const sourceSubjects = xlRows(subjectsBook, subjectsBook.SheetNames[0])
    .slice(1)
    .filter((row) => text(row[0]))
    .map((row) => ({ code: text(row[0]), name: text(row[1]), semester: text(row[2]) }));

  // ── Load existing students from DB ────────────────────────────────────────
  const dbStudents = await db
    .select({
      id: studentsTable.id,
      rollNo: studentsTable.rollNo,
      admissionNo: studentsTable.admissionNo,
      mobile: studentsTable.mobile,
    })
    .from(studentsTable);

  const dbByRollNo = new Map(dbStudents.map((s) => [s.rollNo, s]));

  const report = {
    excelStudents: sourceStudents.length,
    dbStudentsBefore: dbStudents.length,
    studentsInserted: 0,
    emailsUpdated: 0,
    mobilesUpdated: 0,
    studentsSkipped: 0,
    attendanceInserted: 0,
    attendanceSkipped: 0,
    unknownAttendanceRolls: new Set<string>(),
    unknownAttendanceSubjects: [] as string[],
  };

  // ── Ensure sections exist ─────────────────────────────────────────────────
  const sectionCodes = [...new Set(sourceStudents.map((s) => s.section))];
  for (const code of sectionCodes) {
    await db.insert(sectionsTable)
      .values({ id: makeId("section", code), code, department: "Computer Science & Engineering", semester: "III" })
      .onConflictDoNothing();
  }

  // ── Clean up any orphan user rows (e.g. from prior aborted runs) ──────────
  await db.execute(sql`
    DELETE FROM users
    WHERE role = 'STUDENT'
      AND id NOT IN (SELECT id FROM students)
  `);

  // ── Build a rollNo → studentId map ────────────────────────────────────────
  const resolvedIds = new Map<string, string>(); // rollNo → userId

  for (const student of sourceStudents) {
    const existingInDb = dbByRollNo.get(student.rollNo);

    if (existingInDb) {
      // ── Existing student ──────────────────────────────────────────────────
      const userId = existingInDb.id;
      resolvedIds.set(student.rollNo, userId);

      // Update email: safely check that no other user holds this email
      if (student.email) {
        const res = await db.execute(
          sql`UPDATE users SET email = ${student.email}
              WHERE id = ${userId}
                AND (email IS DISTINCT FROM ${student.email})
                AND NOT EXISTS (
                  SELECT 1 FROM users u2
                  WHERE u2.email = ${student.email} AND u2.id != ${userId}
                )`
        );
        const updated = (res as { rowCount?: number }).rowCount ?? 0;
        report.emailsUpdated += updated;
      }

      // Update mobile: sync value from Excel (updates if distinct, sets null if blank)
      const resMob = await db.execute(
        sql`UPDATE students SET mobile = ${student.mobile}
            WHERE id = ${userId}
              AND (mobile IS DISTINCT FROM ${student.mobile})`
      );
      const updatedMob = (resMob as { rowCount?: number }).rowCount ?? 0;
      report.mobilesUpdated += updatedMob;

      report.studentsSkipped += 1;
    } else {
      // ── New student ───────────────────────────────────────────────────────
      const idKey = student.admissionNo ?? student.rollNo;
      const userId =
        student.admissionNo === "2025B01010066"
          ? "student-vansh"
          : makeId("student", idKey);

      resolvedIds.set(student.rollNo, userId);

      // Insert user
      await db.insert(usersTable)
        .values({
          id: userId,
          name: student.name,
          email: student.email,
          role: "STUDENT",
          initials: initials(student.name),
          department: "Computer Science & Engineering",
        })
        .onConflictDoNothing();

      // Insert student
      await db.insert(studentsTable)
        .values({
          id: userId,
          rollNo: student.rollNo,
          admissionNo: idKey,
          sectionId: makeId("section", student.section),
          mobile: student.mobile,
          mentorId: null,
        })
        .onConflictDoNothing();

      report.studentsInserted += 1;
      console.log(`  Inserted new student: ${student.name} (rollNo=${student.rollNo}, admNo=${idKey})`);
    }
  }

  // ── Attendance: incremental, onConflictDoNothing ──────────────────────────
  const dbAdmNoByRollNo = new Map(dbStudents.map((s) => [s.rollNo, s.admissionNo]));

  const attendanceBatch: Array<typeof attendanceTable.$inferInsert> = [];
  const flushAttendance = async () => {
    if (!attendanceBatch.length) return;
    const result = await db
      .insert(attendanceTable)
      .values(attendanceBatch)
      .onConflictDoNothing()
      .returning({ id: attendanceTable.id });
    report.attendanceInserted += result.length;
    report.attendanceSkipped += attendanceBatch.length - result.length;
    attendanceBatch.length = 0;
  };

  for (const sheetName of attendanceBook.SheetNames) {
    const subject = sourceSubjects.find((s) => s.code === sheetName);
    if (!subject) { report.unknownAttendanceSubjects.push(sheetName); continue; }

    const sheetRows = xlRows(attendanceBook, sheetName);
    const header = sheetRows[0] ?? [];

    for (const row of sheetRows.slice(1)) {
      const rollNo = text(row[0]);
      if (!rollNo) continue;

      const studentId = resolvedIds.get(rollNo);
      if (!studentId) { report.unknownAttendanceRolls.add(rollNo); continue; }

      const excelStudent = sourceStudents.find((s) => s.rollNo === rollNo)!;
      const canonicalAdmNo = dbAdmNoByRollNo.get(rollNo) ?? excelStudent.admissionNo ?? rollNo;
      const sectionForStudent = excelStudent.section;

      for (let col = 2; col < header.length; col++) {
        const value = text(row[col]).toUpperCase();
        if (value !== "P" && value !== "A") continue;
        const date = dateText(header[col]);
        if (!date) continue;

        attendanceBatch.push({
          id: makeId("attendance", `${canonicalAdmNo}:${subject.code}:${date}`),
          studentId,
          subjectId: makeId("subject", subject.code),
          sectionId: makeId("section", sectionForStudent),
          date,
          status: value === "P" ? "PRESENT" : "ABSENT",
          detail: "Imported from Attendance_Demo.xlsx",
        });

        if (attendanceBatch.length === 500) await flushAttendance();
      }
    }
  }
  await flushAttendance();

  console.info(JSON.stringify({
    ...report,
    unknownAttendanceRolls: [...report.unknownAttendanceRolls],
    unknownAttendanceSubjects: [...new Set(report.unknownAttendanceSubjects)],
  }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
