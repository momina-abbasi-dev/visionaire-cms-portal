import api from "./api/api.js"

export const getStudentProfile      = ()       => api.get("/student-profile")
export const updateStudentProfile   = (data)   => api.put("/student-profile", data)
export const changeStudentPassword  = (data)   => api.put("/student-profile/change-password", data)