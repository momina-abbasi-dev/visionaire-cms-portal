import express from "express";

import {
  getAcademicRecordStats,
  getRecords,
  updateRecordStatus,
  createRecord,
  viewMarks,
} from "../controllers/academicRecordController.js";

import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Admin: statistics, records, and review controls
router.get("/stats", authRoles("admin"), getAcademicRecordStats);
router.get("/", authRoles("admin"), getRecords);
router.patch("/:id/status", authRoles("admin"), updateRecordStatus);

// Teacher: submit marks
router.post("/create", authRoles("teacher"), createRecord);

// Each role is scoped by the authenticated user's identity
router.get(
  "/viewMarks",
  authRoles("student", "teacher", "admin"),
  viewMarks
);

export default router;