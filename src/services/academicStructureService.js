import api from "./api/api.js"

export const getAcademicStructureStats = () => api.get("/academicStructure/stats")
export const getRelationshipTree       = () => api.get("/academicStructure/tree")