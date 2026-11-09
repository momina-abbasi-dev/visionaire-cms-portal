import express from "express"
import { protect }   from "../middlewares/authMiddleware.js"
import { authRoles } from "../middlewares/roleMiddleware.js"
import {
    getAcademicRecordsPageData,
    loadStudentsForMarks,
    saveAcademicRecords,
    getSubmittedRecords,
    getRecordGroupDetail,
} from "../controllers/teacherAcademicRecordsController.js"

const router = express.Router()
router.use(protect)
router.use(authRoles("teacher"))

// Page bootstrap — summary cards + classes + subjects + recent records
router.get("/page-data",   getAcademicRecordsPageData)

// Load students for marks entry with existing records pre-filled
// GET /api/teacher-records/students?classId=&subjectId=&examType=
router.get("/students",    loadStudentsForMarks)

// Save (draft) or Submit (verified) academic records — upsert per student
// POST body: { classId, subjectId, examType, session, records[], submitMode }
router.post("/",           saveAcademicRecords)

// Submitted records history — paginated, grouped by class+subject+examType
// GET /api/teacher-records/submitted?classId=&subjectId=&examType=&status=&page=
router.get("/submitted",   getSubmittedRecords)

// Full detail for one record group
// GET /api/teacher-records/detail?classId=&subjectId=&examType=
router.get("/detail",      getRecordGroupDetail)

export default router