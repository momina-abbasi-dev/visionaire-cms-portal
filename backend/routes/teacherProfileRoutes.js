import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getTeacherProfile,
    updateTeacherProfile,
    changeTeacherPassword,
} from "../controllers/teacherProfileController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

router.get("/",                getTeacherProfile)
router.put("/",                updateTeacherProfile)
router.put("/change-password", changeTeacherPassword)

export default router