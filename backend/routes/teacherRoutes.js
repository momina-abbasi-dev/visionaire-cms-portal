import { createTeacher, getTeachers, getTeacherById, updateTeacher, deleteTeacher, getTeacherStats } from "../controllers/teacherController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createTeacher);

router.get("/", getTeachers);

router.get("/stats", getTeacherStats);

router.get("/:id", getTeacherById);

router.put("/:id", authRoles("admin"), updateTeacher);

router.delete("/:id", authRoles("admin"), deleteTeacher);

export default router;