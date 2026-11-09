import api from "./api/api.js";

export const getStudentStats = () => {
    return api.get("/students/stats");
}

export const createStudent = (data) => {
    return api.post("/students", data);
}

export const getStudents = (params) => {
    return api.get("/students", { params });
}

export const getStudentById = (id) => {
    return api.get(`/students/${id}`);
}

export const updateStudent = (id, data) => {
    return api.put(`/students/${id}`, data);
}

export const deleteStudent = (id) => {
    return api.delete(`/students/${id}`);
}