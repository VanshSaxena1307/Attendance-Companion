import { date, integer, numeric, pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  initials: text("initials").notNull(),
  department: text("department"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subjectsTable = pgTable("subjects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  teacher: text("teacher").notNull(),
  color: text("color").notNull(),
});

export const attendanceTable = pgTable("attendance", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => usersTable.id),
  subjectId: text("subject_id").notNull().references(() => subjectsTable.id),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const exemptionRequestsTable = pgTable("exemption_requests", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => usersTable.id),
  category: text("category").notNull(),
  reason: text("reason").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  proofName: text("proof_name"),
  status: text("status").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewer: text("reviewer"),
  reviewerRemarks: text("reviewer_remarks"),
});

export const attendanceIssuesTable = pgTable("attendance_issues", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => usersTable.id),
  subjectId: text("subject_id").notNull().references(() => subjectsTable.id),
  subjectName: text("subject_name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  issueType: text("issue_type").notNull(),
  description: text("description").notNull(),
  evidenceName: text("evidence_name"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewer: text("reviewer"),
  reviewerRemarks: text("reviewer_remarks"),
});

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  recipientId: text("recipient_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(),
  relatedId: text("related_id"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => usersTable.id),
  theme: text("theme").notNull().default("SYSTEM"),
  targetAttendance: numeric("target_attendance").notNull().default("75"),
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export const insertSubjectSchema = createInsertSchema(subjectsTable);
export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ createdAt: true });
export const insertExemptionSchema = createInsertSchema(exemptionRequestsTable).omit({ submittedAt: true, reviewedAt: true });
export const insertIssueSchema = createInsertSchema(attendanceIssuesTable).omit({ createdAt: true, reviewedAt: true });
export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ createdAt: true });
export const insertSettingsSchema = createInsertSchema(settingsTable);

export type User = z.infer<typeof insertUserSchema>;
export type Subject = z.infer<typeof insertSubjectSchema>;
export type Attendance = z.infer<typeof insertAttendanceSchema>;
export type ExemptionRequest = z.infer<typeof insertExemptionSchema>;
export type AttendanceIssue = z.infer<typeof insertIssueSchema>;
export type Notification = z.infer<typeof insertNotificationSchema>;
export type Settings = z.infer<typeof insertSettingsSchema>;