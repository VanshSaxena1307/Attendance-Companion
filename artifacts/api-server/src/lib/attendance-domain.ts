import type { Request } from "express";
import crypto from "node:crypto";

export type Role = "STUDENT" | "MENTOR" | "HOD" | "ADMIN";
export type Risk = "SAFE" | "WARNING" | "CRITICAL";
export type RecordStatus = "PRESENT" | "ABSENT" | "EXEMPTED" | "LATE" | "NOT_MARKED";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  department: string | null;
};

export type AuthRole = Exclude<Role, "ADMIN">;

type Subject = {
  id: string;
  code: string;
  name: string;
  teacher: string;
  color: string;
};

type Attendance = {
  id: string;
  studentId: string;
  subjectId: string;
  date: string;
  status: RecordStatus;
  detail: string;
};

export type Exemption = {
  id: string;
  studentId: string;
  studentName: string;
  category: "MEDICAL" | "COLLEGE_EVENT" | "OFFICIAL_WORK" | "SPORTS" | "COMPETITION" | "PERSONAL" | "OTHER";
  reason: string;
  startDate: string;
  endDate: string;
  proofName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  submittedAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewerRemarks: string | null;
};

export type AttendanceIssue = {
  id: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  date: string;
  issueType: "INCORRECTLY_MARKED_ABSENT" | "INCORRECTLY_MARKED_PRESENT" | "EXEMPTION_NOT_REFLECTED" | "WRONG_ATTENDANCE_DATA" | "OTHER";
  description: string;
  evidenceName: string | null;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  reviewerRemarks: string | null;
};

export type AppNotification = {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: "SUCCESS" | "WARNING" | "INFO" | "ISSUE";
  relatedId: string | null;
  read: boolean;
  createdAt: string;
};

export type Settings = {
  theme: "LIGHT" | "DARK" | "SYSTEM";
  targetAttendance: number;
  notificationsEnabled: boolean;
};

const users: CurrentUser[] = [
  { id: "student-vansh", name: "Vansh Saxena", email: "vansh@attendance.edu", role: "STUDENT", initials: "VS", department: "Computer Science & Engineering" },
  { id: "student-aman", name: "Aman Sharma", email: "aman@attendance.edu", role: "STUDENT", initials: "AS", department: "Computer Science & Engineering" },
  { id: "mentor-priya", name: "Priya Nair", email: "priya.nair@attendance.edu", role: "MENTOR", initials: "PN", department: "Computer Science & Engineering" },
  { id: "hod-rajesh", name: "Rajesh Mehta", email: "rajesh.mehta@attendance.edu", role: "HOD", initials: "RM", department: "Computer Science & Engineering" },
  { id: "admin-office", name: "Academic Office", email: "admin@attendance.edu", role: "ADMIN", initials: "AO", department: null },
];

/**
 * Development-only identity data until the real identity store is introduced.
 * These records deliberately map only to existing domain users and are never
 * enabled in production.
 */
const developmentIdentityFixtures: Array<{
  userId: string;
  role: AuthRole;
  identifier: string;
  mobile: string;
}> = [
  { userId: "student-vansh", role: "STUDENT", identifier: "ADM2026CSE001", mobile: "9876543210" },
  { userId: "student-aman", role: "STUDENT", identifier: "ADM2026CSE002", mobile: "9876543211" },
  { userId: "mentor-priya", role: "MENTOR", identifier: "FAC-CSE-1042", mobile: "9876543212" },
  { userId: "hod-rajesh", role: "HOD", identifier: "HOD-CSE-1001", mobile: "9876543213" },
];

const activeSessions = new Map<string, { userId: string; expiresAt: number }>();

const subjects: Subject[] = [
  { id: "dsa", code: "CSE 204", name: "Data Structures", teacher: "Dr. Ananya Rao", color: "#5B6EE1" },
  { id: "maths", code: "MTH 202", name: "Engineering Mathematics", teacher: "Prof. K. Menon", color: "#4FAF8B" },
  { id: "physics", code: "PHY 201", name: "Applied Physics", teacher: "Dr. R. Iyer", color: "#D99A45" },
  { id: "electronics", code: "ECE 205", name: "Digital Electronics", teacher: "Prof. S. Gupta", color: "#9A72C7" },
];

const attendance: Attendance[] = [
  { id: "a1", studentId: "student-vansh", subjectId: "dsa", date: "2026-08-21", status: "PRESENT", detail: "Marked present by Dr. Ananya Rao" },
  { id: "a2", studentId: "student-vansh", subjectId: "maths", date: "2026-08-21", status: "PRESENT", detail: "Marked present by Prof. K. Menon" },
  { id: "a3", studentId: "student-vansh", subjectId: "physics", date: "2026-08-21", status: "EXEMPTED", detail: "Approved college event exemption" },
  { id: "a4", studentId: "student-vansh", subjectId: "electronics", date: "2026-08-21", status: "PRESENT", detail: "Marked present by Prof. S. Gupta" },
  { id: "a5", studentId: "student-vansh", subjectId: "dsa", date: "2026-08-22", status: "PRESENT", detail: "Marked present by Dr. Ananya Rao" },
  { id: "a6", studentId: "student-vansh", subjectId: "maths", date: "2026-08-22", status: "ABSENT", detail: "Marked absent by Prof. K. Menon" },
  { id: "a7", studentId: "student-vansh", subjectId: "physics", date: "2026-08-22", status: "PRESENT", detail: "Marked present by Dr. R. Iyer" },
  { id: "a8", studentId: "student-vansh", subjectId: "electronics", date: "2026-08-22", status: "PRESENT", detail: "Marked present by Prof. S. Gupta" },
  { id: "a9", studentId: "student-vansh", subjectId: "dsa", date: "2026-08-23", status: "PRESENT", detail: "Marked present by Dr. Ananya Rao" },
  { id: "a10", studentId: "student-vansh", subjectId: "maths", date: "2026-08-23", status: "PRESENT", detail: "Marked present by Prof. K. Menon" },
  { id: "a11", studentId: "student-vansh", subjectId: "physics", date: "2026-08-23", status: "PRESENT", detail: "Marked present by Dr. R. Iyer" },
  { id: "a12", studentId: "student-vansh", subjectId: "electronics", date: "2026-08-23", status: "LATE", detail: "Arrived 8 minutes after class started" },
  { id: "a13", studentId: "student-vansh", subjectId: "dsa", date: "2026-08-24", status: "ABSENT", detail: "Marked absent by Dr. Ananya Rao" },
  { id: "a14", studentId: "student-vansh", subjectId: "maths", date: "2026-08-24", status: "PRESENT", detail: "Marked present by Prof. K. Menon" },
  { id: "a15", studentId: "student-vansh", subjectId: "physics", date: "2026-08-24", status: "PRESENT", detail: "Marked present by Dr. R. Iyer" },
  { id: "a16", studentId: "student-vansh", subjectId: "electronics", date: "2026-08-24", status: "PRESENT", detail: "Marked present by Prof. S. Gupta" },
  { id: "a17", studentId: "student-aman", subjectId: "dsa", date: "2026-08-24", status: "PRESENT", detail: "Marked present by Dr. Ananya Rao" },
];

let exemptions: Exemption[] = [
  { id: "ex-1001", studentId: "student-vansh", studentName: "Vansh Saxena", category: "COLLEGE_EVENT", reason: "Represented the department at the university innovation showcase.", startDate: "2026-08-21", endDate: "2026-08-21", proofName: "innovation-showcase.pdf", status: "APPROVED", submittedAt: "2026-08-18T09:30:00.000Z", reviewedAt: "2026-08-19T13:20:00.000Z", reviewer: "Priya Nair", reviewerRemarks: "Verified with the department event coordinator." },
  { id: "ex-1002", studentId: "student-vansh", studentName: "Vansh Saxena", category: "COMPETITION", reason: "Participated in an inter-college coding competition.", startDate: "2026-08-25", endDate: "2026-08-25", proofName: "hackathon-letter.jpg", status: "PENDING", submittedAt: "2026-08-23T10:15:00.000Z", reviewedAt: null, reviewer: null, reviewerRemarks: null },
  { id: "ex-1003", studentId: "student-aman", studentName: "Aman Sharma", category: "MEDICAL", reason: "Recovery from a scheduled outpatient procedure.", startDate: "2026-08-25", endDate: "2026-08-26", proofName: "medical-note.pdf", status: "PENDING", submittedAt: "2026-08-24T08:45:00.000Z", reviewedAt: null, reviewer: null, reviewerRemarks: null },
];

let issues: AttendanceIssue[] = [
  { id: "is-2001", studentId: "student-vansh", studentName: "Vansh Saxena", subjectId: "dsa", subjectName: "Data Structures", date: "2026-08-24", issueType: "INCORRECTLY_MARKED_ABSENT", description: "I was present in the DSA class but was marked absent.", evidenceName: "class-photo.jpg", status: "UNDER_REVIEW", createdAt: "2026-08-24T15:10:00.000Z", reviewedAt: null, reviewer: "Priya Nair", reviewerRemarks: "Checking the class register with the faculty member." },
  { id: "is-2002", studentId: "student-vansh", studentName: "Vansh Saxena", subjectId: "physics", subjectName: "Applied Physics", date: "2026-08-21", issueType: "EXEMPTION_NOT_REFLECTED", description: "My approved college event exemption is not reflected in the attendance view.", evidenceName: null, status: "OPEN", createdAt: "2026-08-22T11:00:00.000Z", reviewedAt: null, reviewer: null, reviewerRemarks: null },
];

let notifications: AppNotification[] = [
  { id: "n-1", recipientId: "student-vansh", title: "Exemption approved", message: "Your college event request for 21 Aug is now approved.", type: "SUCCESS", relatedId: "ex-1001", read: false, createdAt: "2026-08-19T13:20:00.000Z" },
  { id: "n-2", recipientId: "student-vansh", title: "Attendance needs attention", message: "Applied Physics is at 76%. Attend the next class to stay on track.", type: "WARNING", relatedId: "physics", read: false, createdAt: "2026-08-23T08:00:00.000Z" },
  { id: "n-3", recipientId: "student-vansh", title: "Issue under review", message: "Your Data Structures attendance report is being reviewed by your mentor.", type: "INFO", relatedId: "is-2001", read: true, createdAt: "2026-08-24T15:15:00.000Z" },
];

const settings = new Map<string, Settings>([
  ["student-vansh", { theme: "SYSTEM", targetAttendance: 75, notificationsEnabled: true }],
  ["student-aman", { theme: "SYSTEM", targetAttendance: 75, notificationsEnabled: true }],
]);

export function getUsers(): CurrentUser[] {
  return users;
}

export function getUserById(id: string): CurrentUser | undefined {
  return users.find((user) => user.id === id);
}

export function getUserFromRequest(req: Request): CurrentUser | undefined {
  const raw = req.cookies?.ac_session;
  if (typeof raw === "string") {
    const session = activeSessions.get(raw);
    if (session) {
      if (session.expiresAt <= Date.now()) {
        activeSessions.delete(raw);
      } else {
        const user = getUserById(session.userId);
        if (user) return user;
        activeSessions.delete(raw);
      }
    }
  }
  return undefined;
}

export function sessionForUser(id: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  activeSessions.set(token, { userId: id, expiresAt: Date.now() + numberEnv("AUTH_SESSION_TTL_MS", 1000 * 60 * 60 * 8) });
  return token;
}

export function destroySession(token: unknown): void {
  if (typeof token === "string") activeSessions.delete(token);
}

export function sessionMaxAgeMs(): number {
  return numberEnv("AUTH_SESSION_TTL_MS", 1000 * 60 * 60 * 8);
}

export function findDevelopmentIdentity(role: AuthRole, identifier: string, mobile: string): { user: CurrentUser; mobile: string } | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  const normalizedIdentifier = identifier.trim().toUpperCase();
  const normalizedMobile = mobile.replace(/\D/g, "");
  const fixture = developmentIdentityFixtures.find((entry) => entry.role === role && entry.identifier === normalizedIdentifier && entry.mobile === normalizedMobile);
  const user = fixture && getUserById(fixture.userId);
  return user && fixture ? { user, mobile: fixture.mobile } : undefined;
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function isStaff(user: CurrentUser): boolean {
  return user.role !== "STUDENT";
}

export function getSubjects(studentId: string, target = 75) {
  return subjects.map((subject) => {
    const records = attendance.filter((record) => record.studentId === studentId && record.subjectId === subject.id);
    const present = records.filter((record) => record.status === "PRESENT" || record.status === "LATE" || record.status === "EXEMPTED").length;
    const total = records.length;
    const percentage = total ? Math.round((present / total) * 1000) / 10 : 0;
    return { ...subject, percentage, status: riskFor(percentage, target), present, total, target };
  });
}

export function getHistory(studentId: string, filters: { subject?: string; status?: RecordStatus; from?: string; to?: string }) {
  return attendance
    .filter((record) => record.studentId === studentId)
    .filter((record) => !filters.subject || record.subjectId === filters.subject)
    .filter((record) => !filters.status || record.status === filters.status)
    .filter((record) => !filters.from || record.date >= filters.from)
    .filter((record) => !filters.to || record.date <= filters.to)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((record) => {
      const subject = subjects.find((item) => item.id === record.subjectId)!;
      return { date: record.date, subjectId: record.subjectId, subjectName: subject.name, subjectCode: subject.code, status: record.status, detail: record.detail };
    });
}

export function getDashboard(studentId: string, target = 75) {
  const records = attendance.filter((record) => record.studentId === studentId);
  const present = records.filter((record) => record.status === "PRESENT" || record.status === "LATE" || record.status === "EXEMPTED").length;
  const absent = records.filter((record) => record.status === "ABSENT").length;
  const exempted = records.filter((record) => record.status === "EXEMPTED").length;
  const late = records.filter((record) => record.status === "LATE").length;
  const total = records.length;
  const percentage = total ? Math.round((present / total) * 1000) / 10 : 0;
  const pendingRequests = exemptions.filter((item) => item.studentId === studentId && item.status === "PENDING").length;
  const openIssues = issues.filter((item) => item.studentId === studentId && ["OPEN", "UNDER_REVIEW"].includes(item.status)).length;
  const canMiss = Math.max(0, Math.floor(present / (target / 100) - total));
  const classesToTarget = percentage >= target ? 0 : Math.ceil((target * total / 100 - present) / (1 - target / 100));
  return {
    overall: { percentage, status: riskFor(percentage, target), label: labelFor(percentage, target), present, total, target },
    totals: { present, absent, exempted, late, total },
    subjects: getSubjects(studentId, target),
    pendingRequests,
    openIssues,
    recentActivity: [
      { id: "activity-1", title: "Exemption approved", description: "College event request was approved by your mentor.", time: "2 days ago", type: "SUCCESS" as const },
      { id: "activity-2", title: "Physics needs attention", description: "Your subject attendance moved into the warning range.", time: "4 days ago", type: "WARNING" as const },
      { id: "activity-3", title: "Issue under review", description: "Your DSA attendance report is with Priya Nair.", time: "5 days ago", type: "INFO" as const },
    ],
    insight: {
      headline: percentage >= target ? `You can miss approximately ${canMiss} more ${canMiss === 1 ? "class" : "classes"}.` : `Attend the next ${classesToTarget} classes to reach ${target}%.`,
      detail: percentage >= target ? `Your attendance is above the ${target}% target. Keep a little buffer for unexpected absences.` : `Your current attendance is below the ${target}% target. Consistent attendance can bring it back up.`,
      classesToTarget,
      canMiss,
    },
  };
}

function riskFor(percentage: number, target: number): Risk {
  if (percentage < target - 5) return "CRITICAL";
  if (percentage < target + 5) return "WARNING";
  return "SAFE";
}

function labelFor(percentage: number, target: number): string {
  const risk = riskFor(percentage, target);
  if (risk === "CRITICAL") return "Critical";
  if (risk === "WARNING") return "Watch closely";
  return "Safe";
}

export function getTrend(studentId: string) {
  const points = [
    { label: "Aug 05", percentage: 83.2 },
    { label: "Aug 09", percentage: 84.7 },
    { label: "Aug 13", percentage: 86.1 },
    { label: "Aug 17", percentage: 85.4 },
    { label: "Aug 21", percentage: 87.4 },
    { label: "Aug 25", percentage: 87.1 },
  ];
  if (studentId !== "student-vansh") return points.map((point) => ({ ...point, percentage: point.percentage - 4 }));
  return points;
}

export function getExemptionsFor(user: CurrentUser): Exemption[] {
  return isStaff(user) ? exemptions : exemptions.filter((item) => item.studentId === user.id);
}

export function getIssuesFor(user: CurrentUser): AttendanceIssue[] {
  return isStaff(user) ? issues : issues.filter((item) => item.studentId === user.id);
}

export function getNotificationsFor(user: CurrentUser): AppNotification[] {
  return notifications.filter((item) => item.recipientId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createExemption(user: CurrentUser, input: Omit<Exemption, "id" | "studentId" | "studentName" | "status" | "submittedAt" | "reviewedAt" | "reviewer" | "reviewerRemarks">): Exemption {
  const item: Exemption = { ...input, id: `ex-${Date.now()}`, studentId: user.id, studentName: user.name, status: "PENDING", submittedAt: new Date().toISOString(), reviewedAt: null, reviewer: null, reviewerRemarks: null };
  exemptions = [item, ...exemptions];
  addNotification(user.id, "Exemption submitted", "Your request has been sent to your mentor for review.", "INFO", item.id);
  return item;
}

export function reviewExemption(id: string, reviewer: CurrentUser, status: Exemption["status"], remarks?: string): Exemption | undefined {
  const item = exemptions.find((entry) => entry.id === id);
  if (!item) return undefined;
  item.status = status;
  item.reviewedAt = new Date().toISOString();
  item.reviewer = reviewer.name;
  item.reviewerRemarks = remarks ?? null;
  addNotification(item.studentId, `Exemption ${status.toLowerCase()}`, remarks || `Your ${item.category.toLowerCase().replaceAll("_", " ")} request was ${status.toLowerCase()}.`, status === "APPROVED" ? "SUCCESS" : "WARNING", item.id);
  return item;
}

export function createIssue(user: CurrentUser, input: Omit<AttendanceIssue, "id" | "studentId" | "studentName" | "status" | "createdAt" | "reviewedAt" | "reviewer" | "reviewerRemarks">): AttendanceIssue {
  const item: AttendanceIssue = { ...input, id: `is-${Date.now()}`, studentId: user.id, studentName: user.name, status: "OPEN", createdAt: new Date().toISOString(), reviewedAt: null, reviewer: null, reviewerRemarks: null };
  issues = [item, ...issues];
  addNotification(user.id, "Issue reported", "Your attendance issue is now open and ready for review.", "INFO", item.id);
  return item;
}

export function reviewIssue(id: string, reviewer: CurrentUser, status: AttendanceIssue["status"], remarks?: string, updateAttendance = false): AttendanceIssue | undefined {
  const item = issues.find((entry) => entry.id === id);
  if (!item) return undefined;
  item.status = status;
  item.reviewedAt = new Date().toISOString();
  item.reviewer = reviewer.name;
  item.reviewerRemarks = remarks ?? null;
  if (status === "RESOLVED" && updateAttendance) {
    const record = attendance.find((entry) => entry.studentId === item.studentId && entry.subjectId === item.subjectId && entry.date === item.date);
    if (record) {
      record.status = item.issueType === "INCORRECTLY_MARKED_PRESENT" ? "ABSENT" : "PRESENT";
      record.detail = `Updated after issue ${item.id} was resolved by ${reviewer.name}`;
    }
  }
  addNotification(item.studentId, `Attendance issue ${status.toLowerCase()}`, remarks || `Your ${item.subjectName} attendance issue was ${status.toLowerCase()}.`, status === "RESOLVED" ? "SUCCESS" : "WARNING", item.id);
  return item;
}

function addNotification(recipientId: string, title: string, message: string, type: AppNotification["type"], relatedId: string) {
  notifications = [{ id: `n-${Date.now()}`, recipientId, title, message, type, relatedId, read: false, createdAt: new Date().toISOString() }, ...notifications];
}

export function getSettings(userId: string): Settings {
  return settings.get(userId) ?? { theme: "SYSTEM", targetAttendance: 75, notificationsEnabled: true };
}

export function updateSettings(userId: string, update: Partial<Settings>): Settings {
  const next = { ...getSettings(userId), ...update };
  settings.set(userId, next);
  return next;
}

export function getSubjectsList() {
  return subjects;
}

export function getStudentSummaries(target = 75) {
  return users.filter((user) => user.role === "STUDENT").map((user) => {
    const dashboard = getDashboard(user.id, target);
    return { id: user.id, name: user.name, rollNo: user.id === "student-vansh" ? "CSE/35/042" : "CSE/35/018", branch: "CSE", section: "35", percentage: dashboard.overall.percentage, status: dashboard.overall.status, pendingRequests: dashboard.pendingRequests, openIssues: dashboard.openIssues };
  });
}

export function getStudentProfile(id: string, target = 75) {
  const user = getUserById(id);
  if (!user || user.role !== "STUDENT") return undefined;
  const summary = getStudentSummaries(target).find((student) => student.id === id)!;
  return { ...summary, subjects: getSubjects(id, target), exemptions: exemptions.filter((item) => item.studentId === id), issues: issues.filter((item) => item.studentId === id), notifications: notifications.filter((item) => item.recipientId === id) };
}
