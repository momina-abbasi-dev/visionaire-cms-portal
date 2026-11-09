import api from "./api/api.js";

export const getAcademicRecordStats = () =>
  api.get("/records/stats");

export const getRecords = (params = {}) =>
  api.get("/records", { params });

export const updateRecordStatus = (id, data) =>
  api.patch(`/records/${id}/status`, data);

export const createRecord = (data) =>
  api.post("/records/create", data);

export const viewMarks = (params = {}) =>
  api.get("/records/viewMarks", { params });