import api from "./api/api.js"

export const getAdminOverview   = () => api.get("/dashboard/admin/overview")
export const getStudentOverview = () => api.get("/dashboard/student/overview")
export const getTeacherOverview = () => api.get("/dashboard/teacher/overview")
