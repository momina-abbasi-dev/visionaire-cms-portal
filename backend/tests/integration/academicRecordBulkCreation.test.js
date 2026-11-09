import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import request from "supertest";
import AcademicAssignment from "../../models/AcademicAssignment.js";
import AcademicRecord from "../../models/AcademicRecord.js";
import ClassSection from "../../models/ClassSection.js";
import Department from "../../models/Department.js";
import Program from "../../models/Program.js";
import Student from "../../models/Student.js";
import Subject from "../../models/Subject.js";
import Teacher from "../../models/Teacher.js";
import User from "../../models/User.js";
import {
    createAcademicAssignment,
    createAcademicRecord,
    createAdminUser,
    createAuthenticatedUser,
    createClassSection,
    createDepartment,
    createProgram,
    createStudent,
    createSubject,
    createTeacher,
} from "../support/fixtures.js";
import {
    clearTestDatabase,
    connectTestDatabase,
    disconnectTestDatabase,
} from "../support/testDatabase.js";
import { createTestApp } from "../support/testApp.js";

const indexedModels = [
    AcademicAssignment,
    AcademicRecord,
    ClassSection,
    Department,
    Program,
    Student,
    Subject,
    Teacher,
    User,
];

let app;

const createContext = async ({ assignmentSession } = {}) => {
    const department = await createDepartment();
    const program = await createProgram({ department: department._id });
    const classSection = await createClassSection(program);
    const subject = await createSubject(program);
    const creator = await createAdminUser();
    const teacher = await createTeacher(department, creator.user);
    const teacherAuth = await createAuthenticatedUser("teacher", {
        teacherId: teacher._id,
    });

    if (assignmentSession) {
        await createAcademicAssignment({
            teacher,
            subject,
            classSection,
            session: assignmentSession,
        });
    }

    return {
        department,
        program,
        classSection,
        subject,
        creator: creator.user,
        teacher,
        teacherUser: teacherAuth.user,
        teacherToken: teacherAuth.token,
    };
};

const postRecords = (context, records, overrides = {}) =>
    request(app)
        .post("/api/teacher-records")
        .set("Authorization", `Bearer ${context.teacherToken}`)
        .send({
            classId: context.classSection._id.toString(),
            subjectId: context.subject._id.toString(),
            examType: "quiz",
            session: "2026",
            records,
            submitMode: "draft",
            ...overrides,
        });

const makeRecord = (student, overrides = {}) => ({
    studentId: student._id.toString(),
    marks: 8,
    remarks: "Quiz work",
    ...overrides,
});

const assertNoRecordsAndUnchangedStudents = async (students) => {
    assert.equal(await AcademicRecord.countDocuments(), 0);
    for (const { student, startingVersion } of students) {
        assert.equal((await Student.findById(student._id)).__v, startingVersion);
    }
};

before(async () => {
    await connectTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();
    await Promise.all(indexedModels.map((model) => model.createIndexes()));
    app = createTestApp();
});

after(async () => {
    await disconnectTestDatabase();
});

test("Teacher academic-record page data is built from active AcademicAssignments", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    await createAcademicRecord(
        {
            student,
            classSection: context.classSection,
            teacher: context.teacher,
            subject: context.subject,
            createdBy: context.teacherUser,
        },
        { session: "2026", examType: "quiz" }
    );

    const inactiveClass = await createClassSection(context.program);
    const inactiveSubject = await createSubject(context.program);
    await createAcademicAssignment(
        {
            teacher: context.teacher,
            classSection: inactiveClass,
            subject: inactiveSubject,
            session: "2025",
        },
        { isActive: false }
    );

    const response = await request(app)
        .get("/api/teacher-records/page-data")
        .set("Authorization", `Bearer ${context.teacherToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.stats.totalClasses, 1);
    assert.equal(response.body.stats.totalSubjects, 1);
    assert.equal(response.body.classes.length, 1);
    assert.equal(
        response.body.classes[0].subjects[0]._id,
        context.subject._id.toString()
    );
    assert.equal(response.body.recentRecords.length, 1);
    assert.equal(response.body.recentRecords[0].studentName, student.name);
});

test("Teacher academic-record roster requires the exact active assignment tuple and session", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const [activeStudent, inactiveStudent] = await Promise.all([
        createStudent({ program: context.program._id }),
        createStudent({ program: context.program._id, status: "suspended" }),
    ]);
    await createAcademicRecord(
        {
            student: activeStudent,
            classSection: context.classSection,
            teacher: context.teacher,
            subject: context.subject,
            createdBy: context.teacherUser,
        },
        { session: "2026", examType: "quiz", marks: 7 }
    );

    const params = new URLSearchParams({
        classId: context.classSection._id.toString(),
        subjectId: context.subject._id.toString(),
        examType: "quiz",
        session: "2026",
    });
    const response = await request(app)
        .get(`/api/teacher-records/students?${params}`)
        .set("Authorization", `Bearer ${context.teacherToken}`);

    assert.equal(response.status, 200);
    assert.equal(response.body.students.length, 1);
    assert.equal(response.body.students[0]._id, activeStudent._id.toString());
    assert.equal(response.body.students[0].marks, 7);
    assert.equal(response.body.hasExisting, true);

    const wrongSessionResponse = await request(app)
        .get(`/api/teacher-records/students?${new URLSearchParams({
            ...Object.fromEntries(params),
            session: "2025",
        })}`)
        .set("Authorization", `Bearer ${context.teacherToken}`);
    assert.equal(wrongSessionResponse.status, 403);
    assert.ok(await Student.exists({ _id: inactiveStudent._id }));
});

test("Teacher submitted history and detail only include records for active assignment tuples", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const recordContext = {
        student,
        classSection: context.classSection,
        teacher: context.teacher,
        subject: context.subject,
        createdBy: context.teacherUser,
    };
    await createAcademicRecord(recordContext, {
        session: "2026",
        examType: "quiz",
        status: "verified",
    });
    await createAcademicAssignment(
        {
            teacher: context.teacher,
            classSection: context.classSection,
            subject: context.subject,
            session: "2025",
        },
        { isActive: false }
    );
    await createAcademicRecord(recordContext, {
        session: "2025",
        examType: "quiz",
        status: "verified",
    });

    const historyParams = new URLSearchParams({
        classId: context.classSection._id.toString(),
        subjectId: context.subject._id.toString(),
        examType: "quiz",
    });
    const historyResponse = await request(app)
        .get(`/api/teacher-records/submitted?${historyParams}`)
        .set("Authorization", `Bearer ${context.teacherToken}`);

    assert.equal(historyResponse.status, 200);
    assert.equal(historyResponse.body.groups.length, 1);
    assert.equal(historyResponse.body.groups[0].session, "2026");
    assert.equal(historyResponse.body.groups[0].totalCount, 1);

    const detailParams = new URLSearchParams({
        classId: context.classSection._id.toString(),
        subjectId: context.subject._id.toString(),
        examType: "quiz",
        session: "2026",
    });
    const detailResponse = await request(app)
        .get(`/api/teacher-records/detail?${detailParams}`)
        .set("Authorization", `Bearer ${context.teacherToken}`);
    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.records.length, 1);

    detailParams.set("session", "2025");
    const inactiveDetailResponse = await request(app)
        .get(`/api/teacher-records/detail?${detailParams}`)
        .set("Authorization", `Bearer ${context.teacherToken}`);
    assert.equal(inactiveDetailResponse.status, 403);
});

test("teacher bulk creation persists records for multiple eligible Students and increments every fence", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const students = await Promise.all([
        createStudent({ program: context.program._id }),
        createStudent({ program: context.program._id }),
    ]);
    const startingVersions = students.map((student) => student.__v);

    const response = await postRecords(context, students.map(makeRecord));

    assert.equal(response.status, 200);
    assert.equal(response.body.savedCount, 2);
    assert.equal(response.body.submittedCount, 0);
    assert.equal(response.body.status, "pending");
    assert.equal(await AcademicRecord.countDocuments(), 2);
    for (let index = 0; index < students.length; index++) {
        const student = await Student.findById(students[index]._id);
        assert.equal(student.__v, startingVersions[index] + 1);
        const record = await AcademicRecord.findOne({
            student: students[index]._id,
            teacher: context.teacher._id,
            classSection: context.classSection._id,
            subject: context.subject._id,
            examType: "quiz",
            session: "2026",
        });
        assert.ok(record);
        assert.equal(record.createdBy.toString(), context.teacherUser._id.toString());
        assert.equal(record.marks, 8);
        assert.equal(record.remarks, "Quiz work");
    }
});

test("bulk request with a missing Student rejects all writes and retains no fences", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    const missingStudentId = "0123456789abcdef01234567";

    const response = await postRecords(context, [
        makeRecord(student),
        { studentId: missingStudentId, marks: 6 },
    ]);

    assert.equal(response.status, 404);
    await assertNoRecordsAndUnchangedStudents([
        { student, startingVersion },
    ]);
});

test("bulk request with an inactive Student rejects all writes and retains no fences", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const students = await Promise.all([
        createStudent({ program: context.program._id }),
        createStudent({ program: context.program._id, status: "suspended" }),
    ]);
    const savedStudents = students.map((student) => ({
        student,
        startingVersion: student.__v,
    }));

    const response = await postRecords(context, students.map(makeRecord));

    assert.equal(response.status, 400);
    await assertNoRecordsAndUnchangedStudents(savedStudents);
});

test("bulk request with a cross-Program Student rejects all writes and retains no fences", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const otherProgram = await createProgram();
    const students = await Promise.all([
        createStudent({ program: context.program._id }),
        createStudent({ program: otherProgram._id }),
    ]);
    const savedStudents = students.map((student) => ({
        student,
        startingVersion: student.__v,
    }));

    const response = await postRecords(context, students.map(makeRecord));

    assert.equal(response.status, 400);
    await assertNoRecordsAndUnchangedStudents(savedStudents);
});

test("bulk request safely rejects a Student with no Program reference", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    await Student.collection.updateOne(
        { _id: student._id },
        { $unset: { program: "" } }
    );

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 400);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("bulk request safely rejects a ClassSection with no Program reference", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    await ClassSection.collection.updateOne(
        { _id: context.classSection._id },
        { $unset: { program: "" } }
    );

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 404);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("bulk request safely rejects a ClassSection with no Department reference", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    await ClassSection.collection.updateOne(
        { _id: context.classSection._id },
        { $unset: { department: "" } }
    );

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 404);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("duplicate Student IDs in a batch are rejected before writes", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [
        makeRecord(student),
        makeRecord(student, { marks: 5 }),
    ]);

    assert.equal(response.status, 400);
    assert.match(response.body.message, /duplicate student ids/i);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("malformed Student ID rejects the batch without records or fence increments", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [
        makeRecord(student),
        { studentId: "not-an-object-id", marks: 6 },
    ]);

    assert.equal(response.status, 400);
    assert.match(response.body.message, /valid studentId/i);
    await assertNoRecordsAndUnchangedStudents([
        { student, startingVersion },
    ]);
});

test("missing AcademicAssignment rejects the batch without writes or fences", async () => {
    const context = await createContext();
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("inactive AcademicAssignment rejects the batch without writes or fences", async () => {
    const context = await createContext();
    await createAcademicAssignment(
        {
            teacher: context.teacher,
            subject: context.subject,
            classSection: context.classSection,
            session: "2026",
        },
        { isActive: false }
    );
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("assignment for a different teacher rejects the batch without records or fence increments", async () => {
    const context = await createContext();
    const otherTeacher = await createTeacher(context.department, context.creator);
    await createAcademicAssignment({
        teacher: otherTeacher,
        subject: context.subject,
        classSection: context.classSection,
        session: "2026",
    });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("assignment for a different subject rejects the batch without records or fence increments", async () => {
    const context = await createContext();
    const otherSubject = await createSubject(context.program);
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: otherSubject,
        classSection: context.classSection,
        session: "2026",
    });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("assignment for a different ClassSection rejects the batch without records or fence increments", async () => {
    const context = await createContext();
    const otherClassSection = await createClassSection(context.program);
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: context.subject,
        classSection: otherClassSection,
        session: "2026",
    });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("assignment with a different session rejects the batch without records or fence increments", async () => {
    const context = await createContext();
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: context.subject,
        classSection: context.classSection,
        session: "2027",
    });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    await assertNoRecordsAndUnchangedStudents([{ student, startingVersion }]);
});

test("existing draft records update only within the complete session identity", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const existing = await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 4,
        examType: "quiz",
        session: "2026",
        remarks: "Before",
        status: "pending",
        createdBy: context.creator._id,
    });

    const response = await postRecords(context, [
        makeRecord(student, { marks: 9, remarks: "Updated" }),
    ]);

    assert.equal(response.status, 200);
    assert.equal(response.body.savedCount, 1);
    assert.equal(await AcademicRecord.countDocuments(), 1);
    const updated = await AcademicRecord.findById(existing._id);
    assert.equal(updated.marks, 9);
    assert.equal(updated.remarks, "Updated");
    assert.equal(updated.status, "pending");
    assert.equal(updated.createdBy.toString(), context.creator._id.toString());
});

test("different AcademicSession creates a separate record without changing the earlier session", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const earlier = await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 4,
        examType: "quiz",
        session: "2026",
        remarks: "Earlier",
        status: "pending",
        createdBy: context.creator._id,
    });
    const earlierSnapshot = await AcademicRecord.findById(earlier._id).lean();
    await createAcademicAssignment({
        teacher: context.teacher,
        subject: context.subject,
        classSection: context.classSection,
        session: "2027",
    });

    const response = await postRecords(context, [
        makeRecord(student, { marks: 9, remarks: "Later" }),
    ], { session: "2027" });

    assert.equal(response.status, 200);
    assert.equal(await AcademicRecord.countDocuments(), 2);
    const earlierAfter = await AcademicRecord.findById(earlier._id).lean();
    assert.equal(earlierAfter.marks, earlierSnapshot.marks);
    assert.equal(earlierAfter.remarks, earlierSnapshot.remarks);
    assert.equal(earlierAfter.session, earlierSnapshot.session);
    assert.equal(earlierAfter.updatedAt.getTime(), earlierSnapshot.updatedAt.getTime());
    assert.equal(await AcademicRecord.countDocuments({
        student: student._id,
        session: "2027",
        examType: "quiz",
    }), 1);
});

test("verified record in the same session remains protected for a junior teacher", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const verified = await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 7,
        examType: "quiz",
        session: "2026",
        remarks: "Verified",
        status: "verified",
        createdBy: context.creator._id,
    });
    const startingVersion = student.__v;

    const response = await postRecords(context, [makeRecord(student)]);

    assert.equal(response.status, 403);
    assert.equal(response.body.lockedCount, 1);
    assert.equal(await AcademicRecord.countDocuments(), 1);
    const unchanged = await AcademicRecord.findById(verified._id);
    assert.equal(unchanged.marks, 7);
    assert.equal(unchanged.status, "verified");
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("verified record in another session does not block the requested session", async () => {
    const context = await createContext({ assignmentSession: "2027" });
    const student = await createStudent({ program: context.program._id });
    const verified = await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 7,
        examType: "quiz",
        session: "2026",
        remarks: "Prior verified",
        status: "verified",
        createdBy: context.creator._id,
    });
    const before = await AcademicRecord.findById(verified._id).lean();

    const response = await postRecords(context, [makeRecord(student)], {
        session: "2027",
    });

    assert.equal(response.status, 200);
    assert.equal(await AcademicRecord.countDocuments(), 2);
    const unchanged = await AcademicRecord.findById(verified._id).lean();
    assert.equal(unchanged.marks, before.marks);
    assert.equal(unchanged.status, before.status);
    assert.equal(unchanged.session, before.session);
    assert.equal(unchanged.updatedAt.getTime(), before.updatedAt.getTime());
});

test("submit mode preserves verified submission status and response counts", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });

    const response = await postRecords(
        context,
        [makeRecord(student)],
        { submitMode: "submit" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "verified");
    assert.equal(response.body.savedCount, 1);
    assert.equal(response.body.submittedCount, 1);
    assert.equal((await AcademicRecord.findOne({ student: student._id })).status, "verified");
});

test("injected failure after the first upsert rolls back the full batch and Student fences", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const students = await Promise.all([
        createStudent({ program: context.program._id }),
        createStudent({ program: context.program._id }),
    ]);
    const savedStudents = students.map((student) => ({
        student,
        startingVersion: student.__v,
    }));
    const originalFindOneAndUpdate = AcademicRecord.findOneAndUpdate;
    let injectedFailure = false;

    AcademicRecord.findOneAndUpdate = function (...args) {
        const query = originalFindOneAndUpdate.apply(this, args);
        const originalExec = query.exec.bind(query);
        query.exec = async (...execArgs) => {
            const result = await originalExec(...execArgs);
            if (args[2]?.session && !injectedFailure) {
                injectedFailure = true;
                throw new Error("Injected failure after AcademicRecord upsert.")
            }
            return result;
        };
        return query;
    };

    let response;
    try {
        response = await postRecords(context, students.map(makeRecord));
    } finally {
        AcademicRecord.findOneAndUpdate = originalFindOneAndUpdate;
    }

    assert.equal(injectedFailure, true);
    assert.equal(response.status, 500);
    await assertNoRecordsAndUnchangedStudents(savedStudents);
});

test("non-teacher role cannot submit through the production teacher route", async () => {
    const context = await createContext({ assignmentSession: "2026" });
    const student = await createStudent({ program: context.program._id });
    const admin = await createAdminUser();

    const response = await request(app)
        .post("/api/teacher-records")
        .set("Authorization", `Bearer ${admin.token}`)
        .send({
            classId: context.classSection._id.toString(),
            subjectId: context.subject._id.toString(),
            examType: "quiz",
            session: "2026",
            records: [makeRecord(student)],
            submitMode: "draft",
        });

    assert.equal(response.status, 403);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, 0);
});
