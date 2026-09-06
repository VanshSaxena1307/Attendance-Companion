import crypto from "node:crypto";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { attendanceTable, db, sectionsTable, studentsTable, subjectsTable, teacherSubjectSectionsTable, teachersTable, usersTable } from "@workspace/db";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "EXEMPTED" | "LATE" | "NOT_MARKED";

type StudentContext = { id: string; name: string; rollNo: string; sectionId: string; section: string };

const riskFor = (percentage: number, target: number) => percentage < target - 5 ? "CRITICAL" : percentage < target + 5 ? "WARNING" : "SAFE";
const percentageFor = (present: number, total: number) => total ? Math.round((present / total) * 1000) / 10 : 0;
const isPresent = (status: string) => status === "PRESENT" || status === "LATE" || status === "EXEMPTED";

async function studentContext(studentId: string): Promise<StudentContext | undefined> {
  const [student] = await db.select({ id: studentsTable.id, name: usersTable.name, rollNo: studentsTable.rollNo, sectionId: studentsTable.sectionId, section: sectionsTable.code })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
    .where(eq(studentsTable.id, studentId));
  return student;
}

async function teacherNamesBySubject(sectionId: string): Promise<Map<string, string>> {
  const assignments = await db.select({ subjectId: teacherSubjectSectionsTable.subjectId, name: usersTable.name })
    .from(teacherSubjectSectionsTable)
    .innerJoin(teachersTable, eq(teachersTable.id, teacherSubjectSectionsTable.teacherId))
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(eq(teacherSubjectSectionsTable.sectionId, sectionId));
  const names = new Map<string, Set<string>>();
  for (const assignment of assignments) names.set(assignment.subjectId, (names.get(assignment.subjectId) ?? new Set()).add(assignment.name));
  return new Map([...names].map(([subjectId, values]) => [subjectId, [...values].sort().join(", ")]));
}

export async function getSubjectAttendance(studentId: string, target: number) {
  const student = await studentContext(studentId);
  if (!student) return [];
  const [subjects, records, teacherNames] = await Promise.all([
    db.select().from(subjectsTable).orderBy(asc(subjectsTable.code)),
    db.select({ subjectId: attendanceTable.subjectId, status: attendanceTable.status }).from(attendanceTable).where(eq(attendanceTable.studentId, studentId)),
    teacherNamesBySubject(student.sectionId),
  ]);
  const totals = new Map<string, { present: number; total: number }>();
  for (const record of records) {
    const metric = totals.get(record.subjectId) ?? { present: 0, total: 0 };
    metric.total += 1;
    if (isPresent(record.status)) metric.present += 1;
    totals.set(record.subjectId, metric);
  }
  return subjects.map((subject) => {
    const metric = totals.get(subject.id) ?? { present: 0, total: 0 };
    const percentage = percentageFor(metric.present, metric.total);
    return { id: subject.id, code: subject.code, name: subject.name, teacher: teacherNames.get(subject.id) ?? "", color: subject.color, percentage, status: riskFor(percentage, target), present: metric.present, total: metric.total, target };
  });
}

export async function getAttendanceHistory(studentId: string, filters: { subject?: string; status?: AttendanceStatus; from?: string; to?: string }) {
  const conditions = [eq(attendanceTable.studentId, studentId)];
  if (filters.subject) conditions.push(eq(attendanceTable.subjectId, filters.subject));
  if (filters.status) conditions.push(eq(attendanceTable.status, filters.status));
  if (filters.from) conditions.push(gte(attendanceTable.date, filters.from));
  if (filters.to) conditions.push(lte(attendanceTable.date, filters.to));
  return db.select({ date: attendanceTable.date, subjectId: subjectsTable.id, subjectName: subjectsTable.name, subjectCode: subjectsTable.code, status: attendanceTable.status, detail: attendanceTable.detail })
    .from(attendanceTable)
    .innerJoin(subjectsTable, eq(subjectsTable.id, attendanceTable.subjectId))
    .where(and(...conditions))
    .orderBy(desc(attendanceTable.date));
}

export async function getAttendanceTrend(studentId: string) {
  const records = await db.select({ date: attendanceTable.date, status: attendanceTable.status })
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, studentId))
    .orderBy(asc(attendanceTable.date));
  let present = 0;
  let total = 0;
  const points = new Map<string, { present: number; total: number }>();
  for (const record of records) {
    total += 1;
    if (isPresent(record.status)) present += 1;
    points.set(record.date, { present, total });
  }
  return [...points].map(([date, metric]) => ({ label: new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`)), percentage: percentageFor(metric.present, metric.total) }));
}

export async function getAttendanceMetrics(studentId: string, target: number) {
  const records = await db.select({ status: attendanceTable.status }).from(attendanceTable).where(eq(attendanceTable.studentId, studentId));
  const present = records.filter((record) => isPresent(record.status)).length;
  const absent = records.filter((record) => record.status === "ABSENT").length;
  const exempted = records.filter((record) => record.status === "EXEMPTED").length;
  const late = records.filter((record) => record.status === "LATE").length;
  const total = records.length;
  const percentage = percentageFor(present, total);
  return { overall: { percentage, status: riskFor(percentage, target), present, total, target }, totals: { present, absent, exempted, late, total }, subjects: await getSubjectAttendance(studentId, target) };
}

export async function getStudentSummaries(target: number) {
  const [students, attendance] = await Promise.all([
    db.select({ id: studentsTable.id, name: usersTable.name, rollNo: studentsTable.rollNo, section: sectionsTable.code, branch: sectionsTable.department }).from(studentsTable).innerJoin(usersTable, eq(usersTable.id, studentsTable.id)).innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId)).orderBy(asc(studentsTable.rollNo)),
    db.select({ studentId: attendanceTable.studentId, status: attendanceTable.status }).from(attendanceTable),
  ]);
  const metrics = new Map<string, { present: number; total: number }>();
  for (const record of attendance) {
    const metric = metrics.get(record.studentId) ?? { present: 0, total: 0 };
    metric.total += 1;
    if (isPresent(record.status)) metric.present += 1;
    metrics.set(record.studentId, metric);
  }
  return students.map((student) => {
    const metric = metrics.get(student.id) ?? { present: 0, total: 0 };
    const percentage = percentageFor(metric.present, metric.total);
    return { ...student, percentage, status: riskFor(percentage, target) };
  });
}

export async function getStudentContext(studentId: string) {
  return studentContext(studentId);
}

export class TeacherInputError extends Error {}

export async function findDevelopmentMentor(teacherCode: string, mobile: string) {
  const [teacher] = await db.select({ id: teachersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, initials: usersTable.initials, department: usersTable.department, mobile: teachersTable.mobile })
    .from(teachersTable)
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(eq(teachersTable.teacherCode, teacherCode.trim().toUpperCase()));
  if (!teacher || teacher.role !== "MENTOR" || teacher.mobile?.replace(/\D/g, "") !== mobile.replace(/\D/g, "")) return undefined;
  return { id: teacher.id, name: teacher.name, email: teacher.email ?? "", role: "MENTOR" as const, initials: teacher.initials, department: teacher.department };
}

export async function findDevelopmentStudent(admissionNo: string, mobile: string) {
  const normalizedAdmissionNo = admissionNo?.trim().toUpperCase();
  const normalizedMobile = mobile?.replace(/\D/g, "");
  if (!normalizedAdmissionNo || !normalizedMobile) return undefined;

  const [student] = await db.select({
    id: studentsTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    initials: usersTable.initials,
    department: usersTable.department,
    mobile: studentsTable.mobile,
  })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .where(eq(studentsTable.admissionNo, normalizedAdmissionNo));

  if (!student || student.role !== "STUDENT") return undefined;
  const dbMobile = student.mobile?.replace(/\D/g, "");
  if (!dbMobile || dbMobile !== normalizedMobile) return undefined;

  return {
    id: student.id,
    name: student.name,
    email: student.email ?? "",
    role: "STUDENT" as const,
    initials: student.initials,
    department: student.department,
  };
}


export async function getTeacherAssignments(teacherId: string) {
  return db.select({ subjectId: subjectsTable.id, subjectCode: subjectsTable.code, subjectName: subjectsTable.name, sectionId: sectionsTable.id, sectionCode: sectionsTable.code, subjectType: teacherSubjectSectionsTable.subjectType })
    .from(teacherSubjectSectionsTable)
    .innerJoin(subjectsTable, eq(subjectsTable.id, teacherSubjectSectionsTable.subjectId))
    .innerJoin(sectionsTable, eq(sectionsTable.id, teacherSubjectSectionsTable.sectionId))
    .where(eq(teacherSubjectSectionsTable.teacherId, teacherId))
    .orderBy(asc(sectionsTable.code), asc(subjectsTable.code));
}

async function teacherAssignment(teacherId: string, subjectId: string, sectionId: string) {
  const [assignment] = await db.select({ teacherName: usersTable.name })
    .from(teacherSubjectSectionsTable)
    .innerJoin(teachersTable, eq(teachersTable.id, teacherSubjectSectionsTable.teacherId))
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(and(eq(teacherSubjectSectionsTable.teacherId, teacherId), eq(teacherSubjectSectionsTable.subjectId, subjectId), eq(teacherSubjectSectionsTable.sectionId, sectionId)));
  return assignment;
}

export async function getTeacherStudents(teacherId: string, subjectId: string, sectionId: string) {
  if (!await teacherAssignment(teacherId, subjectId, sectionId)) return undefined;
  return db.select({ id: studentsTable.id, name: usersTable.name, rollNo: studentsTable.rollNo, admissionNo: studentsTable.admissionNo })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .where(eq(studentsTable.sectionId, sectionId))
    .orderBy(asc(studentsTable.rollNo));
}

export async function getTeacherAttendance(teacherId: string, subjectId: string, sectionId: string, date: string) {
  if (!await teacherAssignment(teacherId, subjectId, sectionId)) return undefined;
  return db.select({ studentId: attendanceTable.studentId, status: attendanceTable.status, markedAt: attendanceTable.markedAt })
    .from(attendanceTable)
    .where(and(eq(attendanceTable.subjectId, subjectId), eq(attendanceTable.sectionId, sectionId), eq(attendanceTable.date, date)))
    .orderBy(asc(attendanceTable.studentId));
}

export async function submitTeacherAttendance(teacherId: string, input: { subjectId: string; sectionId: string; date: string; attendance: Array<{ studentId: string; status: "PRESENT" | "ABSENT" }> }) {
  const assignment = await teacherAssignment(teacherId, input.subjectId, input.sectionId);
  if (!assignment) return undefined;
  const students = await db.select({ id: studentsTable.id, admissionNo: studentsTable.admissionNo }).from(studentsTable).where(eq(studentsTable.sectionId, input.sectionId));
  const enrolled = new Set(students.map((student) => student.id));
  const submitted = new Set(input.attendance.map((record) => record.studentId));
  if (submitted.size !== input.attendance.length || submitted.size !== enrolled.size || [...submitted].some((studentId) => !enrolled.has(studentId))) throw new TeacherInputError("Attendance must include every enrolled student exactly once.");
  const admissions = new Map(students.map((student) => [student.id, student.admissionNo]));
  const markedAt = new Date();
  await db.insert(attendanceTable).values(input.attendance.map((record) => ({
    id: `attendance-${crypto.createHash("sha1").update(`${admissions.get(record.studentId)}:${input.subjectId}:${input.date}`).digest("hex").slice(0, 16)}`,
    studentId: record.studentId, subjectId: input.subjectId, sectionId: input.sectionId, date: input.date, status: record.status,
    detail: `Marked by ${assignment.teacherName}`, markedBy: teacherId, markedAt,
  }))).onConflictDoUpdate({ target: [attendanceTable.studentId, attendanceTable.subjectId, attendanceTable.date], set: { status: sql`excluded.status`, sectionId: sql`excluded.section_id`, detail: sql`excluded.detail`, markedBy: teacherId, markedAt } });
  return getTeacherAttendance(teacherId, input.subjectId, input.sectionId, input.date);
}
