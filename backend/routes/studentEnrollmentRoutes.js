import express from "express";
import {
    closeStudentEnrollment,
    bulkPromoteStudentEnrollments,
    createStudentEnrollment,
    getEligibleStudents,
    getStudentEnrollmentById,
    getStudentEnrollments,
    promoteStudentEnrollment,
} from "../controllers/studentEnrollmentController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authRoles("admin"));

router.post("/", createStudentEnrollment);
router.post("/bulk-promote", bulkPromoteStudentEnrollments);
router.patch("/:id/close", closeStudentEnrollment);
router.post("/:id/promote", promoteStudentEnrollment);
router.get("/eligible", getEligibleStudents);
router.get("/", getStudentEnrollments);
router.get("/:id", getStudentEnrollmentById);

export default router;
