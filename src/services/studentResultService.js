import api from "./api/api.js";

export const getStudentResults = () => api.get("/student-results")