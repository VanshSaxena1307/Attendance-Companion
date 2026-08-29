import { Router, type IRouter, type Request, type Response } from "express";
import {
  ApproveExemptionBody, ApproveExemptionParams, ApproveExemptionResponse,
  CreateAttendanceIssueBody, CreateAttendanceIssueResponse, CreateExemptionBody, CreateExemptionResponse,
  VerifyIdentityBody, VerifyIdentityResponse, VerifyOtpBody, VerifyOtpResponse, SendOtpResponse, GetAttendanceHistoryQueryParams, GetAttendanceHistoryResponse,
  GetAttendanceIssuesQueryParams, GetAttendanceIssuesResponse, GetAttendanceTrendResponse,
  GetCurrentUserResponse, GetDashboardSummaryResponse, GetExemptionsQueryParams, GetExemptionsResponse,
  GetNotificationsResponse, GetSettingsResponse, GetStudentsQueryParams, GetStudentsResponse,
  GetStudentParams, GetStudentResponse, GetSubjectAttendanceResponse, MarkAllNotificationsReadResponse,
  MarkNotificationReadParams, MarkNotificationReadResponse, RejectAttendanceIssueBody, RejectAttendanceIssueParams,
  RejectAttendanceIssueResponse, RejectExemptionBody, RejectExemptionParams, RejectExemptionResponse,
  ResolveAttendanceIssueBody, ResolveAttendanceIssueParams, ResolveAttendanceIssueResponse,
  UpdateSettingsBody, UpdateSettingsResponse,
} from "@workspace/api-zod";
import { getUserFromRequest, sessionForUser, sessionMaxAgeMs, destroySession, findDevelopmentIdentity, isStaff, getDashboard, getSubjects, getHistory, getTrend, getExemptionsFor, getIssuesFor, getNotificationsFor, createExemption, reviewExemption, createIssue, reviewIssue, getSettings, updateSettings, getStudentSummaries, getStudentProfile, type AuthRole, type CurrentUser } from "../lib/attendance-domain";
import { AuthError, createAuthFlow, destroyAuthFlow, maskMobile, sendOtp, verifyOtp } from "../lib/authentication";

const router: IRouter = Router();
const staffOnly = (req: Request, res: Response): boolean => {
  const user = res.locals.user as CurrentUser;
  if (!isStaff(user)) {
    res.status(403).json({ error: "This action requires a mentor, HOD, or admin role." });
    return false;
  }
  return true;
};

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

router.post("/auth/identity", (req, res): void => {
  const parsed = VerifyIdentityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const identity = findDevelopmentIdentity(parsed.data.role as AuthRole, parsed.data.identifier, parsed.data.mobile);
  if (!identity) { res.status(401).json({ error: "We could not verify that identity and registered mobile number." }); return; }
  const flowToken = createAuthFlow(identity.user, parsed.data.role as AuthRole, identity.mobile);
  res.cookie("ac_auth_flow", flowToken, { ...cookieOptions, maxAge: 1000 * 60 * 15 });
  res.json(VerifyIdentityResponse.parse({ maskedMobile: maskMobile(identity.mobile), resendAvailableIn: 0 }));
});

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  try {
    const result = await sendOtp(req.cookies?.ac_auth_flow);
    res.json(SendOtpResponse.parse(result));
  } catch (error) {
    sendAuthError(res, error);
  }
});

router.post("/auth/verify-otp", (req, res): void => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const user = verifyOtp(req.cookies?.ac_auth_flow, parsed.data.otp);
    destroyAuthFlow(req.cookies?.ac_auth_flow);
    res.clearCookie("ac_auth_flow", cookieOptions);
    res.cookie("ac_session", sessionForUser(user.id), { ...cookieOptions, maxAge: sessionMaxAgeMs() });
    res.json(VerifyOtpResponse.parse(user));
  } catch (error) {
    sendAuthError(res, error);
  }
});

router.post("/auth/logout", (req, res): void => {
  destroySession(req.cookies?.ac_session);
  destroyAuthFlow(req.cookies?.ac_auth_flow);
  res.clearCookie("ac_session", cookieOptions);
  res.clearCookie("ac_auth_flow", cookieOptions);
  res.status(204).end();
});

router.get("/me", (req, res): void => {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Authentication is required." }); return; }
  res.json(GetCurrentUserResponse.parse(user));
});

router.use((req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) { res.status(401).json({ error: "Authentication is required." }); return; }
  res.locals.user = user;
  next();
});

router.get("/dashboard/summary", (req, res): void => {
  const user = res.locals.user as CurrentUser;
  const data = GetDashboardSummaryResponse.parse(getDashboard(user.role === "STUDENT" ? user.id : "student-vansh", getSettings(user.id).targetAttendance));
  res.json(data);
});

router.get("/attendance/subjects", (req, res): void => {
  const user = res.locals.user as CurrentUser;
  res.json(GetSubjectAttendanceResponse.parse(getSubjects(user.role === "STUDENT" ? user.id : "student-vansh", getSettings(user.id).targetAttendance)));
});

router.get("/attendance/history", (req, res): void => {
  const query = GetAttendanceHistoryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const user = res.locals.user as CurrentUser;
  const filters = { subject: query.data.subject, status: query.data.status, from: query.data.from?.toISOString().slice(0, 10), to: query.data.to?.toISOString().slice(0, 10) };
  const all = getHistory(user.role === "STUDENT" ? user.id : "student-vansh", filters);
  const start = (query.data.page - 1) * query.data.pageSize;
  res.json(GetAttendanceHistoryResponse.parse({ items: all.slice(start, start + query.data.pageSize), page: query.data.page, pageSize: query.data.pageSize, total: all.length }));
});

router.get("/attendance/trend", (req, res): void => {
  const user = res.locals.user as CurrentUser;
  res.json(GetAttendanceTrendResponse.parse(getTrend(user.role === "STUDENT" ? user.id : "student-vansh")));
});

router.get("/exemptions", (req, res): void => {
  const query = GetExemptionsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const items = getExemptionsFor(res.locals.user as CurrentUser).filter((item) => !query.data.status || item.status === query.data.status);
  const start = (query.data.page - 1) * query.data.pageSize;
  res.json(GetExemptionsResponse.parse({ items: items.slice(start, start + query.data.pageSize), page: query.data.page, pageSize: query.data.pageSize, total: items.length }));
});

router.post("/exemptions", (req, res): void => {
  const parsed = CreateExemptionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const user = res.locals.user as CurrentUser;
  const item = createExemption(user, { ...parsed.data, proofName: parsed.data.proofName ?? null, startDate: parsed.data.startDate.toISOString().slice(0, 10), endDate: parsed.data.endDate.toISOString().slice(0, 10) });
  res.status(201).json(CreateExemptionResponse.parse(item));
});

router.patch("/exemptions/:id/approve", (req, res): void => {
  if (!staffOnly(req, res)) return;
  const params = ApproveExemptionParams.safeParse(req.params);
  const body = ApproveExemptionBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid exemption review." }); return; }
  const item = reviewExemption(params.data.id, res.locals.user as CurrentUser, "APPROVED", body.data.remarks);
  if (!item) { res.status(404).json({ error: "Exemption not found." }); return; }
  res.json(ApproveExemptionResponse.parse(item));
});

router.patch("/exemptions/:id/reject", (req, res): void => {
  if (!staffOnly(req, res)) return;
  const params = RejectExemptionParams.safeParse(req.params);
  const body = RejectExemptionBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid exemption review." }); return; }
  const item = reviewExemption(params.data.id, res.locals.user as CurrentUser, "REJECTED", body.data.remarks);
  if (!item) { res.status(404).json({ error: "Exemption not found." }); return; }
  res.json(RejectExemptionResponse.parse(item));
});

router.get("/attendance-issues", (req, res): void => {
  const query = GetAttendanceIssuesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const items = getIssuesFor(res.locals.user as CurrentUser).filter((item) => !query.data.status || item.status === query.data.status);
  res.json(GetAttendanceIssuesResponse.parse(items));
});

router.post("/attendance-issues", (req, res): void => {
  const parsed = CreateAttendanceIssueBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const item = createIssue(res.locals.user as CurrentUser, { ...parsed.data, evidenceName: parsed.data.evidenceName ?? null, date: parsed.data.date.toISOString().slice(0, 10) });
  res.status(201).json(CreateAttendanceIssueResponse.parse(item));
});

router.patch("/attendance-issues/:id/resolve", (req, res): void => {
  if (!staffOnly(req, res)) return;
  const params = ResolveAttendanceIssueParams.safeParse(req.params);
  const body = ResolveAttendanceIssueBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid issue resolution." }); return; }
  const item = reviewIssue(params.data.id, res.locals.user as CurrentUser, "RESOLVED", body.data.remarks, body.data.updateAttendance);
  if (!item) { res.status(404).json({ error: "Attendance issue not found." }); return; }
  res.json(ResolveAttendanceIssueResponse.parse(item));
});

router.patch("/attendance-issues/:id/reject", (req, res): void => {
  if (!staffOnly(req, res)) return;
  const params = RejectAttendanceIssueParams.safeParse(req.params);
  const body = RejectAttendanceIssueBody.safeParse(req.body ?? {});
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid issue review." }); return; }
  const item = reviewIssue(params.data.id, res.locals.user as CurrentUser, "REJECTED", body.data.remarks);
  if (!item) { res.status(404).json({ error: "Attendance issue not found." }); return; }
  res.json(RejectAttendanceIssueResponse.parse(item));
});

router.get("/notifications", (req, res): void => {
  res.json(GetNotificationsResponse.parse(getNotificationsFor(res.locals.user as CurrentUser)));
});

router.patch("/notifications/:id/read", (req, res): void => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = res.locals.user as CurrentUser;
  const item = getNotificationsFor(user).find((notification) => notification.id === params.data.id);
  if (!item) { res.status(404).json({ error: "Notification not found." }); return; }
  item.read = true;
  res.json(MarkNotificationReadResponse.parse(item));
});

router.post("/notifications/read-all", (req, res): void => {
  const user = res.locals.user as CurrentUser;
  const items = getNotificationsFor(user).map((item) => { item.read = true; return item; });
  res.json(MarkAllNotificationsReadResponse.parse(items));
});

router.get("/students", (req, res): void => {
  if (!staffOnly(req, res)) return;
  const query = GetStudentsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }
  const items = getStudentSummaries(getSettings((res.locals.user as CurrentUser).id).targetAttendance)
    .filter((item) => !query.data.search || item.name.toLowerCase().includes(query.data.search.toLowerCase()) || item.rollNo.toLowerCase().includes(query.data.search.toLowerCase()))
    .filter((item) => !query.data.risk || item.status === query.data.risk);
  res.json(GetStudentsResponse.parse(items));
});

router.get("/students/:id", (req, res): void => {
  const params = GetStudentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = res.locals.user as CurrentUser;
  const requestedId = params.data.id === "me" ? user.id : params.data.id;
  if (user.role === "STUDENT" && requestedId !== user.id) {
    res.status(403).json({ error: "Students can only access their own profile." });
    return;
  }
  if (user.role !== "STUDENT" && !isStaff(user)) {
    res.status(403).json({ error: "This action requires a mentor, HOD, or admin role." });
    return;
  }
  const profile = getStudentProfile(requestedId, getSettings(user.id).targetAttendance);
  if (!profile) { res.status(404).json({ error: "Student not found." }); return; }
  res.json(GetStudentResponse.parse(profile));
});

router.get("/settings", (req, res): void => {
  res.json(GetSettingsResponse.parse(getSettings((res.locals.user as CurrentUser).id)));
});

router.patch("/settings", (req, res): void => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const next = updateSettings((res.locals.user as CurrentUser).id, parsed.data);
  res.json(UpdateSettingsResponse.parse(next));
});

export default router;

function sendAuthError(res: Response, error: unknown): void {
  if (error instanceof AuthError) { res.status(error.status).json({ error: error.message }); return; }
  res.status(500).json({ error: "We could not send a verification code. Please try again." });
}
