import api from "./api/api.js";

export const getClasses = () => {
    return api.get("/classes")
}

export const createClass = (data) => {
    return api.post("/classes", data)
}

export const updateClass = (id, data) => {
    return api.put(`/classes/${id}`, data)
}

export const deleteClass = (id) => {
    return api.delete(`/classes/${id}`)
}