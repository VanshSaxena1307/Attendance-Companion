import { Router, type IRouter, type Request, type Response } from "express";
import {
  getUserFromRequest,
  getStudentTodaysSchedule,
  getMentorTodaysSchedule,
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

export default router;
