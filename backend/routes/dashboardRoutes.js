import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getAdminOverview,
    getStudentOverview,
    getTeacherOverview,
} from "../controllers/dashboardController.js"

const router = express.Router()

router.get("/admin/overview",   protect, authRoles("admin"),   getAdminOverview)
router.get("/student/overview", protect, authRoles("student"), getStudentOverview)
router.get("/teacher/overview", protect, authRoles("teacher"), getTeacherOverview)

export default router
