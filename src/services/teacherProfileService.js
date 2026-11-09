import api from "./api/api.js"

export const getTeacherProfile     = ()     => api.get("/teacher-profile")
export const updateTeacherProfile  = (data) => api.put("/teacher-profile", data)
export const changeTeacherPassword = (data) => api.put("/teacher-profile/change-password", data)