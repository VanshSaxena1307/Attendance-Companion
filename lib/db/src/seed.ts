import crypto from "node:crypto";
import path from "node:path";
import * as XLSX from "xlsx";
import { db, attendanceTable, sectionsTable, studentsTable, subjectsTable, teacherSubjectSectionsTable, teachersTable, usersTable } from "./index";

const dataDir = process.env.SEED_DATA_DIR ?? path.resolve(process.cwd(), "../../data/seed");
const id = (prefix: string, value: string) => `${prefix}-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
const text = (value: unknown) => value == null ? "" : String(value).trim();
const sectionCode = (value: unknown) => text(value).replace(/[\s-]/g, "").toUpperCase();
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 4).toUpperCase() || "ST";
const subjectType = (name: string) => /\blab\b/i.test(name) ? "LAB" : "THEORY";
const canonical = (name: string) => name.toLowerCase().replace(/applications?/g, "application").replace(/[^a-z0-9]/g, "");
const rows = (book: XLSX.WorkBook, sheet: string) => XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1, raw: true, defval: "" });
const dateText = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return XLSX.SSF.format("yyyy-mm-dd", value);
  return text(value).slice(0, 10);
};

async function main() {
  const studentsBook = XLSX.readFile(path.join(dataDir, "student_combined_data.xlsx"), { cellDates: true });
  const subjectsBook = XLSX.readFile(path.join(dataDir, "subject_clean.xlsx"), { cellDates: true });
  const attendanceBook = XLSX.readFile(path.join(dataDir, "Attendance_Demo (1).xlsx"), { cellDates: true });
  const teachersBook = XLSX.readFile(path.join(dataDir, "mentor_subjectwise_final.xlsx"), { cellDates: true });
  const studentRows = rows(studentsBook, studentsBook.SheetNames[0]).slice(3).filter((row) => text(row[1]));
  const subjectRows = rows(subjectsBook, subjectsBook.SheetNames[0]).slice(1).filter((row) => text(row[0]));
  const mappingRows = rows(teachersBook, "Teacher Subject Mapping").slice(1).filter((row) => text(row[0]));
  const sourceSubjects = subjectRows.map((row) => ({ code: text(row[0]), name: text(row[1]), semester: text(row[2]) }));
  const sourceStudents = studentRows.map((row) => ({ rollNo: text(row[1]), admissionNo: text(row[2]), name: text(row[3]), section: sectionCode(row[4]) }));
  const knownRolls = new Set(sourceStudents.map((student) => student.rollNo));
  const sections = [...new Set(sourceStudents.map((student) => student.section))];
  const subjectByName = new Map(sourceSubjects.map((subject) => [canonical(subject.name), subject]));
  const studentByRoll = new Map(sourceStudents.map((student) => [student.rollNo, student]));
  const report = { students: sourceStudents.length, subjects: sourceSubjects.length, mappings: mappingRows.length, attendance: 0, unknownAttendanceRolls: new Set<string>(), unknownAttendanceSubjects: [] as string[], unmatchedTeacherSubjects: [] as string[] };

  for (const code of sections) await db.insert(sectionsTable).values({ id: id("section", code), code, department: "Computer Science & Engineering", semester: "III" }).onConflictDoNothing();
  for (const student of sourceStudents) {
    const userId = student.admissionNo === "2025B01010066" ? "student-vansh" : id("student", student.admissionNo);
    await db.insert(usersTable).values({ id: userId, name: student.name, email: null, role: "STUDENT", initials: initials(student.name), department: "Computer Science & Engineering" }).onConflictDoNothing();
    await db.insert(studentsTable).values({ id: userId, rollNo: student.rollNo, admissionNo: student.admissionNo, sectionId: id("section", student.section), mobile: null, mentorId: null }).onConflictDoNothing();
  }
  for (const subject of sourceSubjects) await db.insert(subjectsTable).values({ id: id("subject", subject.code), code: subject.code, name: subject.name, semester: subject.semester, subjectType: subjectType(subject.name), teacher: null, color: "#5B6EE1" }).onConflictDoNothing();
  for (const row of mappingRows) {
    const teacherCode = text(row[0]); const teacherName = text(row[1]); const teacherId = id("teacher", teacherCode); const mapped = subjectByName.get(canonical(text(row[5])));
    if (!mapped) { report.unmatchedTeacherSubjects.push(text(row[5])); continue; }
    const code = sectionCode(row[4]);
    await db.insert(sectionsTable).values({ id: id("section", code), code, department: "Computer Science & Engineering", semester: "III" }).onConflictDoNothing();
    await db.insert(usersTable).values({ id: teacherId, name: teacherName, email: text(row[2]) || null, role: "MENTOR", initials: initials(teacherName), department: "Computer Science & Engineering" }).onConflictDoNothing();
    await db.insert(teachersTable).values({ id: teacherId, teacherCode, mobile: text(row[3]) || null }).onConflictDoNothing();
    await db.insert(teacherSubjectSectionsTable).values({ id: id("assignment", `${teacherCode}:${mapped.code}:${code}:${text(row[6]).toUpperCase()}`), teacherId, subjectId: id("subject", mapped.code), sectionId: id("section", code), subjectType: text(row[6]).toUpperCase() }).onConflictDoNothing();
  }
  for (const code of attendanceBook.SheetNames) {
    const subject = sourceSubjects.find((entry) => entry.code === code);
    if (!subject) { report.unknownAttendanceSubjects.push(code); continue; }
    const sheetRows = rows(attendanceBook, code); const header = sheetRows[0] ?? [];
    for (const row of sheetRows.slice(1)) {
      const student = studentByRoll.get(text(row[0]));
      if (!student) { if (text(row[0])) report.unknownAttendanceRolls.add(text(row[0])); continue; }
      for (let column = 2; column < header.length; column += 1) {
        const value = text(row[column]).toUpperCase(); if (value !== "P" && value !== "A") continue;
        const date = dateText(header[column]); if (!date) continue;
        const studentId = student.admissionNo === "2025B01010066" ? "student-vansh" : id("student", student.admissionNo);
        await db.insert(attendanceTable).values({ id: id("attendance", `${student.admissionNo}:${subject.code}:${date}`), studentId, subjectId: id("subject", subject.code), sectionId: id("section", student.section), date, status: value === "P" ? "PRESENT" : "ABSENT", detail: "Imported from Attendance_Demo (1).xlsx" }).onConflictDoNothing();
        report.attendance += 1;
      }
    }
  }
  console.info(JSON.stringify({ ...report, unknownAttendanceRolls: [...report.unknownAttendanceRolls], unmatchedTeacherSubjects: [...new Set(report.unmatchedTeacherSubjects)] }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
