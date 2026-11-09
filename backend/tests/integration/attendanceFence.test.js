import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import express from "express";
import mongoose from "mongoose";
import process from "node:process";
import request from "supertest";
import AcademicAssignment from "../../models/AcademicAssignment.js";
import AcademicSession from "../../models/AcademicSession.js";
import Attendance from "../../models/Attendance.js";
import ClassSection from "../../models/ClassSection.js";
import Department from "../../models/Department.js";
import Program from "../../models/Program.js";
import Student from "../../models/Student.js";
import StudentEnrollment from "../../models/StudentEnrollment.js";
import Subject from "../../models/Subject.js";
import Teacher from "../../models/Teacher.js";
import User from "../../models/User.js";
import attendanceRoutes from "../../routes/attendanceRoutes.js";
import teacherAttendanceRoutes from "../../routes/teacherAttendanceRoutes.js";
import {
    createAcademicAssignment,
    createAdminUser,
    createAuthenticatedUser,
    createAcademicSession,
    createClassSection,
    createDepartment,
    createProgram,
    createStudent,
    createStudentEnrollment,
    createSubject,
    createTeacher,
} from "../support/fixtures.js";
import {
    clearTestDatabase,
    connectTestDatabase,
    disconnectTestDatabase,
} from "../support/testDatabase.js";

const indexedModels = [
    AcademicAssignment,
    AcademicSession,
    Attendance,
    ClassSection,
    Department,
    Program,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    User,
];

const TEST_DATE = "2026-03-10";
let app;

const authorizedRequest = (method, path, token) =>
    request(app)[method](path).set("Authorization", `Bearer ${token}`);

const createAttendanceContext = async () => {
    const department = await createDepartment();
    const program = await createProgram({ department: department._id });
    const classSection = await createClassSection(program);
    const subject = await createSubject(program);
    const adminActor = (await createAdminUser()).user;
    const teacher = await createTeacher(department, adminActor);
    const academicSession = await createAcademicSession(adminActor, {
        name: "2026",
    });
    await createAcademicAssignment({
        teacher,
        subject,
        classSection,
        session: "2026",
    });

    return {
        department,
        program,
        classSection,
        subject,
        teacher,
        academicSession,
        adminActor,
    };
};

const createTeacherAuth = (teacher) =>
    createAuthenticatedUser("teacher", { teacherId: teacher._id });

const enrollStudent = (student, classSection, academicSession, overrides = {}) =>
    createStudentEnrollment({
        student,
        classSection,
        academicSession,
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    });

before(async () => {
    await connectTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();
    await Promise.all(indexedModels.map((model) => model.createIndexes()));

    app = express();
    app.use(express.json());
    app.use("/api/attendances", attendanceRoutes);
    app.use("/api/teacher-attendance", teacherAttendanceRoutes);
});

after(async () => {
    await disconnectTestDatabase();
});

test("Admin Attendance creation persists for an active eligible Student and increments the Student fence", async () => {
    const { program, classSection, subject, teacher } =
        await createAttendanceContext();
    const student = await createStudent({ program: program._id });
    assert.equal(student.status, "active");
    const { user, token } = await createAdminUser({
        teacherId: teacher._id,
    });
    const startingVersion = student.__v;

    const response = await authorizedRequest(
        "post",
        "/api/attendances",
        token
    ).send({
        student: student._id.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
        session: "2026",
        status: "present",
    });

    assert.equal(response.status, 201);
    const savedAttendance = await Attendance.findById(
        response.body.newAttendance._id
    );
    assert.ok(savedAttendance);
    assert.equal(savedAttendance.student.toString(), student._id.toString());
    assert.equal(savedAttendance.teacher.toString(), teacher._id.toString());
    assert.equal((await Student.findById(student._id)).__v, startingVersion + 1);
    assert.equal(user.role, "admin");
});

test("Admin Attendance creation rejects an inactive Student without persisting Attendance or a fence", async () => {
    const { program, classSection, subject, teacher } =
        await createAttendanceContext();
    const student = await createStudent({
        program: program._id,
        status: "suspended",
    });
    const { token } = await createAdminUser({ teacherId: teacher._id });
    const startingVersion = student.__v;

    const response = await authorizedRequest(
        "post",
        "/api/attendances",
        token
    ).send({
        student: student._id.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
        session: "2026",
        status: "present",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Student is not eligible for this class.");
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("Admin Attendance creation rejects a cross-Program Student without persisting Attendance or a fence", async () => {
    const { classSection, subject, teacher } = await createAttendanceContext();
    const otherProgram = await createProgram();
    const student = await createStudent({ program: otherProgram._id });
    const { token } = await createAdminUser({ teacherId: teacher._id });
    const startingVersion = student.__v;

    const response = await authorizedRequest(
        "post",
        "/api/attendances",
        token
    ).send({
        student: student._id.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
        session: "2026",
        status: "present",
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Student is not eligible for this class.");
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("Admin Attendance creation rejects a missing Student without leaving a fence write", async () => {
    const { program, classSection, subject, teacher } =
        await createAttendanceContext();
    const student = await createStudent({ program: program._id });
    const missingStudentId = new mongoose.Types.ObjectId();
    const { token } = await createAdminUser({ teacherId: teacher._id });
    const startingVersion = student.__v;

    const response = await authorizedRequest(
        "post",
        "/api/attendances",
        token
    ).send({
        student: missingStudentId.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
        session: "2026",
        status: "present",
    });

    assert.equal(response.status, 404);
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("Teacher bulk Attendance succeeds for eligible Students and fences each Student", async () => {
    const { program, classSection, subject, teacher, academicSession } =
        await createAttendanceContext();
    const students = await Promise.all([
        createStudent({ program: program._id }),
        createStudent({ program: program._id }),
    ]);
    for (const student of students) {
        await enrollStudent(student, classSection, academicSession);
    }
    const versions = new Map(
        students.map((student) => [student._id.toString(), student.__v])
    );
    const { token } = await createTeacherAuth(teacher);

    const response = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: students.map((student, index) => ({
            studentId: student._id.toString(),
            status: index === 0 ? "present" : "late",
        })),
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.summary.total, 2);
    assert.equal(await Attendance.countDocuments(), 2);
    for (const student of students) {
        const savedStudent = await Student.findById(student._id);
        assert.equal(
            savedStudent.__v,
            versions.get(student._id.toString()) + 1
        );
        assert.equal(
            await Attendance.countDocuments({ student: student._id }),
            1
        );
    }
});

test("Teacher bulk Attendance rejects a missing Student without inserting or retaining fences", async () => {
    const { program, classSection, subject, teacher } =
        await createAttendanceContext();
    const validStudent = await createStudent({ program: program._id });
    const missingStudentId = new mongoose.Types.ObjectId();
    const startingVersion = validStudent.__v;
    const { token } = await createTeacherAuth(teacher);

    const response = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [
            { studentId: validStudent._id.toString(), status: "present" },
            { studentId: missingStudentId.toString(), status: "absent" },
        ],
    });

    assert.equal(response.status, 404);
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(validStudent._id)).__v, startingVersion);
});

test("Teacher bulk Attendance rejects Students outside the active class Program", async () => {
    const { classSection, subject, teacher } = await createAttendanceContext();
    const otherProgram = await createProgram();
    const ineligibleStudent = await createStudent({
        program: otherProgram._id,
    });
    const startingVersion = ineligibleStudent.__v;
    const { token } = await createTeacherAuth(teacher);

    const response = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [
            { studentId: ineligibleStudent._id.toString(), status: "present" },
        ],
    });

    assert.equal(response.status, 400);
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal(
        (await Student.findById(ineligibleStudent._id)).__v,
        startingVersion
    );
});

test("Duplicate Student in a bulk batch aborts inserted Attendance and Student fences", async () => {
    const { program, classSection, subject, teacher, academicSession } =
        await createAttendanceContext();
    const student = await createStudent({ program: program._id });
    await enrollStudent(student, classSection, academicSession);
    const startingVersion = student.__v;
    const { token } = await createTeacherAuth(teacher);

    const response = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [
            { studentId: student._id.toString(), status: "present" },
            { studentId: student._id.toString(), status: "absent" },
        ],
    });

    assert.equal(response.status, 500);
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("Teacher roster includes only active Students enrolled in the selected class and session", async () => {
    const {
        program,
        classSection,
        subject,
        teacher,
        academicSession,
        adminActor,
    } = await createAttendanceContext();
    const otherClass = await createClassSection(program, { section: "B" });
    const otherSession = await createAcademicSession(null, {
        name: "2026 Other",
        startDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-12-31T00:00:00.000Z"),
    });
    const correctStudent = await createStudent({ program: program._id });
    const otherClassStudent = await createStudent({ program: program._id });
    const otherSessionStudent = await createStudent({ program: program._id });
    const unEnrolledStudent = await createStudent({ program: program._id });
    const closedStudent = await createStudent({ program: program._id });
    const expiredStudent = await createStudent({ program: program._id });
    await enrollStudent(correctStudent, classSection, academicSession);
    await enrollStudent(otherClassStudent, otherClass, academicSession);
    await enrollStudent(otherSessionStudent, classSection, otherSession);
    await enrollStudent(closedStudent, classSection, academicSession, {
        status: "completed",
        endDate: new Date(`${TEST_DATE}T00:00:00.000Z`),
        endedAt: new Date(`${TEST_DATE}T12:00:00.000Z`),
        endReason: "completed",
        createdBy: adminActor._id,
        endedBy: adminActor._id,
    });
    await enrollStudent(expiredStudent, classSection, academicSession, {
        status: "withdrawn",
        endDate: new Date("2026-03-09T00:00:00.000Z"),
        endedAt: new Date("2026-03-09T12:00:00.000Z"),
        endReason: "withdrawn",
        createdBy: adminActor._id,
        endedBy: adminActor._id,
    });

    const { token } = await createTeacherAuth(teacher);
    const response = await authorizedRequest(
        "get",
        "/api/teacher-attendance/students",
        token
    ).query({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.students
            .map((student) => student._id.toString())
            .sort(),
        [correctStudent._id.toString(), closedStudent._id.toString()].sort()
    );
    assert.ok(!response.body.students.some(
        (student) => student._id.toString() === unEnrolledStudent._id.toString()
    ));
    assert.ok(!response.body.students.some(
        (student) => student._id.toString() === expiredStudent._id.toString()
    ));
});

test("Teacher attendance submission rejects a Student without a qualifying enrollment and rolls back fences", async () => {
    const { program, classSection, subject, teacher } =
        await createAttendanceContext();
    const student = await createStudent({ program: program._id });
    const startingVersion = student.__v;
    const { token } = await createTeacherAuth(teacher);

    const response = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [{ studentId: student._id.toString(), status: "present" }],
    });

    assert.equal(response.status, 400);
    assert.match(response.body.message, /valid enrollment/i);
    assert.equal(await Attendance.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("Teacher attendance remarks persist and are returned by session detail", async () => {
    const { program, classSection, subject, teacher, academicSession } =
        await createAttendanceContext();
    const student = await createStudent({ program: program._id });
    await enrollStudent(student, classSection, academicSession);
    const { token } = await createTeacherAuth(teacher);

    const submitted = await authorizedRequest(
        "post",
        "/api/teacher-attendance",
        token
    ).send({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [{
            studentId: student._id.toString(),
            status: "late",
            remarks: "Arrived after the bell",
        }],
    });
    assert.equal(submitted.status, 201);

    const saved = await Attendance.findOne({ student: student._id });
    assert.equal(saved.remarks, "Arrived after the bell");

    const detail = await authorizedRequest(
        "get",
        "/api/teacher-attendance/session",
        token
    ).query({
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
    });
    assert.equal(detail.status, 200);
    assert.equal(detail.body.records[0].remarks, "Arrived after the bell");
});

test("Attendance history distinguishes an empty result from a failed history query", async () => {
    const { teacher } = await createAttendanceContext();
    const { token } = await createTeacherAuth(teacher);

    const empty = await authorizedRequest(
        "get",
        "/api/teacher-attendance/history",
        token
    );
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.sessions, []);

    const originalAggregate = Attendance.aggregate;
    Attendance.aggregate = async () => {
        throw new Error("Simulated history query failure.");
    };
    try {
        const failed = await authorizedRequest(
            "get",
            "/api/teacher-attendance/history",
            token
        );
        assert.equal(failed.status, 500);
        assert.equal(failed.body.message, "Server Error");
    } finally {
        Attendance.aggregate = originalAggregate;
    }
});

test("Junior Teachers cannot update attendance; Senior Teachers can update status and remarks", async () => {
    const { classSection, subject, teacher } = await createAttendanceContext();
    const student = await createStudent({
        program: classSection.program,
    });
    const attendance = await Attendance.create({
        student: student._id,
        teacher: teacher._id,
        subject: subject._id,
        classSection: classSection._id,
        session: "2026",
        date: new Date(`${TEST_DATE}T00:00:00.000Z`),
        status: "present",
    });
    const { token } = await createTeacherAuth(teacher);
    const updatePayload = {
        classId: classSection._id.toString(),
        subjectId: subject._id.toString(),
        session: "2026",
        date: TEST_DATE,
        records: [{
            studentId: student._id.toString(),
            status: "absent",
            remarks: "Updated by senior",
        }],
    };

    const juniorResponse = await authorizedRequest(
        "put",
        "/api/teacher-attendance",
        token
    ).send(updatePayload);
    assert.equal(juniorResponse.status, 403);
    assert.equal((await Attendance.findById(attendance._id)).status, "present");

    teacher.role = "senior";
    await teacher.save();
    const seniorResponse = await authorizedRequest(
        "put",
        "/api/teacher-attendance",
        token
    ).send(updatePayload);
    assert.equal(seniorResponse.status, 200);
    assert.equal(seniorResponse.body.updatedCount, 1);
    const updated = await Attendance.findById(attendance._id);
    assert.equal(updated.status, "absent");
    assert.equal(updated.remarks, "Updated by senior");
});

test("Teacher attendance date lookup matches UTC-midnight records at the date boundary", async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
        const { program, classSection, subject, teacher, academicSession } =
            await createAttendanceContext();
        const student = await createStudent({ program: program._id });
        await enrollStudent(student, classSection, academicSession);
        await Attendance.create({
            student: student._id,
            teacher: teacher._id,
            subject: subject._id,
            classSection: classSection._id,
            session: "2026",
            date: new Date(`${TEST_DATE}T00:00:00.000Z`),
            status: "present",
        });
        const { token } = await createTeacherAuth(teacher);

        const response = await authorizedRequest(
            "get",
            "/api/teacher-attendance/students",
            token
        ).query({
            classId: classSection._id.toString(),
            subjectId: subject._id.toString(),
            session: "2026",
            date: TEST_DATE,
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.alreadySubmitted, true);
        assert.equal(response.body.students[0]._id.toString(), student._id.toString());
    } finally {
        if (originalTimeZone === undefined) delete process.env.TZ;
        else process.env.TZ = originalTimeZone;
    }
});

test("Teacher Attendance routes reject authenticated non-Teacher users", async () => {
    await createAttendanceContext();
    const { token } = await createAdminUser();

    const response = await authorizedRequest(
        "get",
        "/api/teacher-attendance/page-data",
        token
    );

    assert.equal(response.status, 403);
});
