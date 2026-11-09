import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import { getStudentResults } from "../controllers/studentResultController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("student"))

router.get("/", getStudentResults)

export default router
