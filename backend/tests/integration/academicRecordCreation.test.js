import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose from "mongoose";
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

const createRecordContext = async ({ assignment = "active" } = {}) => {
    const department = await createDepartment();
    const program = await createProgram({ department: department._id });
    const classSection = await createClassSection(program);
    const subject = await createSubject(program);
    const creator = await createAdminUser();
    const teacher = await createTeacher(department, creator.user);
    const authenticatedTeacher = await createAuthenticatedUser("teacher", {
        teacherId: teacher._id,
    });

    if (assignment !== "missing") {
        await createAcademicAssignment(
            { teacher, subject, classSection, session: "2026" },
            { isActive: assignment === "active" }
        );
    }

    return {
        program,
        classSection,
        subject,
        teacher,
        creator: creator.user,
        authenticatedTeacher: authenticatedTeacher.user,
        token: authenticatedTeacher.token,
    };
};

const postRecord = (context, studentId, overrides = {}) =>
    request(app)
        .post("/api/records/create")
        .set("Authorization", `Bearer ${context.token}`)
        .send({
            subject: context.subject._id.toString(),
            student: studentId.toString(),
            classSection: context.classSection._id.toString(),
            marks: 82,
            examType: "quiz",
            session: "2026",
            remarks: "Assessment",
            ...overrides,
        });

const assertRejectedWithoutPersistence = async ({
    response,
    studentId,
    startingVersion,
    expectedStatus = 400,
}) => {
    assert.equal(response.status, expectedStatus);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    if (startingVersion !== undefined) {
        assert.equal((await Student.findById(studentId)).__v, startingVersion);
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

test("manual AcademicRecord creation persists an eligible record and fences its Student", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecord(context, student._id);

    assert.equal(response.status, 201);
    assert.equal(response.body.message, "Academic record submitted for review.");
    assert.equal(response.body.record.student._id, student._id.toString());
    assert.equal(response.body.record.status, "pending");

    const savedRecord = await AcademicRecord.findById(response.body.record._id);
    assert.ok(savedRecord);
    assert.equal(savedRecord.student.toString(), student._id.toString());
    assert.equal(savedRecord.teacher.toString(), context.teacher._id.toString());
    assert.equal(savedRecord.classSection.toString(), context.classSection._id.toString());
    assert.equal(savedRecord.subject.toString(), context.subject._id.toString());
    assert.equal(savedRecord.marks, 82);
    assert.equal(savedRecord.session, "2026");
    assert.equal(savedRecord.remarks, "Assessment");
    assert.equal(
        savedRecord.createdBy.toString(),
        context.authenticatedTeacher._id.toString()
    );
    assert.equal((await Student.findById(student._id)).__v, startingVersion + 1);
});

test("manual AcademicRecord creation rejects a missing Student without persistence", async () => {
    const context = await createRecordContext();
    const missingStudentId = new mongoose.Types.ObjectId();

    const response = await postRecord(context, missingStudentId);

    assert.equal(response.status, 404);
    assert.equal(response.body.message, "Student not found.");
    assert.equal(await AcademicRecord.countDocuments(), 0);

    const studentAfterRequest = await createStudent({
        _id: missingStudentId,
        program: context.program._id,
    });
    assert.equal(studentAfterRequest.__v, 0);
});

test("manual AcademicRecord creation rejects an inactive Student and rolls back its fence", async () => {
    const context = await createRecordContext();
    const student = await createStudent({
        program: context.program._id,
        status: "suspended",
    });
    const startingVersion = student.__v;

    const response = await postRecord(context, student._id);

    assert.equal(response.body.message, "Student is not eligible for this class.");
    await assertRejectedWithoutPersistence({
        response,
        studentId: student._id,
        startingVersion,
    });
});

test("manual AcademicRecord creation rejects a cross-Program Student and rolls back its fence", async () => {
    const context = await createRecordContext();
    const otherProgram = await createProgram();
    const student = await createStudent({ program: otherProgram._id });
    const startingVersion = student.__v;

    const response = await postRecord(context, student._id);

    assert.equal(response.body.message, "Student is not eligible for this class.");
    await assertRejectedWithoutPersistence({
        response,
        studentId: student._id,
        startingVersion,
    });
});

test("manual AcademicRecord creation safely rejects a missing Student Program reference", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    await Student.collection.updateOne(
        { _id: student._id },
        { $unset: { program: "" } }
    );

    const response = await postRecord(context, student._id);

    assert.equal(response.body.message, "Student is not eligible for this class.");
    await assertRejectedWithoutPersistence({
        response,
        studentId: student._id,
        startingVersion,
    });
});

test("manual AcademicRecord creation safely rejects a missing ClassSection Program reference", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    await ClassSection.collection.updateOne(
        { _id: context.classSection._id },
        { $unset: { program: "" } }
    );

    const response = await postRecord(context, student._id);

    assert.equal(response.body.message, "Student is not eligible for this class.");
    await assertRejectedWithoutPersistence({
        response,
        studentId: student._id,
        startingVersion,
    });
});

test("manual AcademicRecord creation rejects an inactive assignment", async () => {
    const context = await createRecordContext({ assignment: "inactive" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecord(context, student._id);

    assert.equal(response.status, 403);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("manual AcademicRecord creation rejects a missing assignment", async () => {
    const context = await createRecordContext({ assignment: "missing" });
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;

    const response = await postRecord(context, student._id);

    assert.equal(response.status, 403);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("manual AcademicRecord creation rejects duplicate logical identity without changing the saved record", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    const existingRecord = await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 61,
        examType: "quiz",
        session: "2026",
        remarks: "Original",
        status: "pending",
        createdBy: context.creator._id,
    });
    const startingVersion = student.__v;
    const before = await AcademicRecord.findById(existingRecord._id).lean();

    const response = await postRecord(context, student._id);

    assert.equal(response.status, 409);
    assert.match(response.body.message, /already exists/i);
    assert.equal(await AcademicRecord.countDocuments(), 1);
    const after = await AcademicRecord.findById(existingRecord._id).lean();
    assert.equal(after.marks, before.marks);
    assert.equal(after.remarks, before.remarks);
    assert.equal(after.status, before.status);
    assert.equal(after.session, before.session);
    assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime());
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});

test("manual AcademicRecord creation permits the same logical identity in a different session", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    await AcademicRecord.create({
        student: student._id,
        teacher: context.teacher._id,
        classSection: context.classSection._id,
        subject: context.subject._id,
        marks: 61,
        examType: "quiz",
        session: "2026",
        createdBy: context.creator._id,
    });
    await createAcademicAssignment(
        {
            teacher: context.teacher,
            subject: context.subject,
            classSection: context.classSection,
            session: "2027",
        }
    );

    const response = await postRecord(context, student._id, {
        session: "2027",
    });

    assert.equal(response.status, 201);
    assert.equal(await AcademicRecord.countDocuments(), 2);
    assert.equal(
        await AcademicRecord.countDocuments({
            student: student._id,
            teacher: context.teacher._id,
            classSection: context.classSection._id,
            subject: context.subject._id,
            examType: "quiz",
            session: "2027",
        }),
        1
    );
});

test("manual AcademicRecord transaction rolls back a record and Student fence after an injected post-save failure", async () => {
    const context = await createRecordContext();
    const student = await createStudent({ program: context.program._id });
    const startingVersion = student.__v;
    const originalSave = AcademicRecord.prototype.save;
    let injectedFailure = false;

    AcademicRecord.prototype.save = async function (...args) {
        await originalSave.apply(this, args);
        if (args[0]?.session) {
            injectedFailure = true;
            throw new Error("Injected failure after AcademicRecord save.");
        }
        return this;
    };

    let response;
    try {
        response = await postRecord(context, student._id);
    } finally {
        AcademicRecord.prototype.save = originalSave;
    }

    assert.equal(injectedFailure, true);
    assert.equal(response.status, 500);
    assert.equal(await AcademicRecord.countDocuments(), 0);
    assert.equal((await Student.findById(student._id)).__v, startingVersion);
});
