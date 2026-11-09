import api from "./api/api.js"

export const getStudentFees = () => api.get("/student-fees")