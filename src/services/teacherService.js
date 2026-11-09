import api from './api/api.js';

export const createTeacher = (data) => {
    return api.post('/teachers', data);
}

export const getTeachers = (params) => {
    return api.get('/teachers', { params });
};

export const getTeacherStats = () => {
    return api.get('/teachers/stats');
}

export const getTeacherById = (id) => {
    return api.get(`/teachers/${id}`);
}

export const updateTeacher = (id, data) => {
    return api.put(`/teachers/${id}`, data);
}

export const deleteTeacher = (id) => {
    return api.delete(`/teachers/${id}`);
}