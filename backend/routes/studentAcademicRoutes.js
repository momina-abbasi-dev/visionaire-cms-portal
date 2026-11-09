import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getStudentAcademicRecords } from "../controllers/studentAcademicController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("student"))

router.get("/", getStudentAcademicRecords)

export default router