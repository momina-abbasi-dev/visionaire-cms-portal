import api from "./api/api.js";

export const getStudentEnrollments = (params) =>
    api.get("/student-enrollments", { params });

export const getEligibleStudents = (params) =>
    api.get("/student-enrollments/eligible", { params });

export const createStudentEnrollment = (data) =>
    api.post("/student-enrollments", data);

export const closeStudentEnrollment = (id, data) =>
    api.patch(`/student-enrollments/${id}/close`, data);

export const promoteStudentEnrollment = (id, data) =>
    api.post(`/student-enrollments/${id}/promote`, data);

export const bulkPromoteStudentEnrollments = (data) =>
    api.post("/student-enrollments/bulk-promote", data);
