import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getStudentProfile,
    updateStudentProfile,
    changeStudentPassword,
} from "../controllers/studentProfileController.js"

const router = express.Router()

router.use(protect)
router.use(authRoles("student"))

router.get("/",                 getStudentProfile)
router.put("/",                 updateStudentProfile)
router.put("/change-password",  changeStudentPassword)

export default router

// Academic Records — add this import at top of the file too
// import { getStudentAcademicRecords } from "../controllers/dashboardController.js"
// router.get("/academic-records", getStudentAcademicRecords)