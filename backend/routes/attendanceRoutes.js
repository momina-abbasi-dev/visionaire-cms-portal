import { createAttendance, attendancePercentage } from "../controllers/attendanceController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin", "teacher"), createAttendance);

router.get("/percentage", authRoles("admin", "teacher", "student"), attendancePercentage);

export default router;