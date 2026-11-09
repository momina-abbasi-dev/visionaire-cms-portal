import api from "./api/api.js"

export const getTeacherClasses = () => api.get("/teacher-classes")