import api from "./api/api.js"

// GET list — accepts query params: search, classId, subjectId, attStatus, page, limit
export const getTeacherStudents = (params) =>
    api.get("/teacher-students", { params })

// GET single student profile (teacher's limited view)
export const getStudentProfileForTeacher = (studentId) =>
    api.get(`/teacher-students/${studentId}`)