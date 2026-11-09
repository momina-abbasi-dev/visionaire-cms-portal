import api from "./api/api.js"

// Page bootstrap — summary cards + classes + subjects + recent activity
export const getAttendancePageData = () =>
    api.get("/teacher-attendance/page-data")

// Load students for marking — checks if already submitted
// params: { classId, subjectId, session, date }
export const loadStudentsForAttendance = (params) =>
    api.get("/teacher-attendance/students", { params })

// Submit new attendance (bulk)
// data: { classId, subjectId, date, session, records: [{ studentId, status, remarks }] }
export const submitAttendance = (data) =>
    api.post("/teacher-attendance", data)

// Update existing attendance — senior teacher only
// data: { classId, subjectId, session, date, records: [{ studentId, status, remarks }] }
export const updateAttendance = (data) =>
    api.put("/teacher-attendance", data)

// Attendance history — paginated grouped sessions
// params: { classId, subjectId, page, limit }
export const getAttendanceHistory = (params) =>
    api.get("/teacher-attendance/history", { params })

// Full session detail — all students for one specific session
// params: { classId, subjectId, date }
export const getSessionDetail = (params) =>
    api.get("/teacher-attendance/session", { params })