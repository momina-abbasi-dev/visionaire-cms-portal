import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getTeacherClasses } from "../controllers/teacherClassesController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

router.get("/", getTeacherClasses)

export default router