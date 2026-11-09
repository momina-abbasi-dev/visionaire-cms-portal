import api from "./api/api.js"

export const getStudentAcademicRecords = () => api.get("/student-academic-records")