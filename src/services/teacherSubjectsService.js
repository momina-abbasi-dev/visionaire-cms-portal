import api from "./api/api.js"

export const getTeacherSubjects = () => api.get("/teacher-subjects")