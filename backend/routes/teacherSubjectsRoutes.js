import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getTeacherSubjects } from "../controllers/teacherSubjectsController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

router.get("/", getTeacherSubjects)

export default router