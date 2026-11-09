import api from "../api/api.js"

export const createUser = (data) => {
    return api.post("/users", data)
}
export const getUsers = (params) => {
    return api.get("/users", { params })
}
export const getUserById = (id) => {
    return api.get(`/users/${id}`)
}
export const updateUser = (id, data) => {
    return api.put(`/users/${id}`, data)
}
export const deleteUser = (id) => {
    return api.delete(`/users/${id}`)
}
export const getUserStats = () => {
    return api.get("/users/stats")
}