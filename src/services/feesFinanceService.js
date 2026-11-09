import api from "./api/api.js";

export const getFeeStats = () =>
  api.get("/fees/stats");

export const getFeeRecords = (params = {}) =>
  api.get("/fees", { params });

export const getStudentFeeRecords = (studentId) =>
  api.get(`/fees/student/${studentId}`);

export const generateChallan = (data) =>
  api.post("/fees", data);

export const recordPayment = (id, data) =>
  api.post(`/fees/${id}/payment`, data);

export const updateFeeRecord = (id, data) =>
  api.put(`/fees/${id}`, data);

export const cancelChallan = (id) =>
  api.patch(`/fees/${id}/cancel`);

export const getOverdueAlerts = () =>
  api.get("/fees/overdue");