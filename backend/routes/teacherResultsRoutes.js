import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getResultsPageData,
    getResults,
    getStudentFullResult,
    verifyResult,
    getVerificationQueue,
} from "../controllers/teacherResultsController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

// Page bootstrap — summary cards + classes + subjects + sessions
router.get("/page-data",            getResultsPageData)

// Results list — filtered by class/subject/session/status/search
// GET /api/teacher-results?classId=&subjectId=&session=&resultStatus=&search=&page=
router.get("/",                     getResults)

// Single student full result — all subjects in teacher's classes
// GET /api/teacher-results/student/:studentId?session=
router.get("/student/:studentId",   getStudentFullResult)

// Verification queue — senior teacher only
// GET /api/teacher-results/queue
router.get("/queue",                getVerificationQueue)

// Verify a result — senior teacher only
// PATCH /api/teacher-results/:resultId/verify
router.patch("/:resultId/verify",   verifyResult)

export default router