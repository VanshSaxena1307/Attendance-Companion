import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  attendanceTable,
  db,
  sectionsTable,
  studentsTable,
  subjectsTable,
  teachersTable,
  timetablesTable,
  timetableEntriesTable,
  usersTable,
} from "@workspace/db";

export type StudentScheduleContext = {
  id: string;
  name: string;
  rollNo: string;
  admissionNo: string;
  sectionId: string;
  sectionCode: string;
  labBatch: string | null;
  pythonBatch: string | null;
  cloudBatch: string | null;
};

export type MentorScheduleContext = {
  id: string;
  teacherCode: string;
  name: string;
  email: string | null;
  initials: string;
};

export type StudentLectureAttendanceStatus =
  | "ATTENDANCE_UPLOADED_PRESENT"
  | "ATTENDANCE_UPLOADED_ABSENT"
  | "ATTENDANCE_UPLOADED_EXEMPTED"
  | "ATTENDANCE_UPLOADED_LATE"
  | "ATTENDANCE_NOT_UPLOADED"
  | "ATTENDANCE_NOT_APPLICABLE";

export type MentorLectureAttendanceStatus =
  | "ATTENDANCE_MARKED"
  | "ATTENDANCE_NOT_MARKED"
  | "ATTENDANCE_NOT_APPLICABLE";

export type ClassState = "UPCOMING" | "IN_PROGRESS" | "COMPLETED";

export type StudentScheduledLecture = {
  timetableEntryId: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherInitials: string | null;
  room: string;
  batchType: string;
  batch: string;
  lectureType: string;
  attendanceStatus: StudentLectureAttendanceStatus;
  classState: ClassState;
};

export type MentorScheduledLecture = {
  timetableEntryId: string;
  section: string;
  sectionId: string;
  day: string;
  startTime: string;
  endTime: string;
  subjectId: string | null;
  subjectCode: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  teacherInitials: string | null;
  room: string;
  batchType: string;
  batch: string;
  lectureType: string;
  attendanceStatus: MentorLectureAttendanceStatus;
  classState: ClassState;
  enrolledStudentsCount: number;
  markedStudentsCount: number;
};

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDayOfWeekFromDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return days[date.getUTCDay()];
}

export function getLectureState(startTime: string, endTime: string, queryDateStr: string, now = new Date()): ClassState {
  const todayStr = getLocalDateString(now);
  if (queryDateStr < todayStr) return "COMPLETED";
  if (queryDateStr > todayStr) return "UPCOMING";

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (currentMinutes < startMinutes) return "UPCOMING";
  if (currentMinutes <= endMinutes) return "IN_PROGRESS";
  return "COMPLETED";
}

export async function getStudentScheduleContext(studentId: string): Promise<StudentScheduleContext | undefined> {
  const [row] = await db
    .select({
      id: studentsTable.id,
      name: usersTable.name,
      rollNo: studentsTable.rollNo,
      admissionNo: studentsTable.admissionNo,
      sectionId: studentsTable.sectionId,
      sectionCode: sectionsTable.code,
      labBatch: studentsTable.labBatch,
      pythonBatch: studentsTable.pythonBatch,
      cloudBatch: studentsTable.cloudBatch,
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(usersTable.id, studentsTable.id))
    .innerJoin(sectionsTable, eq(sectionsTable.id, studentsTable.sectionId))
    .where(eq(studentsTable.id, studentId));

  return row;
}

export async function getMentorScheduleContext(mentorId: string): Promise<MentorScheduleContext | undefined> {
  const [row] = await db
    .select({
      id: teachersTable.id,
      teacherCode: teachersTable.teacherCode,
      name: usersTable.name,
      email: usersTable.email,
      initials: usersTable.initials,
    })
    .from(teachersTable)
    .innerJoin(usersTable, eq(usersTable.id, teachersTable.id))
    .where(eq(teachersTable.id, mentorId));

  return row;
}

export async function getStudentSchedule(
  studentId: string,
  targetDate?: string,
  currentTime?: Date
): Promise<{
  date: string;
  day: string;
  student: StudentScheduleContext;
  lectures: StudentScheduledLecture[];
} | undefined> {
  const student = await getStudentScheduleContext(studentId);
  if (!student) return undefined;

  const dateStr = targetDate || getLocalDateString(currentTime);
  const dayOfWeek = getDayOfWeekFromDate(dateStr);

  // Active timetable for the student's section within effective date range
  let [activeTimetable] = await db
    .select()
    .from(timetablesTable)
    .where(
      and(
        eq(timetablesTable.sectionId, student.sectionId),
        eq(timetablesTable.status, "ACTIVE"),
        lte(timetablesTable.effectiveFrom, dateStr),
        or(
          isNull(timetablesTable.effectiveTo),
          gte(timetablesTable.effectiveTo, dateStr)
        )
      )
    )
    .orderBy(desc(timetablesTable.effectiveFrom))
    .limit(1);

  // Fallback: if no timetable matches effective date range, pick latest ACTIVE timetable
  if (!activeTimetable) {
    [activeTimetable] = await db
      .select()
      .from(timetablesTable)
      .where(
        and(
          eq(timetablesTable.sectionId, student.sectionId),
          eq(timetablesTable.status, "ACTIVE")
        )
      )
      .orderBy(desc(timetablesTable.effectiveFrom))
      .limit(1);
  }

  if (!activeTimetable) {
    return {
      date: dateStr,
      day: dayOfWeek,
      student,
      lectures: [],
    };
  }

  // Fetch entries for this timetable and day
  const entries = await db
    .select()
    .from(timetableEntriesTable)
    .where(
      and(
        eq(timetableEntriesTable.timetableId, activeTimetable.id),
        eq(timetableEntriesTable.dayOfWeek, dayOfWeek)
      )
    )
    .orderBy(asc(timetableEntriesTable.startTime));

  // Batch-match filter for the student
  const filteredEntries = entries.filter((entry) => {
    if (entry.batchType === "ALL") return true;
    if (entry.batchType === "LAB") {
      return student.labBatch != null && entry.batch === student.labBatch;
    }
    if (entry.batchType === "PYTHON") {
      return student.pythonBatch != null && entry.batch === student.pythonBatch;
    }
    if (entry.batchType === "CLOUD") {
      return student.cloudBatch != null && entry.batch === student.cloudBatch;
    }
    return false;
  });

  // Query student's attendance records on dateStr
  const attendanceRecords = await db
    .select({
      subjectId: attendanceTable.subjectId,
      status: attendanceTable.status,
    })
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, studentId),
        eq(attendanceTable.date, dateStr)
      )
    );

  const attendanceBySubject = new Map<string, string>();
  for (const att of attendanceRecords) {
    attendanceBySubject.set(att.subjectId, att.status);
  }

  const lectures: StudentScheduledLecture[] = filteredEntries.map((entry) => {
    let attendanceStatus: StudentLectureAttendanceStatus = "ATTENDANCE_NOT_UPLOADED";

    if (!entry.subjectId) {
      attendanceStatus = "ATTENDANCE_NOT_APPLICABLE";
    } else {
      const recStatus = attendanceBySubject.get(entry.subjectId);
      if (recStatus === "PRESENT") {
        attendanceStatus = "ATTENDANCE_UPLOADED_PRESENT";
      } else if (recStatus === "ABSENT") {
        attendanceStatus = "ATTENDANCE_UPLOADED_ABSENT";
      } else if (recStatus === "EXEMPTED") {
        attendanceStatus = "ATTENDANCE_UPLOADED_EXEMPTED";
      } else if (recStatus === "LATE") {
        attendanceStatus = "ATTENDANCE_UPLOADED_LATE";
      } else if (recStatus) {
        attendanceStatus = "ATTENDANCE_UPLOADED_PRESENT";
      }
    }

    const classState = getLectureState(entry.startTime, entry.endTime, dateStr, currentTime);

    return {
      timetableEntryId: entry.id,
      section: student.sectionCode,
      day: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subjectId: entry.subjectId,
      subjectCode: entry.subjectCode,
      subjectName: entry.subjectName,
      teacherId: entry.teacherId,
      teacherName: entry.teacherName,
      teacherInitials: entry.teacherInitials,
      room: entry.room,
      batchType: entry.batchType,
      batch: entry.batch,
      lectureType: entry.lectureType,
      attendanceStatus,
      classState,
    };
  });

  return {
    date: dateStr,
    day: dayOfWeek,
    student,
    lectures,
  };
}

export async function getMentorSchedule(
  mentorId: string,
  targetDate?: string,
  currentTime?: Date
): Promise<{
  date: string;
  day: string;
  mentor: MentorScheduleContext;
  lectures: MentorScheduledLecture[];
} | undefined> {
  const mentor = await getMentorScheduleContext(mentorId);
  if (!mentor) return undefined;

  const dateStr = targetDate || getLocalDateString(currentTime);
  const dayOfWeek = getDayOfWeekFromDate(dateStr);

  // Find active timetables within effective date range
  let activeTimetables = await db
    .select()
    .from(timetablesTable)
    .where(
      and(
        eq(timetablesTable.status, "ACTIVE"),
        lte(timetablesTable.effectiveFrom, dateStr),
        or(
          isNull(timetablesTable.effectiveTo),
          gte(timetablesTable.effectiveTo, dateStr)
        )
      )
    );

  // Fallback: if no timetables match effective date range, pick latest ACTIVE timetables
  if (activeTimetables.length === 0) {
    activeTimetables = await db
      .select()
      .from(timetablesTable)
      .where(eq(timetablesTable.status, "ACTIVE"))
      .orderBy(desc(timetablesTable.effectiveFrom));
  }

  if (activeTimetables.length === 0) {
    return {
      date: dateStr,
      day: dayOfWeek,
      mentor,
      lectures: [],
    };
  }

  const timetableIds = activeTimetables.map((t) => t.id);

  // Fetch timetable entries assigned to this mentor on dayOfWeek across active timetables
  const entries = await db
    .select({
      entry: timetableEntriesTable,
      sectionCode: sectionsTable.code,
    })
    .from(timetableEntriesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, timetableEntriesTable.sectionId))
    .where(
      and(
        inArray(timetableEntriesTable.timetableId, timetableIds),
        eq(timetableEntriesTable.teacherId, mentorId),
        eq(timetableEntriesTable.dayOfWeek, dayOfWeek)
      )
    )
    .orderBy(asc(timetableEntriesTable.startTime));

  if (!entries.length) {
    return {
      date: dateStr,
      day: dayOfWeek,
      mentor,
      lectures: [],
    };
  }

  // Pre-fetch attendance counts and enrolled counts considering timetable batch rules
  const lectures: MentorScheduledLecture[] = [];

  for (const { entry, sectionCode } of entries) {
    let attendanceStatus: MentorLectureAttendanceStatus = "ATTENDANCE_NOT_APPLICABLE";
    let markedCount = 0;
    let enrolledCount = 0;

    let batchCondition = undefined;
    if (entry.batchType === "LAB") {
      batchCondition = eq(studentsTable.labBatch, entry.batch);
    } else if (entry.batchType === "PYTHON") {
      batchCondition = eq(studentsTable.pythonBatch, entry.batch);
    } else if (entry.batchType === "CLOUD") {
      batchCondition = eq(studentsTable.cloudBatch, entry.batch);
    }

    const enrolledWhere = batchCondition
      ? and(eq(studentsTable.sectionId, entry.sectionId), batchCondition)
      : eq(studentsTable.sectionId, entry.sectionId);

    const [enrolledRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studentsTable)
      .where(enrolledWhere);

    enrolledCount = enrolledRes?.count ?? 0;

    if (entry.subjectId) {
      const markedWhereConditions = [
        eq(attendanceTable.subjectId, entry.subjectId),
        eq(attendanceTable.sectionId, entry.sectionId),
        eq(attendanceTable.date, dateStr),
      ];
      if (batchCondition) {
        markedWhereConditions.push(batchCondition);
      }

      const [attRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceTable)
        .innerJoin(studentsTable, eq(studentsTable.id, attendanceTable.studentId))
        .where(and(...markedWhereConditions));

      markedCount = attRes?.count ?? 0;
      attendanceStatus = markedCount > 0 ? "ATTENDANCE_MARKED" : "ATTENDANCE_NOT_MARKED";
    }

    const classState = getLectureState(entry.startTime, entry.endTime, dateStr, currentTime);

    lectures.push({
      timetableEntryId: entry.id,
      section: sectionCode,
      sectionId: entry.sectionId,
      day: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      subjectId: entry.subjectId,
      subjectCode: entry.subjectCode,
      subjectName: entry.subjectName,
      teacherId: entry.teacherId,
      teacherName: entry.teacherName,
      teacherInitials: entry.teacherInitials,
      room: entry.room,
      batchType: entry.batchType,
      batch: entry.batch,
      lectureType: entry.lectureType,
      attendanceStatus,
      classState,
      enrolledStudentsCount: enrolledCount,
      markedStudentsCount: markedCount,
    });
  }

  return {
    date: dateStr,
    day: dayOfWeek,
    mentor,
    lectures,
  };
}
