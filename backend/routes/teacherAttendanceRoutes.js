import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getAttendancePageData,
    loadStudentsForAttendance,
    submitAttendance,
    updateAttendance,
    getAttendanceHistory,
    getSessionDetail,
} from "../controllers/teacherAttendanceController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

// Page bootstrap data (summary cards + class/subject lists)
router.get("/page-data",       getAttendancePageData)

// Load students for a specific class + subject + date
// GET /api/teacher-attendance/students?classId=&subjectId=&date=
router.get("/students",        loadStudentsForAttendance)

// Submit new attendance (bulk create)
router.post("/",               submitAttendance)

// Update existing attendance (senior teacher only)
router.put("/",                updateAttendance)

// Attendance history (paginated grouped sessions)
// GET /api/teacher-attendance/history?classId=&subjectId=&page=
router.get("/history",         getAttendanceHistory)

// Full session detail (all students for a specific date)
// GET /api/teacher-attendance/session?classId=&subjectId=&date=
router.get("/session",         getSessionDetail)

export default router