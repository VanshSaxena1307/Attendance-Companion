import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  attendanceTable,
  db,
  lectureInstancesTable,
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
  lectureInstanceId: string | null;
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
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
};

export type MentorScheduledLecture = {
  timetableEntryId: string;
  lectureInstanceId: string | null;
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
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  notes?: string | null;
};

export const COLLEGE_TIMEZONE = "Asia/Kolkata";

export function getLocalDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COLLEGE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getDayOfWeekFromDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return days[date.getUTCDay()];
}

export function getLectureState(startTime: string, endTime: string, queryDateStr: string, now: Date = new Date()): ClassState {
  const todayStr = getLocalDateString(now);
  if (queryDateStr < todayStr) return "COMPLETED";
  if (queryDateStr > todayStr) return "UPCOMING";

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: COLLEGE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hStr, mStr] = timeFormatter.format(now).split(":");
  const currentMinutes = (parseInt(hStr, 10) % 24) * 60 + parseInt(mStr, 10);

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

  // Query existing lecture instances on dateStr
  const instanceRows = await db
    .select()
    .from(lectureInstancesTable)
    .where(
      and(
        eq(lectureInstancesTable.sectionId, student.sectionId),
        eq(lectureInstancesTable.date, dateStr)
      )
    );
  const instanceByTimetableEntry = new Map<string, typeof lectureInstancesTable.$inferSelect>();
  for (const inst of instanceRows) {
    if (inst.timetableEntryId) {
      instanceByTimetableEntry.set(inst.timetableEntryId, inst);
    }
  }

  // Query student's attendance records on dateStr
  const attendanceRecords = await db
    .select({
      lectureInstanceId: attendanceTable.lectureInstanceId,
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

  const attendanceByInstance = new Map<string, string>();
  const attendanceBySubjectLegacy = new Map<string, string>();
  for (const att of attendanceRecords) {
    if (att.lectureInstanceId) {
      attendanceByInstance.set(att.lectureInstanceId, att.status);
    } else {
      attendanceBySubjectLegacy.set(att.subjectId, att.status);
    }
  }

  const lectures: StudentScheduledLecture[] = filteredEntries.map((entry) => {
    const instance = instanceByTimetableEntry.get(entry.id);
    let attendanceStatus: StudentLectureAttendanceStatus = "ATTENDANCE_NOT_UPLOADED";

    if (!entry.subjectId) {
      attendanceStatus = "ATTENDANCE_NOT_APPLICABLE";
    } else {
      // First check match by lecture_instance_id
      let recStatus: string | undefined;
      if (instance && attendanceByInstance.has(instance.id)) {
        recStatus = attendanceByInstance.get(instance.id);
      } else if (!instance || instance.attendanceStatus === "UNMARKED") {
        // Fall back safely to legacy subject attendance where instance not linked
        recStatus = attendanceBySubjectLegacy.get(entry.subjectId);
      }

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
      lectureInstanceId: instance?.id || null,
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
      status: (instance?.status as "SCHEDULED" | "COMPLETED" | "CANCELLED") || "SCHEDULED",
      notes: instance?.notes || null,
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

    const [instance] = await db
      .select()
      .from(lectureInstancesTable)
      .where(
        and(
          eq(lectureInstancesTable.timetableEntryId, entry.id),
          eq(lectureInstancesTable.date, dateStr)
        )
      );

    if (instance) {
      const [attRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceTable)
        .where(eq(attendanceTable.lectureInstanceId, instance.id));

      markedCount = attRes?.count ?? 0;
      attendanceStatus = (markedCount > 0 || instance.attendanceStatus === "MARKED")
        ? "ATTENDANCE_MARKED"
        : "ATTENDANCE_NOT_MARKED";
    } else if (entry.subjectId) {
      const markedWhereConditions = [
        eq(attendanceTable.subjectId, entry.subjectId),
        eq(attendanceTable.sectionId, entry.sectionId),
        eq(attendanceTable.date, dateStr),
        sql`${attendanceTable.lectureInstanceId} IS NULL`,
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
      lectureInstanceId: instance?.id || null,
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
      status: (instance?.status as "SCHEDULED" | "COMPLETED" | "CANCELLED") || "SCHEDULED",
      notes: instance?.notes || null,
    });
  }

  return {
    date: dateStr,
    day: dayOfWeek,
    mentor,
    lectures,
  };
}

export type DepartmentScheduledLecture = {
  id: string;
  timetableEntryId: string;
  lectureInstanceId: string | null;
  section: string;
  sectionId: string;
  day: string;
  date: string;
  startTime: string;
  endTime: string;
  time: string;
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
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  attendanceStatus: "MARKED" | "PENDING";
  markedAt: string | null;
  notes: string | null;
};

export type DepartmentScheduleSummary = {
  date: string;
  day: string;
  totalScheduled: number;
  markedCount: number;
  pendingCount: number;
  cancelledCount: number;
  unexpectedHoliday: {
    active: boolean;
    date: string;
    reason: string | null;
    affectedSections: string[];
    cancelledLecturesCount: number;
  } | null;
  lectures: DepartmentScheduledLecture[];
};

export async function getDepartmentSchedule(
  targetDate?: string,
  sectionCodeFilter?: string
): Promise<DepartmentScheduleSummary> {
  const dateStr = targetDate || getLocalDateString();
  const dayOfWeek = getDayOfWeekFromDate(dateStr);

  const cleanFilter = sectionCodeFilter ? sectionCodeFilter.replace(/-/g, "").toUpperCase() : undefined;

  const activeTimetables = await db
    .select({
      id: timetablesTable.id,
      sectionId: timetablesTable.sectionId,
      sectionCode: sectionsTable.code,
    })
    .from(timetablesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, timetablesTable.sectionId))
    .where(eq(timetablesTable.status, "ACTIVE"));

  const filteredTimetables = cleanFilter
    ? activeTimetables.filter((t) => t.sectionCode.replace(/-/g, "").toUpperCase() === cleanFilter)
    : activeTimetables;

  const timetableIds = filteredTimetables.map((t) => t.id);

  if (!timetableIds.length) {
    return {
      date: dateStr,
      day: dayOfWeek,
      totalScheduled: 0,
      markedCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
      unexpectedHoliday: null,
      lectures: [],
    };
  }

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
        eq(timetableEntriesTable.dayOfWeek, dayOfWeek)
      )
    )
    .orderBy(asc(timetableEntriesTable.startTime), asc(sectionsTable.code));

  const instances = await db
    .select()
    .from(lectureInstancesTable)
    .where(eq(lectureInstancesTable.date, dateStr));

  const instanceByEntryId = new Map<string, typeof lectureInstancesTable.$inferSelect>();
  for (const inst of instances) {
    if (inst.timetableEntryId) {
      instanceByEntryId.set(inst.timetableEntryId, inst);
    }
  }

  const lectures: DepartmentScheduledLecture[] = [];
  let markedCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;
  const holidayReasons: string[] = [];
  const affectedSectionsSet = new Set<string>();

  for (const { entry, sectionCode } of entries) {
    const inst = instanceByEntryId.get(entry.id);
    const instStatus = (inst?.status as "SCHEDULED" | "COMPLETED" | "CANCELLED") || "SCHEDULED";
    const isCancelled = instStatus === "CANCELLED";

    let attendanceStatus: "MARKED" | "PENDING" = "PENDING";
    let markedAtTime: string | null = null;

    if (inst) {
      if (inst.attendanceStatus === "MARKED" || inst.status === "COMPLETED") {
        attendanceStatus = "MARKED";
        if (inst.markedAt) {
          markedAtTime = new Intl.DateTimeFormat("en-IN", {
            timeZone: COLLEGE_TIMEZONE,
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(inst.markedAt));
        }
      }
    }

    const displaySection = sectionCode.startsWith("CSE") && !sectionCode.includes("-")
      ? `CSE-${sectionCode.slice(3)}`
      : sectionCode;

    if (isCancelled) {
      cancelledCount++;
      if (inst?.notes) holidayReasons.push(inst.notes);
      affectedSectionsSet.add(displaySection);
    } else if (attendanceStatus === "MARKED") {
      markedCount++;
    } else {
      pendingCount++;
    }

    lectures.push({
      id: inst?.id || entry.id,
      timetableEntryId: entry.id,
      lectureInstanceId: inst?.id || null,
      section: displaySection,
      sectionId: entry.sectionId,
      day: entry.dayOfWeek,
      date: dateStr,
      startTime: entry.startTime,
      endTime: entry.endTime,
      time: `${entry.startTime} – ${entry.endTime}`,
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
      status: instStatus,
      attendanceStatus,
      markedAt: markedAtTime,
      notes: inst?.notes || null,
    });
  }

  const unexpectedHoliday = cancelledCount > 0 ? {
    active: true,
    date: dateStr,
    reason: holidayReasons[0]?.replace(/^Unexpected Holiday:\s*/i, "") || "Campus closed by Administrative Order",
    affectedSections: Array.from(affectedSectionsSet),
    cancelledLecturesCount: cancelledCount,
  } : null;

  return {
    date: dateStr,
    day: dayOfWeek,
    totalScheduled: entries.length,
    markedCount,
    pendingCount,
    cancelledCount,
    unexpectedHoliday,
    lectures,
  };
}

export type CancelHolidayInput = {
  date: string;
  section?: string;
  numberOfLectures?: number;
  reason: string;
};

export type CancelHolidayResult = {
  success: boolean;
  date: string;
  targetSection: string;
  reason: string;
  cancelledCount: number;
  skippedCount: number;
  cancelledInstanceIds: string[];
  skippedReasons: string[];
};

export async function cancelLecturesForHoliday(
  input: CancelHolidayInput
): Promise<CancelHolidayResult> {
  const { date, reason } = input;
  const sectionFilter = input.section && input.section !== "ALL"
    ? input.section.replace(/-/g, "").toUpperCase()
    : undefined;

  const dayOfWeek = getDayOfWeekFromDate(date);

  const activeTimetables = await db
    .select({
      id: timetablesTable.id,
      sectionId: timetablesTable.sectionId,
      sectionCode: sectionsTable.code,
    })
    .from(timetablesTable)
    .innerJoin(sectionsTable, eq(sectionsTable.id, timetablesTable.sectionId))
    .where(eq(timetablesTable.status, "ACTIVE"));

  const filteredTimetables = sectionFilter
    ? activeTimetables.filter((t) => t.sectionCode.replace(/-/g, "").toUpperCase() === sectionFilter)
    : activeTimetables;

  const timetableIds = filteredTimetables.map((t) => t.id);
  if (!timetableIds.length) {
    return {
      success: true,
      date,
      targetSection: input.section || "ALL",
      reason,
      cancelledCount: 0,
      skippedCount: 0,
      cancelledInstanceIds: [],
      skippedReasons: ["No active timetables found for specified section(s)"],
    };
  }

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
        eq(timetableEntriesTable.dayOfWeek, dayOfWeek)
      )
    )
    .orderBy(asc(timetableEntriesTable.startTime), asc(sectionsTable.code));

  const cancelledInstanceIds: string[] = [];
  const skippedReasons: string[] = [];
  let cancelledCount = 0;
  let skippedCount = 0;
  const limit = input.numberOfLectures && input.numberOfLectures > 0 ? input.numberOfLectures : Infinity;

  for (const { entry } of entries) {
    if (cancelledCount >= limit) break;

    let [inst] = await db
      .select()
      .from(lectureInstancesTable)
      .where(
        and(
          eq(lectureInstancesTable.timetableEntryId, entry.id),
          eq(lectureInstancesTable.date, date)
        )
      );

    if (!inst) {
      const instanceId = `inst_${entry.id}_${date.replace(/-/g, "")}`;
      const [created] = await db
        .insert(lectureInstancesTable)
        .values({
          id: instanceId,
          timetableEntryId: entry.id,
          sectionId: entry.sectionId,
          subjectId: entry.subjectId!,
          teacherId: entry.teacherId ?? null,
          teacherName: entry.teacherName ?? null,
          teacherInitials: entry.teacherInitials ?? null,
          date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room,
          batchType: entry.batchType,
          batch: entry.batch,
          lectureType: entry.lectureType,
          status: "SCHEDULED",
          attendanceStatus: "UNMARKED",
        })
        .onConflictDoNothing()
        .returning();

      inst = created || (await db
        .select()
        .from(lectureInstancesTable)
        .where(
          and(
            eq(lectureInstancesTable.timetableEntryId, entry.id),
            eq(lectureInstancesTable.date, date)
          )
        )
        .then((rows) => rows[0]));
    }

    if (!inst) continue;

    if (inst.attendanceStatus === "MARKED" || inst.status === "COMPLETED") {
      skippedCount++;
      skippedReasons.push(`Lecture ${entry.subjectCode || entry.id} at ${entry.startTime} has already been marked/completed.`);
      continue;
    }

    if (inst.status === "CANCELLED") {
      cancelledInstanceIds.push(inst.id);
      continue;
    }

    const holidayNote = `Unexpected Holiday: ${reason}`;
    await db
      .update(lectureInstancesTable)
      .set({
        status: "CANCELLED",
        notes: holidayNote,
      })
      .where(eq(lectureInstancesTable.id, inst.id));

    cancelledInstanceIds.push(inst.id);
    cancelledCount++;
  }

  return {
    success: true,
    date,
    targetSection: input.section || "ALL",
    reason,
    cancelledCount,
    skippedCount,
    cancelledInstanceIds,
    skippedReasons,
  };
}

export async function resetUnexpectedHoliday(
  date: string,
  section?: string
): Promise<{ success: boolean; resetCount: number }> {
  const sectionFilter = section && section !== "ALL"
    ? section.replace(/-/g, "").toUpperCase()
    : undefined;

  let whereCond = and(
    eq(lectureInstancesTable.date, date),
    eq(lectureInstancesTable.status, "CANCELLED")
  );

  if (sectionFilter) {
    const [sec] = await db
      .select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(eq(sectionsTable.code, sectionFilter));

    if (sec) {
      whereCond = and(whereCond, eq(lectureInstancesTable.sectionId, sec.id))!;
    }
  }

  const updated = await db
    .update(lectureInstancesTable)
    .set({
      status: "SCHEDULED",
      notes: null,
    })
    .where(whereCond)
    .returning({ id: lectureInstancesTable.id });

  return {
    success: true,
    resetCount: updated.length,
  };
}
