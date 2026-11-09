import api from "./api/api.js"

// Page bootstrap — summary cards, classes, subjects, recent records
export const getAcademicRecordsPageData = () =>
    api.get("/teacher-records/page-data")

// Load students for marks entry — pre-fills existing records
// params: { classId, subjectId, examType }
export const loadStudentsForMarks = (params) =>
    api.get("/teacher-records/students", { params })

// Save as draft or submit records
// data: { classId, subjectId, examType, session, records[], submitMode: "draft"|"submit" }
export const saveAcademicRecords = (data) =>
    api.post("/teacher-records", data)

// Submitted records history — paginated, grouped by class+subject+examType
// params: { classId, subjectId, examType, status, page, limit }
export const getSubmittedRecords = (params) =>
    api.get("/teacher-records/submitted", { params })

// Full detail for one record group
// params: { classId, subjectId, examType }
export const getRecordGroupDetail = (params) =>
    api.get("/teacher-records/detail", { params })