import { boolean, date, index, numeric, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", { id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").unique(), role: text("role").notNull(), initials: text("initials").notNull(), department: text("department"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const sectionsTable = pgTable("sections", { id: text("id").primaryKey(), code: text("code").notNull().unique(), department: text("department").notNull(), semester: text("semester") });
export const studentsTable = pgTable("students", { id: text("id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }), rollNo: text("roll_no").notNull(), admissionNo: text("admission_no").notNull(), sectionId: text("section_id").notNull().references(() => sectionsTable.id), mobile: text("mobile"), mentorId: text("mentor_id").references(() => usersTable.id), labBatch: text("lab_batch"), pythonBatch: text("python_batch"), cloudBatch: text("cloud_batch") }, (t) => [uniqueIndex("students_roll_no_unique").on(t.rollNo), uniqueIndex("students_admission_no_unique").on(t.admissionNo), index("students_section_idx").on(t.sectionId)]);
export const teachersTable = pgTable("teachers", { id: text("id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }), teacherCode: text("teacher_code").notNull().unique(), mobile: text("mobile") });
export const subjectsTable = pgTable("subjects", { id: text("id").primaryKey(), code: text("code").notNull().unique(), name: text("name").notNull(), semester: text("semester"), subjectType: text("subject_type").notNull(), teacher: text("teacher"), color: text("color").notNull().default("#5B6EE1") });
export const teacherSubjectSectionsTable = pgTable("teacher_subject_sections", { id: text("id").primaryKey(), teacherId: text("teacher_id").notNull().references(() => teachersTable.id), subjectId: text("subject_id").notNull().references(() => subjectsTable.id), sectionId: text("section_id").notNull().references(() => sectionsTable.id), subjectType: text("subject_type").notNull() }, (t) => [unique("teacher_subject_section_unique").on(t.teacherId, t.subjectId, t.sectionId, t.subjectType), index("teacher_subject_section_lookup_idx").on(t.teacherId, t.sectionId)]);
export const attendanceTable = pgTable("attendance", { id: text("id").primaryKey(), studentId: text("student_id").notNull().references(() => studentsTable.id), subjectId: text("subject_id").notNull().references(() => subjectsTable.id), sectionId: text("section_id").notNull().references(() => sectionsTable.id), date: date("date", { mode: "string" }).notNull(), status: text("status").notNull(), detail: text("detail").notNull().default("Imported from attendance workbook"), markedBy: text("marked_by").references(() => usersTable.id), markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() }, (t) => [unique("attendance_student_subject_date_unique").on(t.studentId, t.subjectId, t.date), index("attendance_student_subject_idx").on(t.studentId, t.subjectId), index("attendance_section_subject_idx").on(t.sectionId, t.subjectId)]);
export const exemptionRequestsTable = pgTable("exemption_requests", { id: text("id").primaryKey(), studentId: text("student_id").notNull().references(() => studentsTable.id), category: text("category").notNull(), reason: text("reason").notNull(), startDate: date("start_date", { mode: "string" }).notNull(), endDate: date("end_date", { mode: "string" }).notNull(), proofName: text("proof_name"), status: text("status").notNull(), submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(), reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewer: text("reviewer"), reviewerRemarks: text("reviewer_remarks") });
export const attendanceIssuesTable = pgTable("attendance_issues", { id: text("id").primaryKey(), studentId: text("student_id").notNull().references(() => studentsTable.id), subjectId: text("subject_id").notNull().references(() => subjectsTable.id), subjectName: text("subject_name").notNull(), date: date("date", { mode: "string" }).notNull(), issueType: text("issue_type").notNull(), description: text("description").notNull(), evidenceName: text("evidence_name"), status: text("status").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), reviewedAt: timestamp("reviewed_at", { withTimezone: true }), reviewer: text("reviewer"), reviewerRemarks: text("reviewer_remarks") });
export const notificationsTable = pgTable("notifications", { id: text("id").primaryKey(), recipientId: text("recipient_id").notNull().references(() => usersTable.id), title: text("title").notNull(), message: text("message").notNull(), type: text("type").notNull(), relatedId: text("related_id"), read: boolean("read").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() });
export const settingsTable = pgTable("settings", { userId: text("user_id").primaryKey().references(() => usersTable.id), theme: text("theme").notNull().default("SYSTEM"), targetAttendance: numeric("target_attendance").notNull().default("75"), notificationsEnabled: boolean("notifications_enabled").notNull().default(true) });
export const auditLogsTable = pgTable("audit_logs", { id: text("id").primaryKey(), actorId: text("actor_id").references(() => usersTable.id), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), detail: text("detail"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow() }, (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId)]);

export const timetablesTable = pgTable("timetables", {
  id: text("id").primaryKey(),
  academicSession: text("academic_session").notNull(),
  semester: text("semester").notNull(),
  sectionId: text("section_id").references(() => sectionsTable.id),
  effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
  effectiveTo: date("effective_to", { mode: "string" }),
  status: text("status").notNull().default("ACTIVE"),
  uploadedBy: text("uploaded_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("timetables_section_status_idx").on(t.sectionId, t.status),
]);

export const timetableEntriesTable = pgTable("timetable_entries", {
  id: text("id").primaryKey(),
  timetableId: text("timetable_id").notNull().references(() => timetablesTable.id, { onDelete: "cascade" }),
  sectionId: text("section_id").notNull().references(() => sectionsTable.id),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  subjectId: text("subject_id").references(() => subjectsTable.id),
  subjectCode: text("subject_code"),
  subjectName: text("subject_name"),
  teacherId: text("teacher_id").references(() => teachersTable.id),
  teacherName: text("teacher_name"),
  teacherInitials: text("teacher_initials"),
  batchType: text("batch_type").notNull(),
  batch: text("batch").notNull(),
  room: text("room").notNull(),
  lectureType: text("lecture_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("timetable_entry_slot_unique").on(t.timetableId, t.dayOfWeek, t.startTime, t.batchType, t.batch),
  index("timetable_entries_timetable_idx").on(t.timetableId),
  index("timetable_entries_section_day_idx").on(t.sectionId, t.dayOfWeek),
  index("timetable_entries_teacher_idx").on(t.teacherId),
  index("timetable_entries_subject_idx").on(t.subjectId),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true }); export const insertSubjectSchema = createInsertSchema(subjectsTable); export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ createdAt: true, markedAt: true }); export const insertExemptionSchema = createInsertSchema(exemptionRequestsTable).omit({ submittedAt: true, reviewedAt: true }); export const insertIssueSchema = createInsertSchema(attendanceIssuesTable).omit({ createdAt: true, reviewedAt: true }); export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true }); export const insertSettingsSchema = createInsertSchema(settingsTable);
export const insertTimetableSchema = createInsertSchema(timetablesTable).omit({ createdAt: true });
export const insertTimetableEntrySchema = createInsertSchema(timetableEntriesTable).omit({ createdAt: true });
export type User = z.infer<typeof insertUserSchema>; export type Subject = z.infer<typeof insertSubjectSchema>; export type Attendance = z.infer<typeof insertAttendanceSchema>; export type ExemptionRequest = z.infer<typeof insertExemptionSchema>; export type AttendanceIssue = z.infer<typeof insertIssueSchema>; export type Notification = z.infer<typeof insertNotificationSchema>; export type Settings = z.infer<typeof insertSettingsSchema>;
export type Timetable = z.infer<typeof insertTimetableSchema>;
export type TimetableEntry = z.infer<typeof insertTimetableEntrySchema>;
