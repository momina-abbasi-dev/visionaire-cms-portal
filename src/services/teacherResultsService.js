import api from "./api/api.js"

// Page bootstrap — summary cards, classes, subjects, sessions list
export const getResultsPageData = () =>
    api.get("/teacher-results/page-data")

// Results list — filtered
// params: { classId, subjectId, session, resultStatus, search, page, limit }
export const getResults = (params) =>
    api.get("/teacher-results", { params })

// Single student full result — all subjects in teacher's classes
// params: { session } (optional)
export const getStudentFullResult = (studentId, params) =>
    api.get(`/teacher-results/student/${studentId}`, { params })

// Verification queue — pending results needing senior teacher sign-off
export const getVerificationQueue = () =>
    api.get("/teacher-results/queue")

// Verify a result — senior teacher only
export const verifyResult = (resultId) =>
    api.patch(`/teacher-results/${resultId}/verify`)