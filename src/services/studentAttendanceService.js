import api from "./api/api.js"

export const getStudentAttendance = () => api.get("/student-attendance")