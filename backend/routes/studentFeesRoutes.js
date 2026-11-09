import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getStudentFees } from "../controllers/studentFeesController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("student"))

router.get("/", getStudentFees)

export default router