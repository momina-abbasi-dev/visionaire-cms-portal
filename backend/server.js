import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js"

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import academicStructure from "./routes/academicStructureRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import programRoutes from "./routes/programRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import admissionRoutes from "./routes/admissionRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import classRoutes from "./routes/classRoutes.js";
import academicAssignmentRoutes from "./routes/academicAssignmentRoutes.js";
import academicRecordRoutes from "./routes/academicRecordRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import feesFinanceRoutes from "./routes/feesFinanceRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js"
import academicSessionRoutes from "./routes/academicSessionRoutes.js";
import studentEnrollmentRoutes from "./routes/studentEnrollmentRoutes.js";

import studentProfileRoutes from "./routes/studentProfileRoutes.js"
import studentAcademicRoutes from "./routes/studentAcademicRoutes.js"
import studentAttendanceRoutes from "./routes/studentAttendanceRoutes.js"
import studentResultRoutes from './routes/studentResultRoutes.js'
import studentFeesRoutes from './routes/studentFeesRoutes.js'

import teacherProfileRoutes from "./routes/teacherProfileRoutes.js"
import teacherClassesRoutes from "./routes/teacherClassesRoutes.js"
import teacherSubjectsRoutes from "./routes/teacherSubjectsRoutes.js"
import teacherStudentsRoutes from "./routes/teacherStudentsRoutes.js"
import teacherAttendanceRoutes from "./routes/teacherAttendanceRoutes.js"
import teacherAcademicRecordsRoutes from "./routes/teacherAcademicRecordsRoutes.js"
import teacherResultsRoutes from "./routes/teacherResultsRoutes.js"

dotenv.config();

connectDB();

const app = express();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.json("API is running");
})

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/academicStructure", academicStructure);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/programs", programRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/admissions", admissionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/academicAssignments", academicAssignmentRoutes);
app.use("/api/records", academicRecordRoutes);
app.use("/api/attendances", attendanceRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/fees", feesFinanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/academic-sessions", academicSessionRoutes);
app.use("/api/student-enrollments", studentEnrollmentRoutes);

app.use("/api/student-profile", studentProfileRoutes);
app.use("/api/student-academic-records", studentAcademicRoutes)
app.use("/api/student-attendance", studentAttendanceRoutes)
app.use('/api/student-results', studentResultRoutes)
app.use("/api/student-fees", studentFeesRoutes)

app.use("/api/teacher-profile", teacherProfileRoutes);
app.use("/api/teacher-classes", teacherClassesRoutes);
app.use("/api/teacher-subjects", teacherSubjectsRoutes);
app.use("/api/teacher-students", teacherStudentsRoutes);
app.use("/api/teacher-attendance", teacherAttendanceRoutes);
app.use("/api/teacher-records", teacherAcademicRecordsRoutes)
app.use("/api/teacher-results", teacherResultsRoutes)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("Server is running")
})