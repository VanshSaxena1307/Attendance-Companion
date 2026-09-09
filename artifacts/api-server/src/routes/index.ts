import { Router, type IRouter } from "express";
import healthRouter from "./health";
import attendanceRouter from "./attendance";
import scheduleRouter from "./schedule";

const router: IRouter = Router();

router.use(healthRouter);
router.use(attendanceRouter);
router.use(scheduleRouter);

export default router;

