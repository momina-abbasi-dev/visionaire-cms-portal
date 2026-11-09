import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import request from "supertest";
import mongoose from "mongoose";
import AcademicAssignment from "../../models/AcademicAssignment.js";
import AcademicRecord from "../../models/AcademicRecord.js";
import AcademicSession from "../../models/AcademicSession.js";
import Attendance from "../../models/Attendance.js";
import ClassSection from "../../models/ClassSection.js";
import Department from "../../models/Department.js";
import FeeRecord from "../../models/FeesFinance.js";
import Program from "../../models/Program.js";
import Result from "../../models/Result.js";
import Student from "../../models/Student.js";
import StudentEnrollment from "../../models/StudentEnrollment.js";
import Subject from "../../models/Subject.js";
import Teacher from "../../models/Teacher.js";
import User from "../../models/User.js";
import {
    createAcademicAssignment,
    createAcademicRecord,
    createAcademicSession,
    createAdminUser,
    createAttendance,
    createClassSection,
    createDepartment,
    createFeeRecord,
    createProgram,
    createResult,
    createStudent,
    createStudentEnrollment,
    createAuthenticatedUser,
    createSubject,
    createTeacher,
} from "../support/fixtures.js";
import {
    clearTestDatabase,
    connectTestDatabase,
    disconnectTestDatabase,
} from "../support/testDatabase.js";
import { createTestApp } from "../support/testApp.js";
import { acquireStudentWriteFence } from "../../utils/studentWriteFence.js";

const indexedModels = [
    AcademicAssignment,
    AcademicRecord,
    AcademicSession,
    Attendance,
    ClassSection,
    Department,
    FeeRecord,
    Program,
    Result,
    Student,
    StudentEnrollment,
    Subject,
    Teacher,
    User,
];

let app;
let adminToken;

const authenticatedRequest = (method, path) =>
    request(app)[method](path).set("Authorization", `Bearer ${adminToken}`);

const createStudentWithLinkedUser = async (program) => {
    const student = await createStudent({ program: program._id });
    const { user } = await createAuthenticatedUser("student", {
        studentId: student._id,
    });
    return { student, user };
};

const createAssignmentContext = async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    await ensureAcademicSession("2026");
    const assignment = await createAcademicAssignment({
        classSection,
        session: "2026",
    });
    const [teacher, subject] = await Promise.all([
        Teacher.findById(assignment.teacher),
        Subject.findById(assignment.subject),
    ]);

    return { assignment, program, classSection, teacher, subject };
};

const ensureAcademicSession = async (name, overrides = {}) => {
    const existing = await AcademicSession.findOne({ name });
    if (existing) return existing;
    return createAcademicSession(null, { name, ...overrides });
};

const utcDateOffset = (days) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + days);
    return date;
};

const createTeacherRosterContext = async () => {
    const context = await createAssignmentContext();
    const academicSession = await AcademicSession.findOneAndUpdate(
        { name: context.assignment.session },
        { $set: {
        startDate: utcDateOffset(-365),
        endDate: utcDateOffset(365),
            status: "active",
        } },
        { new: true }
    );
    const actor = await createAdminUser();
    return { ...context, academicSession, actor: actor.user };
};

const createRosterEnrollment = (
    { classSection, academicSession, actor },
    { student, ...overrides }
) => createStudentEnrollment({
    student,
    classSection,
    academicSession,
    createdBy: actor._id,
    startDate: utcDateOffset(-30),
    ...overrides,
});

const teacherRequest = async (method, path, teacher) => {
    const { token } = await createAuthenticatedUser("teacher", {
        teacherId: teacher._id,
    });
    return request(app)[method](path).set("Authorization", `Bearer ${token}`);
};

const assignmentUpdatePayload = (context, overrides = {}) => ({
    teacher: context.teacher._id.toString(),
    subject: context.subject._id.toString(),
    classSection: context.classSection._id.toString(),
    session: context.assignment.session,
    ...overrides,
});

const studentCreationPayload = (program, suffix = new mongoose.Types.ObjectId()) => ({
    name: `Created Student ${suffix}`,
    rollNo: `CR-${suffix}`,
    email: `created-${suffix}@example.test`,
    cnic: `CC-${suffix}`,
    dob: "2005-01-01",
    contact: "0000000000",
    address: "Test address",
    city: "Test city",
    program: program._id.toString(),
    password: "student-password",
});

const snapshotStudent = async (id) => {
    const savedStudent = await Student.findById(id).lean();
    assert.ok(savedStudent);
    return {
        _id: savedStudent._id.toString(),
        __v: savedStudent.__v,
        name: savedStudent.name,
        email: savedStudent.email,
        cnic: savedStudent.cnic,
        rollNo: savedStudent.rollNo,
        program: savedStudent.program.toString(),
        status: savedStudent.status,
        updatedAt: savedStudent.updatedAt.toISOString(),
    };
};

const snapshotUser = async (id) => {
    const savedUser = await User.findById(id).lean();
    assert.ok(savedUser);
    return {
        _id: savedUser._id.toString(),
        __v: savedUser.__v,
        name: savedUser.name,
        email: savedUser.email,
        cnic: savedUser.cnic,
        role: savedUser.role,
        status: savedUser.status,
        studentId: savedUser.studentId?.toString(),
        updatedAt: savedUser.updatedAt.toISOString(),
    };
};

const snapshotProgram = async (id) => {
    const savedProgram = await Program.findById(id).lean();
    assert.ok(savedProgram);
    return {
        _id: savedProgram._id.toString(),
        totalSeats: savedProgram.totalSeats,
        availableSeats: savedProgram.availableSeats,
        department: savedProgram.department.toString(),
        updatedAt: savedProgram.updatedAt.toISOString(),
    };
};

const assertDeletionUnchanged = async ({
    student,
    user,
    program,
    beforeStudent,
    beforeUser,
    beforeProgram,
}) => {
    assert.deepEqual(await snapshotStudent(student._id), beforeStudent);
    assert.deepEqual(await snapshotUser(user._id), beforeUser);
    assert.deepEqual(await snapshotProgram(program._id), beforeProgram);
};

before(async () => {
    await connectTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();
    await Promise.all(indexedModels.map((model) => model.createIndexes()));
    app = createTestApp();
    const admin = await createAdminUser();
    adminToken = admin.token;
});

after(async () => {
    await disconnectTestDatabase();
});

test("Student creation atomically allocates one Program seat and preserves its response", async () => {
    const program = await createProgram({
        totalSeats: 2,
        availableSeats: 1,
    });
    const payload = studentCreationPayload(program);

    const response = await authenticatedRequest("post", "/api/students")
        .send(payload);

    assert.equal(response.status, 201);
    assert.equal(response.body.message, "Student created successfully.");
    assert.equal(response.body.student.program._id, program._id.toString());
    assert.equal(response.body.user.studentId._id, response.body.student._id);
    assert.equal((await Program.findById(program._id)).availableSeats, 0);
    assert.equal(await Student.countDocuments({ program: program._id }), 1);
    assert.equal(
        await User.countDocuments({ studentId: response.body.student._id }),
        1
    );
});

test("Student statistics are available to Admins and forbidden to other authenticated roles", async () => {
    const program = await createProgram();
    await createStudent({ program: program._id });
    await createStudent({ program: program._id, status: "suspended" });

    const adminResponse = await authenticatedRequest(
        "get",
        "/api/students/stats"
    );
    assert.equal(adminResponse.status, 200);
    assert.equal(adminResponse.body.totalStudents, 2);
    assert.equal(adminResponse.body.activeStudents, 1);
    assert.equal(adminResponse.body.suspendedStudents, 1);

    for (const role of ["teacher", "student"]) {
        const { token } = await createAuthenticatedUser(role);
        const response = await request(app)
            .get("/api/students/stats")
            .set("Authorization", `Bearer ${token}`);
        assert.equal(response.status, 403, `${role} should be forbidden`);
    }
});

test("Admin dashboard returns genuine zero values and denies non-Admin access", async () => {
    const response = await authenticatedRequest(
        "get",
        "/api/dashboard/admin/overview"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.summary.unpaidFees, 0);
    assert.equal(response.body.summary.overdueFees, 0);
    assert.equal(response.body.summary.studentsWithDues, 0);
    assert.equal(response.body.summary.pendingRecords, 0);

    const { token } = await createAuthenticatedUser("student");
    const forbiddenResponse = await request(app)
        .get("/api/dashboard/admin/overview")
        .set("Authorization", `Bearer ${token}`);
    assert.equal(forbiddenResponse.status, 403);
});

test("Admin dashboard marks a failed metric unavailable while preserving other metric values", async () => {
    const student = await createStudent();
    await createFeeRecord(student, { status: "unpaid" });
    await createFeeRecord(student, {
        dueDate: new Date("2000-01-01T00:00:00.000Z"),
    });
    await createAcademicRecord({ student }, { status: "pending" });

    const originalCountDocuments = FeeRecord.countDocuments;
    FeeRecord.countDocuments = function (filter, ...args) {
        if (
            filter?.status?.$in?.includes("unpaid") &&
            filter.status.$in.includes("partial")
        ) {
            throw new Error("Injected unpaid fee metric failure.");
        }
        return originalCountDocuments.call(this, filter, ...args);
    };

    let response;
    try {
        response = await authenticatedRequest(
            "get",
            "/api/dashboard/admin/overview"
        );
    } finally {
        FeeRecord.countDocuments = originalCountDocuments;
    }

    assert.equal(response.status, 200);
    assert.equal(response.body.summary.unpaidFees, null);
    assert.equal(response.body.summary.overdueFees, 1);
    assert.equal(response.body.summary.studentsWithDues, 1);
    assert.equal(response.body.summary.pendingRecords, 1);
    assert.equal(response.body.summary.totalStudents, 1);
});

test("Student creation at full Program capacity is rejected without writes", async () => {
    const program = await createProgram({
        totalSeats: 1,
        availableSeats: 0,
    });

    const response = await authenticatedRequest("post", "/api/students")
        .send(studentCreationPayload(program));

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "No seats available in this program.");
    assert.equal(await Student.countDocuments(), 0);
    assert.equal(await User.countDocuments(), 1);
    assert.equal((await Program.findById(program._id)).availableSeats, 0);
});

test("Student creation failure rolls back Student, User, and Program seat allocation", async () => {
    const program = await createProgram({
        totalSeats: 1,
        availableSeats: 1,
    });
    const originalSave = User.prototype.save;
    User.prototype.save = async function (options) {
        if (this.role === "student") {
            throw new Error("Injected linked User failure.");
        }
        return originalSave.call(this, options);
    };

    let response;
    try {
        response = await authenticatedRequest("post", "/api/students")
            .send(studentCreationPayload(program));
    } finally {
        User.prototype.save = originalSave;
    }

    assert.equal(response.status, 500);
    assert.equal(await Student.countDocuments(), 0);
    assert.equal(await User.countDocuments(), 1);
    assert.equal((await Program.findById(program._id)).availableSeats, 1);
});

test("Concurrent Student creation against the final Program seat allocates at most one seat", async () => {
    const program = await createProgram({
        totalSeats: 1,
        availableSeats: 1,
    });
    const payloads = [
        studentCreationPayload(program),
        studentCreationPayload(program),
    ];

    const responses = await Promise.all(
        payloads.map((payload) =>
            authenticatedRequest("post", "/api/students").send(payload)
        )
    );

    assert.equal(
        responses.filter((response) => response.status === 201).length,
        1
    );
    assert.equal(
        responses.filter((response) => response.status === 400).length,
        1
    );
    assert.equal(
        responses.find((response) => response.status === 400).body.message,
        "No seats available in this program."
    );
    assert.equal((await Program.findById(program._id)).availableSeats, 0);
    assert.equal(await Student.countDocuments({ program: program._id }), 1);
    assert.equal(
        await User.countDocuments({
            studentId: {
                $in: (await Student.find({ program: program._id })).map(
                    (student) => student._id
                ),
            },
        }),
        1
    );
});

test("Student status update succeeds without closing enrollment history", async () => {
    const program = await createProgram({ totalSeats: 10, availableSeats: 9 });
    const { student } = await createStudentWithLinkedUser(program);
    const enrollment = await createStudentEnrollment({ student });

    const response = await authenticatedRequest(
        "put",
        `/api/students/${student._id}`
    ).send({ status: "suspended" });

    assert.equal(response.status, 200);
    assert.equal(response.body.student.status, "suspended");
    const savedStudent = await Student.findById(student._id);
    assert.equal(savedStudent.status, "suspended");
    const unchangedEnrollment = await StudentEnrollment.findById(enrollment._id);
    assert.equal(unchangedEnrollment.status, "active");
});

test("Student Program change updates both Programs' seat counts", async () => {
    const oldProgram = await createProgram({
        totalSeats: 10,
        availableSeats: 9,
    });
    const newProgram = await createProgram({
        department: oldProgram.department,
        totalSeats: 10,
        availableSeats: 4,
    });
    const { student } = await createStudentWithLinkedUser(oldProgram);

    const response = await authenticatedRequest(
        "put",
        `/api/students/${student._id}`
    ).send({ program: newProgram._id.toString() });

    assert.equal(response.status, 200);
    assert.equal(response.body.student.program._id, newProgram._id.toString());
    assert.equal(
        (await Program.findById(oldProgram._id)).availableSeats,
        10
    );
    assert.equal(
        (await Program.findById(newProgram._id)).availableSeats,
        3
    );
});

test("Student Program change is rejected when enrollment history exists", async () => {
    const oldProgram = await createProgram({
        totalSeats: 10,
        availableSeats: 9,
    });
    const newProgram = await createProgram({
        department: oldProgram.department,
        totalSeats: 10,
        availableSeats: 4,
    });
    const { student } = await createStudentWithLinkedUser(oldProgram);
    await createStudentEnrollment({ student });

    const response = await authenticatedRequest(
        "put",
        `/api/students/${student._id}`
    ).send({ program: newProgram._id.toString() });

    assert.equal(response.status, 409);
    assert.equal((await Student.findById(student._id)).program.toString(), oldProgram._id.toString());
    assert.equal((await Program.findById(oldProgram._id)).availableSeats, 9);
    assert.equal((await Program.findById(newProgram._id)).availableSeats, 4);
});

test("Missing old Program rolls back the Student write fence", async () => {
    const oldProgram = await createProgram({
        totalSeats: 10,
        availableSeats: 9,
    });
    const newProgram = await createProgram({
        department: oldProgram.department,
        totalSeats: 10,
        availableSeats: 4,
    });
    const { student, user } = await createStudentWithLinkedUser(oldProgram);
    const startingVersion = student.__v;
    const beforeStudent = await snapshotStudent(student._id);
    const beforeUser = await snapshotUser(user._id);
    const beforeNewProgram = await snapshotProgram(newProgram._id);
    await Program.deleteOne({ _id: oldProgram._id });

    const response = await authenticatedRequest(
        "put",
        `/api/students/${student._id}`
    ).send({ program: newProgram._id.toString() });

    assert.equal(response.status, 409);
    const unchangedStudent = await Student.findById(student._id);
    assert.equal(unchangedStudent.program.toString(), oldProgram._id.toString());
    assert.equal(unchangedStudent.__v, startingVersion);
    assert.deepEqual(await snapshotStudent(student._id), beforeStudent);
    assert.deepEqual(await snapshotUser(user._id), beforeUser);
    assert.deepEqual(await snapshotProgram(newProgram._id), beforeNewProgram);
});

test("Insufficient new Program seats roll back all Student changes", async () => {
    const oldProgram = await createProgram({
        totalSeats: 10,
        availableSeats: 9,
    });
    const newProgram = await createProgram({
        department: oldProgram.department,
        totalSeats: 10,
        availableSeats: 0,
    });
    const { student, user } = await createStudentWithLinkedUser(oldProgram);
    const startingVersion = student.__v;
    const beforeStudent = await snapshotStudent(student._id);
    const beforeUser = await snapshotUser(user._id);
    const beforeOldProgram = await snapshotProgram(oldProgram._id);
    const beforeNewProgram = await snapshotProgram(newProgram._id);

    const response = await authenticatedRequest(
        "put",
        `/api/students/${student._id}`
    ).send({
        program: newProgram._id.toString(),
        name: "Should not persist",
    });

    assert.equal(response.status, 400);
    const unchangedStudent = await Student.findById(student._id);
    assert.equal(unchangedStudent.program.toString(), oldProgram._id.toString());
    assert.equal(unchangedStudent.name, student.name);
    assert.equal(unchangedStudent.__v, startingVersion);
    assert.deepEqual(await snapshotStudent(student._id), beforeStudent);
    assert.deepEqual(await snapshotUser(user._id), beforeUser);
    assert.deepEqual(await snapshotProgram(oldProgram._id), beforeOldProgram);
    assert.deepEqual(await snapshotProgram(newProgram._id), beforeNewProgram);
});

test("Student without history can be deleted with linked User and seat restored", async () => {
    const program = await createProgram({ totalSeats: 10, availableSeats: 9 });
    const { student, user } = await createStudentWithLinkedUser(program);

    const response = await authenticatedRequest(
        "delete",
        `/api/students/${student._id}`
    );

    assert.equal(response.status, 200);
    assert.equal(await Student.exists({ _id: student._id }), null);
    assert.equal(await User.exists({ _id: user._id }), null);
    assert.equal((await Program.findById(program._id)).availableSeats, 10);
});

const historyDeletionCases = [
    ["StudentEnrollment", async (student) => createStudentEnrollment({ student })],
    ["AcademicRecord", async (student) => createAcademicRecord({ student })],
    ["Attendance", async (student) => createAttendance({ student })],
    ["Result", async (student) => createResult({ student })],
    ["FeeRecord", async (student) => createFeeRecord(student)],
];

for (const [historyName, createHistory] of historyDeletionCases) {
    test(`Student deletion is blocked by ${historyName} without partial changes`, async () => {
        const program = await createProgram({
            totalSeats: 10,
            availableSeats: 9,
        });
        const { student, user } = await createStudentWithLinkedUser(program);
        const beforeStudent = await snapshotStudent(student._id);
        const beforeUser = await snapshotUser(user._id);
        const beforeProgram = await snapshotProgram(program._id);
        await createHistory(student);

        const response = await authenticatedRequest(
            "delete",
            `/api/students/${student._id}`
        );

        assert.equal(response.status, 409);
        await assertDeletionUnchanged({
            student,
            user,
            program,
            beforeStudent,
            beforeUser,
            beforeProgram,
        });
    });
}

test("AcademicSession boundary update succeeds when enrollment dates remain in range", async () => {
    const session = await createAcademicSession(
        (await createAdminUser()).user
    );

    const response = await authenticatedRequest(
        "patch",
        `/api/academic-sessions/${session._id}`
    ).send({
        startDate: "2026-02-01",
        endDate: "2026-11-30",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.session.startDate.slice(0, 10), "2026-02-01");
    assert.equal(response.body.session.endDate.slice(0, 10), "2026-11-30");
    const savedSession = await AcademicSession.findById(session._id);
    assert.equal(savedSession.startDate.toISOString(), "2026-02-01T00:00:00.000Z");
    assert.equal(savedSession.endDate.toISOString(), "2026-11-30T00:00:00.000Z");
});

test("AcademicSession boundary update rejects a closed enrollment endDate outside the proposed range", async () => {
    const actor = (await createAdminUser()).user;
    const session = await createAcademicSession(actor);
    const program = await createProgram();
    const student = await createStudent({ program: program._id });
    const classSection = await createClassSection(program);
    await createStudentEnrollment({
        student,
        classSection,
        academicSession: session,
        createdBy: actor,
        status: "completed",
        startDate: new Date("2026-02-01T00:00:00.000Z"),
        endDate: new Date("2026-10-01T00:00:00.000Z"),
        endedAt: new Date("2026-10-01T00:00:00.000Z"),
        endReason: "Completed",
        endedBy: actor._id,
    });

    const response = await authenticatedRequest(
        "patch",
        `/api/academic-sessions/${session._id}`
    ).send({ endDate: "2026-06-30" });

    assert.equal(response.status, 409);
    assert.match(response.body.message, /start or end date/i);
    const unchangedSession = await AcademicSession.findById(session._id);
    assert.equal(
        unchangedSession.endDate.toISOString(),
        "2026-12-31T00:00:00.000Z"
    );
});

const enrollmentStatuses = [
    {
        status: "active",
        closure: {},
    },
    {
        status: "completed",
        closure: {
            endDate: new Date("2026-07-01T00:00:00.000Z"),
            endedAt: new Date("2026-07-01T00:00:00.000Z"),
            endReason: "Completed",
        },
    },
    {
        status: "transferred",
        closure: {
            endDate: new Date("2026-07-01T00:00:00.000Z"),
            endedAt: new Date("2026-07-01T00:00:00.000Z"),
            endReason: "Transferred",
        },
    },
    {
        status: "withdrawn",
        closure: {
            endDate: new Date("2026-07-01T00:00:00.000Z"),
            endedAt: new Date("2026-07-01T00:00:00.000Z"),
            endReason: "Withdrawn",
        },
    },
];

for (const { status, closure } of enrollmentStatuses) {
    test(`AcademicSession boundary update rejects ${status} enrollment dates`, async () => {
        const actor = (await createAdminUser()).user;
        const session = await createAcademicSession(actor);
        const program = await createProgram();
        const student = await createStudent({ program: program._id });
        const classSection = await createClassSection(program);
        await createStudentEnrollment({
            student,
            classSection,
            academicSession: session,
            createdBy: actor,
            status,
            ...closure,
            ...(status === "active" ? {} : { endedBy: actor._id }),
        });

        const response = await authenticatedRequest(
            "patch",
            `/api/academic-sessions/${session._id}`
        ).send({ startDate: "2026-07-01" });

        assert.equal(response.status, 409);
        const unchangedSession = await AcademicSession.findById(session._id);
        assert.equal(
            unchangedSession.startDate.toISOString(),
            "2026-01-01T00:00:00.000Z"
        );
    });
}

test("ClassSection compatible update succeeds", async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);

    const response = await authenticatedRequest(
        "put",
        `/api/classes/${classSection._id}`
    ).send({ name: "Updated Test Class" });

    assert.equal(response.status, 200);
    assert.equal(response.body.class.name, "Updated Test Class");
    assert.equal(response.body.class.program._id, program._id.toString());
    const savedClass = await ClassSection.findById(classSection._id);
    assert.equal(savedClass.name, "Updated Test Class");
    assert.equal(savedClass.program.toString(), program._id.toString());
    assert.equal(savedClass.department.toString(), program.department.toString());
});

test("ClassSection Program and Department changes are rejected with enrollment history", async () => {
    const department = await createDepartment();
    const program = await createProgram({ department: department._id });
    const classSection = await createClassSection(program);
    const student = await createStudent({ program: program._id });
    const actor = (await createAdminUser()).user;
    const academicSession = await createAcademicSession(actor);
    await createStudentEnrollment({
        student,
        classSection,
        academicSession,
        createdBy: actor,
    });

    const newDepartment = await createDepartment();
    const newProgram = await createProgram({ department: newDepartment._id });
    const response = await authenticatedRequest(
        "put",
        `/api/classes/${classSection._id}`
    ).send({
        program: newProgram._id.toString(),
        department: newDepartment._id.toString(),
    });

    assert.equal(response.status, 409);
    const unchangedClass = await ClassSection.findById(classSection._id);
    assert.equal(unchangedClass.program.toString(), program._id.toString());
    assert.equal(unchangedClass.department.toString(), department._id.toString());
});

test("ClassSection relationship changes are rejected with Attendance history, while unrelated updates remain allowed", async () => {
    const department = await createDepartment();
    const program = await createProgram({ department: department._id });
    const classSection = await createClassSection(program);
    const attendance = await createAttendance({ classSection });
    const beforeAttendance = await Attendance.findById(attendance._id).lean();
    const newDepartment = await createDepartment();
    const newProgram = await createProgram({ department: newDepartment._id });

    const relationshipResponse = await authenticatedRequest(
        "put",
        `/api/classes/${classSection._id}`
    ).send({
        program: newProgram._id.toString(),
        department: newDepartment._id.toString(),
    });

    assert.equal(relationshipResponse.status, 409);
    assert.match(relationshipResponse.body.message, /attendance history exists/i);
    const unchangedClass = await ClassSection.findById(classSection._id);
    assert.equal(unchangedClass.program.toString(), program._id.toString());
    assert.equal(unchangedClass.department.toString(), department._id.toString());
    assert.deepEqual(
        await Attendance.findById(attendance._id).lean(),
        beforeAttendance
    );

    const unrelatedResponse = await authenticatedRequest(
        "put",
        `/api/classes/${classSection._id}`
    ).send({ name: "Renamed Historical Class" });

    assert.equal(unrelatedResponse.status, 200);
    assert.equal(unrelatedResponse.body.class.name, "Renamed Historical Class");
    const updatedClass = await ClassSection.findById(classSection._id);
    assert.equal(updatedClass.program.toString(), program._id.toString());
    assert.equal(updatedClass.department.toString(), department._id.toString());
    assert.deepEqual(
        await Attendance.findById(attendance._id).lean(),
        beforeAttendance
    );
});

test("ClassSection deletion is blocked by AcademicAssignment", async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    await createAcademicAssignment({ classSection });

    const response = await authenticatedRequest(
        "delete",
        `/api/classes/${classSection._id}`
    );

    assert.equal(response.status, 400);
    assert.ok(await ClassSection.exists({ _id: classSection._id }));
});

test("ClassSection deletion is blocked by Attendance history without changing either record", async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    const attendance = await createAttendance({ classSection });
    const beforeAttendance = await Attendance.findById(attendance._id).lean();

    const response = await authenticatedRequest(
        "delete",
        `/api/classes/${classSection._id}`
    );

    assert.equal(response.status, 409);
    assert.match(response.body.message, /attendance history exists/i);
    assert.ok(await ClassSection.exists({ _id: classSection._id }));
    assert.deepEqual(
        await Attendance.findById(attendance._id).lean(),
        beforeAttendance
    );
});

test("ClassSection without dependent history can still be deleted", async () => {
    const classSection = await createClassSection();

    const response = await authenticatedRequest(
        "delete",
        `/api/classes/${classSection._id}`
    );

    assert.equal(response.status, 200);
    assert.equal(
        response.body.message,
        "Class section deleted successfully."
    );
    assert.equal(await ClassSection.exists({ _id: classSection._id }), null);
});

test("Admin can update an assignment in place and the existing tuple does not conflict with itself", async () => {
    const context = await createAssignmentContext();
    await ensureAcademicSession("2027");
    const newTeacher = await createTeacher(
        await Department.findById(context.teacher.department),
        (await createAdminUser()).user
    );
    const newClassSection = await createClassSection(context.program, {
        name: `Updated ${new mongoose.Types.ObjectId()}`,
    });
    const newSubject = await createSubject(context.program, {
        name: `Updated ${new mongoose.Types.ObjectId()}`,
        code: `UP${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    });
    const originalId = context.assignment._id.toString();
    const response = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${originalId}`
    ).send({
        teacher: newTeacher._id.toString(),
        subject: newSubject._id.toString(),
        classSection: newClassSection._id.toString(),
        session: " 2027 ",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.assignment._id, originalId);
    assert.equal(response.body.assignment.teacher._id, newTeacher._id.toString());
    assert.equal(response.body.assignment.subject._id, newSubject._id.toString());
    assert.equal(
        response.body.assignment.classSection._id,
        newClassSection._id.toString()
    );
    assert.equal(response.body.assignment.session, "2027");
    const saved = await AcademicAssignment.findById(context.assignment._id);
    assert.equal(saved._id.toString(), originalId);
    assert.equal(saved.teacher.toString(), newTeacher._id.toString());
    assert.equal(saved.subject.toString(), newSubject._id.toString());
    assert.equal(saved.classSection.toString(), newClassSection._id.toString());
    assert.equal(saved.session, "2027");

    const selfUpdate = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${originalId}`
    ).send({
        teacher: newTeacher._id.toString(),
        subject: newSubject._id.toString(),
        classSection: newClassSection._id.toString(),
        session: "2027",
        isActive: true,
    });
    assert.equal(selfUpdate.status, 200);
    assert.equal(selfUpdate.body.assignment._id, originalId);
    assert.equal(await AcademicAssignment.countDocuments(), 1);
});

test("Academic assignment updates reject non-Admins and malformed or missing assignment IDs", async () => {
    const context = await createAssignmentContext();
    const teacherUser = await createAuthenticatedUser("teacher");
    const forbidden = await request(app)
        .patch(`/api/academicAssignments/${context.assignment._id}`)
        .set("Authorization", `Bearer ${teacherUser.token}`)
        .send(assignmentUpdatePayload(context));
    assert.equal(forbidden.status, 403);
    const deactivateForbidden = await request(app)
        .patch(
            `/api/academicAssignments/${context.assignment._id}/deactivate`
        )
        .set("Authorization", `Bearer ${teacherUser.token}`)
        .send({});
    assert.equal(deactivateForbidden.status, 403);

    const malformed = await authenticatedRequest(
        "patch",
        "/api/academicAssignments/not-an-id"
    ).send({ session: "2027" });
    assert.equal(malformed.status, 400);

    const missing = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${new mongoose.Types.ObjectId()}`
    ).send({ session: "2027" });
    assert.equal(missing.status, 404);
    assert.equal(
        (await AcademicAssignment.findById(context.assignment._id)).session,
        context.assignment.session
    );
});

test("Academic assignment updates validate Teacher, Subject, ClassSection, and session eligibility", async () => {
    const context = await createAssignmentContext();
    const invalidId = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ teacher: "invalid-id" });
    assert.equal(invalidId.status, 400);
    const invalidSubjectId = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ subject: "invalid-id" });
    assert.equal(invalidSubjectId.status, 400);
    const invalidClassId = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ classSection: "invalid-id" });
    assert.equal(invalidClassId.status, 400);

    const missingTeacher = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({
        teacher: new mongoose.Types.ObjectId().toString(),
    });
    assert.equal(missingTeacher.status, 404);

    await Teacher.updateOne(
        { _id: context.teacher._id },
        { $set: { status: "suspended" } }
    );
    const inactiveTeacher = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send(assignmentUpdatePayload(context));
    assert.equal(inactiveTeacher.status, 400);
    await Teacher.updateOne(
        { _id: context.teacher._id },
        { $set: { status: "active" } }
    );

    const missingSubject = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ subject: new mongoose.Types.ObjectId().toString() });
    assert.equal(missingSubject.status, 404);
    const missingClass = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ classSection: new mongoose.Types.ObjectId().toString() });
    assert.equal(missingClass.status, 404);
    const missingSession = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ session: "  " });
    assert.equal(missingSession.status, 400);

    const otherDepartment = await createDepartment();
    const incompatibleTeacher = await createTeacher(
        otherDepartment,
        (await createAdminUser()).user
    );
    const incompatibleTeacherResponse = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ teacher: incompatibleTeacher._id.toString() });
    assert.equal(incompatibleTeacherResponse.status, 400);

    const otherProgram = await createProgram();
    const incompatibleSubject = await createSubject(otherProgram);
    const incompatibleSubjectResponse = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ subject: incompatibleSubject._id.toString() });
    assert.equal(incompatibleSubjectResponse.status, 400);

    const otherClassSection = await createClassSection(otherProgram);
    const incompatibleClassResponse = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ classSection: otherClassSection._id.toString() });
    assert.equal(incompatibleClassResponse.status, 400);
    assert.equal(
        (await AcademicAssignment.findById(context.assignment._id)).session,
        context.assignment.session
    );
});

test("Academic assignment creation accepts existing trimmed session names and rejects unknown names", async () => {
    const context = await createAssignmentContext();
    await ensureAcademicSession("2027");
    const classSection = await createClassSection(context.program, {
        name: `Create Session ${new mongoose.Types.ObjectId()}`,
    });
    const subject = await createSubject(context.program, {
        name: `Create Session ${new mongoose.Types.ObjectId()}`,
        code: `CS${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    });
    const payload = {
        teacher: context.teacher._id.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
    };

    const created = await authenticatedRequest(
        "post",
        "/api/academicAssignments"
    ).send({ ...payload, session: " 2027 " });
    assert.equal(created.status, 201);
    assert.equal(created.body.assignment.session, "2027");

    const unknown = await authenticatedRequest(
        "post",
        "/api/academicAssignments"
    ).send({ ...payload, session: "2099" });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.message, "Academic session not found");

    const blank = await authenticatedRequest(
        "post",
        "/api/academicAssignments"
    ).send({ ...payload, session: "  " });
    assert.equal(blank.status, 400);
    assert.equal(blank.body.message, "Session is required");
    assert.equal(await AcademicAssignment.countDocuments(), 2);
});

test("Academic assignment updates accept existing trimmed session names and reject unknown names", async () => {
    const context = await createAssignmentContext();
    await ensureAcademicSession("2027");
    const path = `/api/academicAssignments/${context.assignment._id}`;

    const updated = await authenticatedRequest("patch", path)
        .send({ session: " 2027 " });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.assignment.session, "2027");

    const unknown = await authenticatedRequest("patch", path)
        .send({ session: "2099" });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.message, "Academic session not found");

    const blank = await authenticatedRequest("patch", path)
        .send({ session: "  " });
    assert.equal(blank.status, 400);
    assert.equal(blank.body.message, "Session is required");
    assert.equal(
        (await AcademicAssignment.findById(context.assignment._id)).session,
        "2027"
    );
});

test("Academic assignment update rejects a duplicate active tuple but permits inactive tuple edits", async () => {
    const context = await createAssignmentContext();
    const otherClass = await createClassSection(context.program, {
        name: `Other ${new mongoose.Types.ObjectId()}`,
    });
    const secondAssignment = await createAcademicAssignment({
        classSection: otherClass,
        teacher: context.teacher,
        subject: context.subject,
        session: "2027",
    });

    const duplicate = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${secondAssignment._id}`
    ).send({
        classSection: context.classSection._id.toString(),
        session: context.assignment.session,
    });
    assert.equal(duplicate.status, 409);

    const deactivateFirst = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}`
    ).send({ isActive: false });
    assert.equal(deactivateFirst.status, 200);
    assert.equal(deactivateFirst.body.assignment.isActive, false);
    const inactiveUpdate = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${secondAssignment._id}`
    ).send({
        classSection: context.classSection._id.toString(),
        session: context.assignment.session,
    });
    assert.equal(inactiveUpdate.status, 200);
    assert.equal(inactiveUpdate.body.assignment.isActive, true);
    assert.equal(await AcademicAssignment.countDocuments(), 2);
});

test("Admin deactivation retains the assignment and leaves AcademicRecords and Attendance unchanged", async () => {
    const context = await createAssignmentContext();
    const student = await createStudent({
        program: context.program._id,
    });
    const actor = (await createAdminUser()).user;
    const historyContext = {
        student,
        classSection: context.classSection,
        teacher: context.teacher,
        subject: context.subject,
        createdBy: actor,
    };
    const record = await createAcademicRecord(historyContext, {
        session: context.assignment.session,
    });
    const attendance = await createAttendance(historyContext, {
        session: context.assignment.session,
    });
    const beforeRecord = await AcademicRecord.findById(record._id).lean();
    const beforeAttendance = await Attendance.findById(attendance._id).lean();

    const response = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}/deactivate`
    ).send({});
    assert.equal(response.status, 200);
    assert.equal(response.body.assignment.isActive, false);
    assert.ok(await AcademicAssignment.exists({ _id: context.assignment._id }));
    assert.equal(
        (await AcademicAssignment.findById(context.assignment._id)).isActive,
        false
    );
    assert.deepEqual(
        await AcademicRecord.findById(record._id).lean(),
        beforeRecord
    );
    assert.deepEqual(
        await Attendance.findById(attendance._id).lean(),
        beforeAttendance
    );

    const repeated = await authenticatedRequest(
        "patch",
        `/api/academicAssignments/${context.assignment._id}/deactivate`
    ).send({});
    assert.equal(repeated.status, 409);
    assert.equal(await AcademicRecord.countDocuments(), 1);
    assert.equal(await Attendance.countDocuments(), 1);
});

test("Academic assignment create and list contracts remain unchanged", async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    const teacher = await createTeacher(
        await Department.findById(program.department),
        (await createAdminUser()).user
    );
    const subject = await createSubject(program);
    await ensureAcademicSession("2026");

    const created = await authenticatedRequest(
        "post",
        "/api/academicAssignments"
    ).send({
        teacher: teacher._id.toString(),
        subject: subject._id.toString(),
        classSection: classSection._id.toString(),
        session: "2026",
    });
    assert.equal(created.status, 201);
    assert.ok(created.body.assignment._id);
    assert.equal(created.body.assignment.isActive, true);

    const listed = await authenticatedRequest(
        "get",
        "/api/academicAssignments"
    );
    assert.equal(listed.status, 200);
    assert.equal(listed.body.assignments.length, 1);
    assert.equal(
        listed.body.assignments[0]._id,
        created.body.assignment._id
    );
});

test("ClassSection deletion is blocked by enrollment references", async () => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    const student = await createStudent({ program: program._id });
    const actor = (await createAdminUser()).user;
    const academicSession = await createAcademicSession(actor);
    await createStudentEnrollment({
        student,
        classSection,
        academicSession,
        createdBy: actor,
    });

    const response = await authenticatedRequest(
        "delete",
        `/api/classes/${classSection._id}`
    );

    assert.equal(response.status, 409);
    assert.ok(await ClassSection.exists({ _id: classSection._id }));
});

test("A stale conditional Student __v write matches no document", async () => {
    const student = await createStudent();
    const staleVersion = student.__v;
    const transactionSession = await mongoose.startSession();

    try {
        await transactionSession.withTransaction(async () => {
            const fencedStudent = await acquireStudentWriteFence(
                student._id,
                transactionSession
            );
            assert.equal(fencedStudent.__v, staleVersion + 1);
        });
    } finally {
        await transactionSession.endSession();
    }

    const staleFence = await Student.updateOne(
        { _id: student._id, __v: staleVersion },
        { $inc: { __v: 1 } }
    );
    assert.equal(staleFence.matchedCount, 0);
    assert.equal((await Student.findById(student._id)).__v, staleVersion + 1);
});

test("Failed Program change aborts its transaction without partial writes", async () => {
    const oldProgram = await createProgram({
        totalSeats: 5,
        availableSeats: 4,
    });
    const newProgram = await createProgram({
        department: oldProgram.department,
        totalSeats: 5,
        availableSeats: 1,
    });
    const { student } = await createStudentWithLinkedUser(oldProgram);
    const linkedUser = await User.findOne({ studentId: student._id });
    const priorVersion = student.__v;
    const beforeStudent = await snapshotStudent(student._id);
    const beforeUser = await snapshotUser(linkedUser._id);
    const beforeOldProgram = await snapshotProgram(oldProgram._id);
    const beforeNewProgram = await snapshotProgram(newProgram._id);
    const originalUpdateOne = Program.updateOne;
    Program.updateOne = function (filter, ...args) {
        if (filter?._id?.toString() === newProgram._id.toString()) {
            throw new Error("Injected failure after Student and User saves.");
        }
        return originalUpdateOne.call(this, filter, ...args);
    };

    let response;
    try {
        response = await authenticatedRequest(
            "put",
            `/api/students/${student._id}`
        ).send({
            program: newProgram._id.toString(),
            status: "suspended",
            name: "Changed inside failed transaction",
        });
    } finally {
        Program.updateOne = originalUpdateOne;
    }

    assert.equal(response.status, 500);
    assert.deepEqual(await snapshotStudent(student._id), beforeStudent);
    assert.equal((await Student.findById(student._id)).__v, priorVersion);
    assert.deepEqual(await snapshotUser(linkedUser._id), beforeUser);
    assert.deepEqual(await snapshotProgram(oldProgram._id), beforeOldProgram);
    assert.deepEqual(await snapshotProgram(newProgram._id), beforeNewProgram);
});

test("Teacher roster includes enrolled Students without attendance or academic records", async () => {
    const context = await createTeacherRosterContext();
    const student = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, { student });

    const response = await teacherRequest(
        "get",
        "/api/teacher-students",
        context.teacher
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.stats.totalStudents, 1);
    assert.equal(response.body.students.length, 1);
    assert.equal(response.body.students[0]._id.toString(), student._id.toString());
    assert.equal(response.body.students[0].recordCount, 0);
    assert.equal(response.body.students[0].totalAtt, 0);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    assert.equal(await Attendance.countDocuments(), 0);
});

test("Teacher roster and profile scope follow the Teacher's assigned classes", async () => {
    const context = await createTeacherRosterContext();
    const secondClass = await createClassSection(context.program, { section: "B" });
    const secondSubject = await createSubject(context.program);
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: secondSubject,
        classSection: secondClass,
        session: context.assignment.session,
    });

    const otherTeacher = await createTeacher(
        await Department.findById(context.program.department),
        context.actor
    );
    const otherTeacherClass = await createClassSection(
        context.program,
        { section: "C" }
    );
    const otherTeacherSubject = await createSubject(context.program);
    await createAcademicAssignment({
        teacher: otherTeacher,
        subject: otherTeacherSubject,
        classSection: otherTeacherClass,
        session: context.assignment.session,
    });

    const firstClassStudent = await createStudent({ program: context.program._id });
    const secondClassStudent = await createStudent({ program: context.program._id });
    const otherTeacherStudent = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, { student: firstClassStudent });
    await createRosterEnrollment(context, {
        student: secondClassStudent,
        classSection: secondClass,
    });
    await createRosterEnrollment(context, {
        student: otherTeacherStudent,
        classSection: otherTeacherClass,
    });

    const assignedStudents = await teacherRequest(
        "get",
        "/api/teacher-students",
        context.teacher
    );
    assert.equal(assignedStudents.status, 200);
    assert.deepEqual(
        assignedStudents.body.students
            .map(student => student._id.toString())
            .sort(),
        [firstClassStudent._id.toString(), secondClassStudent._id.toString()].sort()
    );

    const filtered = await teacherRequest(
        "get",
        `/api/teacher-students?classId=${context.classSection._id}`,
        context.teacher
    );
    assert.equal(filtered.status, 200);
    assert.deepEqual(
        filtered.body.students.map(student => student._id.toString()),
        [firstClassStudent._id.toString()]
    );

    const forbiddenProfile = await teacherRequest(
        "get",
        `/api/teacher-students/${otherTeacherStudent._id}`,
        context.teacher
    );
    assert.equal(forbiddenProfile.status, 403);
});

test("Teacher Student profile subjects are limited to the Student's enrolled class and session", async () => {
    const context = await createTeacherRosterContext();
    const student = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, { student });

    const otherClass = await createClassSection(context.program, { section: "B" });
    const otherClassSubject = await createSubject(context.program);
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: otherClassSubject,
        classSection: otherClass,
        session: context.assignment.session,
    });

    await createAcademicSession(context.actor, {
        name: "2027",
        startDate: utcDateOffset(-365),
        endDate: utcDateOffset(365),
        status: "active",
    });
    const otherSessionSubject = await createSubject(context.program);
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: otherSessionSubject,
        classSection: context.classSection,
        session: "2027",
    });

    const response = await teacherRequest(
        "get",
        `/api/teacher-students/${student._id}`,
        context.teacher
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.enrolledSubjects.map(subject => subject._id.toString()),
        [context.subject._id.toString()]
    );
    assert.deepEqual(response.body.enrolledSubjects[0].classes, [
        `${context.classSection.name} — ${context.classSection.section}`,
    ]);
});

test("Teacher roster excludes enrollments for another AcademicSession", async () => {
    const context = await createTeacherRosterContext();
    const otherSession = await createAcademicSession(context.actor, {
        name: "2027",
        startDate: utcDateOffset(-365),
        endDate: utcDateOffset(365),
    });
    const student = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, {
        student,
        academicSession: otherSession,
    });

    const response = await teacherRequest(
        "get",
        "/api/teacher-students",
        context.teacher
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.stats.totalStudents, 0);
    assert.deepEqual(response.body.students, []);
});

test("Teacher roster includes only enrollments in an active in-range AcademicSession", async () => {
    const context = await createTeacherRosterContext();
    const today = utcDateOffset(0);
    const sessionCases = [
        {
            session: "planned",
            name: "2027-planned",
            status: "planned",
            startDate: utcDateOffset(-30),
            endDate: utcDateOffset(30),
        },
        {
            session: "completed",
            name: "2028-completed",
            status: "completed",
            startDate: utcDateOffset(-30),
            endDate: utcDateOffset(30),
        },
        {
            session: "not-started",
            name: "2029-not-started",
            status: "active",
            startDate: utcDateOffset(1),
            endDate: utcDateOffset(30),
        },
        {
            session: "expired",
            name: "2030-expired",
            status: "active",
            startDate: utcDateOffset(-30),
            endDate: utcDateOffset(-1),
        },
    ];
    const excludedStudents = [];

    for (const sessionCase of sessionCases) {
        const academicSession = await createAcademicSession(context.actor, {
            name: sessionCase.name,
            status: sessionCase.status,
            startDate: sessionCase.startDate,
            endDate: sessionCase.endDate,
        });
        await createAcademicAssignment({
            teacher: context.teacher,
            subject: context.subject,
            classSection: context.classSection,
            session: sessionCase.name,
        });
        const student = await createStudent({ program: context.program._id });
        await createRosterEnrollment(context, {
            student,
            academicSession,
            startDate: today,
        });
        excludedStudents.push(student._id.toString());
    }

    const currentStudent = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, {
        student: currentStudent,
        startDate: today,
    });

    const response = await teacherRequest(
        "get",
        "/api/teacher-students",
        context.teacher
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.students.map(student => student._id.toString()),
        [currentStudent._id.toString()]
    );
    assert.ok(excludedStudents.every(id =>
        !response.body.students.some(student => student._id.toString() === id)
    ));
});

test("Teacher roster excludes not-yet-started and expired enrollments", async () => {
    const context = await createTeacherRosterContext();
    const futureStudent = await createStudent({ program: context.program._id });
    const expiredStudent = await createStudent({ program: context.program._id });
    const currentStudent = await createStudent({ program: context.program._id });
    await createRosterEnrollment(context, {
        student: futureStudent,
        startDate: utcDateOffset(1),
    });
    await createRosterEnrollment(context, {
        student: expiredStudent,
        status: "withdrawn",
        endDate: utcDateOffset(-1),
        endedAt: new Date(),
        endReason: "withdrawn",
        endedBy: context.actor._id,
    });
    await createRosterEnrollment(context, { student: currentStudent });

    const response = await teacherRequest(
        "get",
        "/api/teacher-students",
        context.teacher
    );

    assert.equal(response.status, 200);
    assert.deepEqual(
        response.body.students.map(student => student._id.toString()),
        [currentStudent._id.toString()]
    );
});

test("Teacher cannot access a Student enrolled only outside the Teacher's active assignment scope", async () => {
    const context = await createTeacherRosterContext();
    const student = await createStudent({ program: context.program._id });
    const otherClass = await createClassSection(context.program, { section: "B" });
    await createRosterEnrollment(context, { student, classSection: otherClass });

    const response = await teacherRequest(
        "get",
        `/api/teacher-students/${student._id}`,
        context.teacher
    );

    assert.equal(response.status, 403);
});

test("Test schemas and transaction test database remain connected", () => {
    assert.equal(
        mongoose.connection.getClient().topology.description.type,
        "ReplicaSetWithPrimary"
    );
});
