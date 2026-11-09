import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getTeacherStudents,
    getStudentProfileForTeacher,
} from "../controllers/teacherStudentsController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

// GET /api/teacher-students               → list with filters + summary
// GET /api/teacher-students/:studentId    → single student profile (teacher view)
router.get("/",             getTeacherStudents)
router.get("/:studentId",   getStudentProfileForTeacher)

export default router