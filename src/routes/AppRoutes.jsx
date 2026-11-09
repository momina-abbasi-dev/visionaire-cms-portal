import { Routes, Route, Navigate } from "react-router-dom";

import Login from "../pages/auth/Login.jsx"
import Register from "../pages/auth/Register.jsx"

import MainLayout from "../layouts/MainLayout.jsx"
import ProtectedRoute from "./ProtectedRoute.jsx";

import UserManagement from "../pages/dashboard/admin/UserManagement.jsx";
import AcademicStructure from "../pages/dashboard/admin/AcademicStructure.jsx";
import StudentManagement from "../pages/dashboard/admin/StudentManagement.jsx";
import TeacherManagement from "../pages/dashboard/admin/TeacherManagement.jsx";
import AcademicAssignmentManagement from "../pages/dashboard/admin/AcademicAssignmentManagement.jsx";
import Admissions from "../pages/dashboard/admin/Admissions.jsx";
import AcademicRecords from "../pages/dashboard/admin/AcademicRecords.jsx";
import FeesFinance from "../pages/dashboard/admin/FeesFinance.jsx";
import AcademicSessionManagement from "../pages/dashboard/admin/AcademicSessionManagement.jsx";

import StudentProfile from "../pages/dashboard/student/StudentProfile.jsx";
import StudentAcademicRecords from "../pages/dashboard/student/StudentAcademicRecords.jsx";
import StudentAttendance from "../pages/dashboard/student/StudentAttendance.jsx";
import StudentResults from "../pages/dashboard/student/StudentResults.jsx";
import StudentFees from "../pages/dashboard/student/StudentFees.jsx";

import TeacherProfile from "../pages/dashboard/teacher/TeacherProfile.jsx";
import TeacherClasses from "../pages/dashboard/teacher/TeacherClasses.jsx";
import TeacherSubjects from "../pages/dashboard/teacher/TeacherSubjects.jsx";
import TeacherStudents from "../pages/dashboard/teacher/TeacherStudents.jsx";
import TeacherAttendance from "../pages/dashboard/teacher/TeacherAttendance.jsx";
import TeacherAcademicRecords from "../pages/dashboard/teacher/TeacherAcademicRecords.jsx";
import TeacherResults from "../pages/dashboard/teacher/TeacherResults.jsx";

import AdminDashboard from "../pages/dashboard/admin/AdminOverview.jsx";
import TeacherDashboard from "../pages/dashboard/teacher/TeacherOverview.jsx";
import StudentDashboard from "../pages/dashboard/student/StudentOverview.jsx";
import "../pages/public-pages.css";

export function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
                path="/"
                element={
                    <main className="public-page public-home-page">
                        <h1>Home</h1>
                    </main>
                }
            />
            <Route path="/admin/dashboard" element={
                <ProtectedRoute role="admin">
                    <MainLayout>
                    </MainLayout>
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminDashboard />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="academic-structure" element={<AcademicStructure />} />
                <Route path="students" element={<StudentManagement />} />
                <Route path="teachers" element={<TeacherManagement />} />
                <Route path="academic-assignments" element={<AcademicAssignmentManagement />} />
                <Route path="admissions" element={<Admissions />} />
                <Route path="records" element={<AcademicRecords />} />
                <Route path="fees" element={<FeesFinance />} />
                <Route path="academic-sessions" element={<AcademicSessionManagement />} />
            </Route>
            <Route path="/student/dashboard" element={
                <ProtectedRoute role="student">
                    <MainLayout>
                    </MainLayout>
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<StudentDashboard />} />
                <Route path="student-profile" element={<StudentProfile />} />
                <Route path="student-academic-records" element={<StudentAcademicRecords />} />
                <Route path="student-attendance" element={<StudentAttendance />} />
                <Route path="student-results" element={<StudentResults />} />
                <Route path="student-fees" element={<StudentFees />} />
            </Route>

            {/* </Route> */}
            <Route path="/teacher/dashboard" element={
                <ProtectedRoute role="teacher">
                    <MainLayout>
                    </MainLayout>
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<TeacherDashboard />} />
                <Route path="teacher-profile" element={<TeacherProfile />} />
                <Route path="teacher-classes" element={<TeacherClasses />} />
                <Route path="teacher-subjects" element={<TeacherSubjects />} />
                <Route path="teacher-students" element={<TeacherStudents />} />
                <Route path="teacher-attendance" element={<TeacherAttendance />} />
                <Route path="teacher-records" element={<TeacherAcademicRecords />} />
                <Route path="teacher-results" element={<TeacherResults />} />
            </Route>

        </Routes>
    )
}