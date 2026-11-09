import api from "./api/api.js";

export const getAcademicSessions = (params = {}) =>
    api.get("/academic-sessions", { params });

export const getAcademicSessionById = (id) =>
    api.get(`/academic-sessions/${id}`);

export const createAcademicSession = (data) =>
    api.post("/academic-sessions", data);

export const updateAcademicSession = (id, data) =>
    api.patch(`/academic-sessions/${id}`, data);
