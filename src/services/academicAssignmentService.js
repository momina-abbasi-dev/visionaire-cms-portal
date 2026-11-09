import api from "./api/api.js";

export const getAssignments = () => api.get("/academicAssignments");

export const createAssignment = (data) =>
    api.post("/academicAssignments", data);

export const updateAssignment = (id, data) =>
    api.patch(`/academicAssignments/${id}`, data);

export const deactivateAssignment = (id) =>
    api.patch(`/academicAssignments/${id}/deactivate`);
