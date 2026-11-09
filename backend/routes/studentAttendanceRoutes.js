import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getStudentAttendance } from "../controllers/studentAttendanceController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("student"))

router.get("/", getStudentAttendance)

export default router