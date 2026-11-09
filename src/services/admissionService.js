import api from "./api/api.js";

export const getAdmissionStats = () =>
    api.get("/admissions/stats");

export const getAdmissions = (params = {}) =>
    api.get("/admissions", { params });

export const applyAdmission = (data) =>
    api.post("/admissions", data);

export const reviewAdmission = (id, data) =>
    api.patch(`/admissions/${id}/review`, data);