import { createStudent, getStudents, getStudentById, updateStudent, deleteStudent, getStudentStats } from "../controllers/studentController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createStudent);

router.get("/", authRoles("admin"), getStudents);

router.get("/stats", authRoles("admin"), getStudentStats);

router.get("/:id", authRoles("admin"), getStudentById);

router.put("/:id", authRoles("admin", "admission"), updateStudent);

router.delete("/:id", authRoles("admin"), deleteStudent);

export default router;