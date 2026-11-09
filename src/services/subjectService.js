import api from "./api/api.js";

export const getSubjects = () => {
    return api.get("/subjects")
}

export const createSubject = (data) => {
    return api.post("/subjects", data)
}

export const updateSubject = (id, data) => {
    return api.put(`/subjects/${id}`, data)
}

export const deleteSubject = (id) => {
    return api.delete(`/subjects/${id}`)
}