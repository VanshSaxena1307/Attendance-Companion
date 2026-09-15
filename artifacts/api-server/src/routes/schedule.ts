import { Router, type IRouter, type Request, type Response } from "express";
import {
  getUserFromRequest,
  getStudentTodaysSchedule,
  getMentorTodaysSchedule,
  getDepartmentSchedule,
  cancelLecturesForHoliday,
  resetUnexpectedHoliday,
  type CurrentUser,
} from "../lib/attendance-domain";

const router: IRouter = Router();

router.use((req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "Authentication is required." });
    return;
  }
  res.locals.user = user;
  next();
});

const studentOnly = (res: Response): CurrentUser | undefined => {
  const user = res.locals.user as CurrentUser;
  if (user.role !== "STUDENT") {
    res.status(403).json({ error: "This action requires a student role." });
    return undefined;
  }
  return user;
};

const mentorOnly = (res: Response): CurrentUser | undefined => {
  const user = res.locals.user as CurrentUser;
  if (user.role !== "MENTOR") {
    res.status(403).json({ error: "This action requires an assigned mentor." });
    return undefined;
  }
  return user;
};

const hodOrAdminOnly = (res: Response): CurrentUser | undefined => {
  const user = res.locals.user as CurrentUser;
  if (user.role !== "HOD" && user.role !== "ADMIN") {
    res.status(403).json({ error: "This action requires an HOD or Administrator role." });
    return undefined;
  }
  return user;
};

const adminOnly = (res: Response): CurrentUser | undefined => {
  const user = res.locals.user as CurrentUser;
  if (user.role !== "ADMIN") {
    res.status(403).json({ error: "This action requires an Administrator role." });
    return undefined;
  }
  return user;
};

// GET /api/student/schedule/today
router.get("/student/schedule/today", async (req: Request, res: Response): Promise<void> => {
  const user = studentOnly(res);
  if (!user) return;

  const dateQuery = typeof req.query.date === "string" ? req.query.date : undefined;
  if (dateQuery && !/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    return;
  }

  const schedule = await getStudentTodaysSchedule(user.id, dateQuery);
  if (!schedule) {
    res.status(404).json({ error: "Student profile not found." });
    return;
  }

  res.json(schedule);
});

// GET /api/mentor/schedule/today
router.get("/mentor/schedule/today", async (req: Request, res: Response): Promise<void> => {
  const user = mentorOnly(res);
  if (!user) return;

  const dateQuery = typeof req.query.date === "string" ? req.query.date : undefined;
  if (dateQuery && !/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    return;
  }

  const schedule = await getMentorTodaysSchedule(user.id, dateQuery);
  if (!schedule) {
    res.status(404).json({ error: "Mentor profile not found." });
    return;
  }

  res.json(schedule);
});

// GET /api/department/schedule/today
router.get("/department/schedule/today", async (req: Request, res: Response): Promise<void> => {
  const user = res.locals.user as CurrentUser;
  if (!user) return;

  const dateQuery = typeof req.query.date === "string" ? req.query.date : undefined;
  if (dateQuery && !/^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    res.status(400).json({ error: "Date must be in YYYY-MM-DD format" });
    return;
  }

  const sectionQuery = typeof req.query.section === "string" ? req.query.section : undefined;
  const schedule = await getDepartmentSchedule(dateQuery, sectionQuery);
  res.json(schedule);
});

// POST /api/schedule/unexpected-holiday
router.post("/schedule/unexpected-holiday", async (req: Request, res: Response): Promise<void> => {
  const user = adminOnly(res);
  if (!user) return;

  const { date, section, numberOfLectures, reason } = req.body || {};
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date in YYYY-MM-DD format is required." });
    return;
  }

  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    res.status(400).json({ error: "A valid holiday reason (at least 3 characters) is required." });
    return;
  }

  const parsedNum = numberOfLectures !== undefined ? Number(numberOfLectures) : undefined;
  if (parsedNum !== undefined && (Number.isNaN(parsedNum) || parsedNum < 1)) {
    res.status(400).json({ error: "numberOfLectures must be a positive integer if provided." });
    return;
  }

  const result = await cancelLecturesForHoliday({
    date,
    section: typeof section === "string" ? section : "ALL",
    numberOfLectures: parsedNum,
    reason: reason.trim(),
  });

  res.json(result);
});

// POST /api/schedule/unexpected-holiday/reset
router.post("/schedule/unexpected-holiday/reset", async (req: Request, res: Response): Promise<void> => {
  const user = adminOnly(res);
  if (!user) return;

  const { date, section } = req.body || {};
  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: "Valid date in YYYY-MM-DD format is required." });
    return;
  }

  const result = await resetUnexpectedHoliday(date, typeof section === "string" ? section : undefined);
  res.json(result);
});

export default router;
