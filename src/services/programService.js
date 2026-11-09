import api from "./api/api.js";

export const getPrograms = () => {
    return api.get("/programs");
};

export const createProgram = (data) => {
    return api.post("/programs", data);
};

export const updateProgram = (id, data) => {
    return api.put(`/programs/${id}`, data);
};

export const deleteProgram = (id) => {
    return api.delete(`/programs/${id}`);
};