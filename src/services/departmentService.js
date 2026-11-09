import api from "./api/api.js";

export const getDepartments = () => {
    return api.get("/departments")
}

export const createDepartment = (data) => {
    return api.post("/departments", data)
}

export const updateDepartment = (id, data) => {
    return api.put(`/departments/${id}`, data)
}

export const deleteDepartment = (id) => {
    return api.delete(`/departments/${id}`)
}