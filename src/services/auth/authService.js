import api from "../api/api.js";

export const loginUser = (data) => {
    return api.post("/auth/login", data);
};