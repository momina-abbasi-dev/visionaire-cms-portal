import cors from "cors";
import express from "express";
import dashboardRoutes from "../../routes/dashboardRoutes.js";
import academicRecordRoutes from "../../routes/academicRecordRoutes.js";
import academicAssignmentRoutes from "../../routes/academicAssignmentRoutes.js";
import academicSessionRoutes from "../../routes/academicSessionRoutes.js";
import classRoutes from "../../routes/classRoutes.js";
import studentEnrollmentRoutes from "../../routes/studentEnrollmentRoutes.js";
import studentRoutes from "../../routes/studentRoutes.js";
import teacherAcademicRecordsRoutes from "../../routes/teacherAcademicRecordsRoutes.js";
import teacherStudentsRoutes from "../../routes/teacherStudentsRoutes.js";
import { configureTestAuthentication } from "./fixtures.js";

export const createTestApp = () => {
    configureTestAuthentication();

    const app = express();
    app.use(express.json());
    app.use(cors());
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/records", academicRecordRoutes);
    app.use("/api/academicAssignments", academicAssignmentRoutes);
    app.use("/api/teacher-records", teacherAcademicRecordsRoutes);
    app.use("/api/teacher-students", teacherStudentsRoutes);
    app.use("/api/students", studentRoutes);
    app.use("/api/academic-sessions", academicSessionRoutes);
    app.use("/api/classes", classRoutes);
    app.use("/api/student-enrollments", studentEnrollmentRoutes);
    return app;
};
