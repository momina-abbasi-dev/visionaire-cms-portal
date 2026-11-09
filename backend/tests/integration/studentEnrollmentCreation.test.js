import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import mongoose from "mongoose";
import request from "supertest";
import AcademicSession from "../../models/AcademicSession.js";
import ClassSection from "../../models/ClassSection.js";
import Department from "../../models/Department.js";
import Program from "../../models/Program.js";
import Student from "../../models/Student.js";
import StudentEnrollment from "../../models/StudentEnrollment.js";
import User from "../../models/User.js";
import {
    createAcademicSession,
    createAdminUser,
    createAuthenticatedUser,
    createClassSection,
    createProgram,
    createStudent,
    createStudentEnrollment,
} from "../support/fixtures.js";
import {
    clearTestDatabase,
    connectTestDatabase,
    disconnectTestDatabase,
} from "../support/testDatabase.js";
import { createTestApp } from "../support/testApp.js";

const indexedModels = [
    AcademicSession,
    ClassSection,
    Department,
    Program,
    Student,
    StudentEnrollment,
    User,
];

let app;
let admin;

const createEnrollmentContext = async ({
    studentOverrides = {},
    sessionOverrides = {},
} = {}) => {
    const program = await createProgram();
    const classSection = await createClassSection(program);
    const student = await createStudent({
        program: program._id,
        ...studentOverrides,
    });
    const academicSession = await createAcademicSession(admin.user, {
        ...sessionOverrides,
    });

    return { program, classSection, student, academicSession };
};

const postEnrollment = (
    { token = admin.token, student, classSection, academicSession } = {},
    overrides = {}
) =>
    request(app)
        .post("/api/student-enrollments")
        .set("Authorization", `Bearer ${token}`)
        .send({
            student: student?._id?.toString(),
            classSection: classSection?._id?.toString(),
            academicSession: academicSession?._id?.toString(),
            startDate: "2026-06-01",
            ...overrides,
        });

const closeEnrollmentRequest = (
    { token = admin.token, enrollmentId } = {},
    overrides = {}
) =>
    request(app)
        .patch(`/api/student-enrollments/${enrollmentId}/close`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "completed", endDate: "2026-08-15", ...overrides });

const promoteEnrollmentRequest = (
    { token = admin.token, enrollmentId } = {},
    overrides = {}
) =>
    request(app)
        .post(`/api/student-enrollments/${enrollmentId}/promote`)
        .set("Authorization", `Bearer ${token}`)
        .send({
            destinationAcademicSession:
                overrides.destinationAcademicSession,
            destinationClassSection: overrides.destinationClassSection,
            promotionDate: overrides.promotionDate ?? "2027-06-01",
            ...overrides,
        });

const bulkPromoteRequest = (body, { token = admin.token } = {}) =>
    request(app)
        .post("/api/student-enrollments/bulk-promote")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

const createActiveEnrollmentContext = async ({
    startDate = new Date("2026-06-01T00:00:00.000Z"),
} = {}) => {
    const context = await createEnrollmentContext();
    const enrollment = await createStudentEnrollment({
        ...context,
        createdBy: admin.user,
        startDate,
    });
    return { ...context, enrollment };
};

const createPromotionContext = async (options = {}) => {
    const sourceContext = await createActiveEnrollmentContext(options);
    const destinationAcademicSession = await createAcademicSession(admin.user, {
        name: `Destination ${new mongoose.Types.ObjectId()}`,
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T00:00:00.000Z"),
        status: "planned",
    });
    const destinationClassSection = await createClassSection(
        sourceContext.program,
        { name: "Destination Class", section: "B" }
    );
    return {
        ...sourceContext,
        destinationAcademicSession,
        destinationClassSection,
    };
};

const createBulkPromotionContext = async ({
    destinationSessionOverrides = {},
    sourceStartDate,
} = {}) => {
    const members = await Promise.all(
        [0, 1].map(async () => {
            const context = await createActiveEnrollmentContext(
                sourceStartDate
                    ? { startDate: sourceStartDate }
                    : undefined
            );
            return {
                ...context,
                destinationClassSection: await createClassSection(
                    context.program,
                    { name: `Bulk Destination ${new mongoose.Types.ObjectId()}` }
                ),
            };
        })
    );
    const destinationAcademicSession = await createAcademicSession(admin.user, {
        name: `Bulk Destination ${new mongoose.Types.ObjectId()}`,
        startDate: new Date("2027-01-01T00:00:00.000Z"),
        endDate: new Date("2027-12-31T00:00:00.000Z"),
        status: "planned",
        ...destinationSessionOverrides,
    });

    return { members, destinationAcademicSession };
};

const bulkPromotionPayload = (
    context,
    overrides = {}
) => ({
    promotions: context.members.map((member) => ({
        sourceEnrollment: member.enrollment._id.toString(),
        destinationClassSection: member.destinationClassSection._id.toString(),
    })),
    destinationAcademicSession:
        context.destinationAcademicSession._id.toString(),
    promotionDate: "2027-06-01",
    ...overrides,
});

const postPromotion = (
    {
        token = admin.token,
        enrollment,
        destinationAcademicSession,
        destinationClassSection,
    } = {},
    overrides = {}
) =>
    promoteEnrollmentRequest(
        { token, enrollmentId: enrollment?._id?.toString() },
        {
            destinationAcademicSession:
                destinationAcademicSession?._id?.toString(),
            destinationClassSection: destinationClassSection?._id?.toString(),
            ...overrides,
        }
    );

const assertRejectedWithoutWrites = async ({
    response,
    student,
    expectedStatus,
}) => {
    assert.equal(response.status, expectedStatus);
    assert.equal(await StudentEnrollment.countDocuments(), 0);
    if (student) {
        assert.equal(
            (await Student.findById(student._id)).__v,
            student.__v
        );
    }
};

before(async () => {
    await connectTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();
    await Promise.all(indexedModels.map((model) => model.createIndexes()));
    app = createTestApp();
    admin = await createAdminUser();
});

after(async () => {
    await disconnectTestDatabase();
});

test("Admin can create an active enrollment atomically without changing Student.status", async () => {
    const context = await createEnrollmentContext();
    const startingVersion = context.student.__v;

    const response = await postEnrollment(context);

    assert.equal(response.status, 201);
    assert.equal(response.body.enrollment.status, "active");
    assert.equal(
        response.body.enrollment.student._id,
        context.student._id.toString()
    );
    assert.equal(
        response.body.enrollment.classSection._id,
        context.classSection._id.toString()
    );
    assert.equal(
        response.body.enrollment.academicSession._id,
        context.academicSession._id.toString()
    );
    assert.equal(response.body.enrollment.startDate.slice(0, 10), "2026-06-01");
    assert.equal(
        response.body.enrollment.createdBy._id,
        admin.user._id.toString()
    );

    const savedEnrollment = await StudentEnrollment.findById(
        response.body.enrollment._id
    );
    assert.ok(savedEnrollment);
    assert.equal(savedEnrollment.status, "active");
    assert.equal(savedEnrollment.student.toString(), context.student._id.toString());
    assert.equal(savedEnrollment.createdBy.toString(), admin.user._id.toString());
    const savedStudent = await Student.findById(context.student._id);
    assert.equal(savedStudent.status, "active");
    assert.equal(savedStudent.__v, startingVersion + 1);
});

test("inactive Student is rejected without persisting an enrollment or fence increment", async () => {
    const context = await createEnrollmentContext({
        studentOverrides: { status: "suspended" },
    });
    const response = await postEnrollment(context);

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 400,
    });
});

test("missing Student is rejected without creating an enrollment", async () => {
    const context = await createEnrollmentContext();
    const response = await postEnrollment(context, {
        student: new mongoose.Types.ObjectId().toString(),
    });

    await assertRejectedWithoutWrites({
        response,
        expectedStatus: 404,
    });
});

test("Student from an incompatible Program is rejected without retaining its fence", async () => {
    const context = await createEnrollmentContext();
    const otherProgram = await createProgram({
        department: context.program.department,
    });
    const student = await createStudent({ program: otherProgram._id });
    const response = await postEnrollment({ ...context, student });

    await assertRejectedWithoutWrites({
        response,
        student,
        expectedStatus: 400,
    });
});

test("missing AcademicSession is rejected without retaining the Student fence", async () => {
    const context = await createEnrollmentContext();
    const response = await postEnrollment(context, {
        academicSession: new mongoose.Types.ObjectId().toString(),
    });

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 404,
    });
});

test("completed AcademicSession is rejected without retaining the Student fence", async () => {
    const context = await createEnrollmentContext({
        sessionOverrides: { status: "completed" },
    });
    const response = await postEnrollment(context);

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 400,
    });
});

test("enrollment start date before session boundaries is rejected", async () => {
    const context = await createEnrollmentContext();
    const response = await postEnrollment(context, {
        startDate: "2025-12-31",
    });

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 400,
    });
});

test("enrollment start date after session boundaries is rejected", async () => {
    const context = await createEnrollmentContext();
    const response = await postEnrollment(context, {
        startDate: "2027-01-01",
    });

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 400,
    });
});

test("malformed and impossible date-only values are rejected", async () => {
    const context = await createEnrollmentContext();
    for (const startDate of [
        "2026-2-01",
        "2026-02-30",
        "2026-06-01\n",
    ]) {
        const response = await postEnrollment(context, { startDate });
        await assertRejectedWithoutWrites({
            response,
            student: context.student,
            expectedStatus: 400,
        });
    }
});

test("AcademicSession start and end dates are inclusive enrollment boundaries", async () => {
    const context = await createEnrollmentContext();
    const firstBoundaryResponse = await postEnrollment(context, {
        startDate: "2026-01-01",
    });
    const endBoundaryStudent = await createStudent({
        program: context.program._id,
    });
    const lastBoundaryResponse = await postEnrollment(
        { ...context, student: endBoundaryStudent },
        { startDate: "2026-12-31" }
    );

    assert.equal(firstBoundaryResponse.status, 201);
    assert.equal(lastBoundaryResponse.status, 201);
    assert.equal(await StudentEnrollment.countDocuments(), 2);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v + 1
    );
    assert.equal(
        (await Student.findById(endBoundaryStudent._id)).__v,
        endBoundaryStudent.__v + 1
    );
});

test("duplicate active enrollment is rejected without changing the existing history", async () => {
    const context = await createEnrollmentContext();
    const existing = await createStudentEnrollment({
        student: context.student,
        classSection: context.classSection,
        academicSession: context.academicSession,
        createdBy: admin.user,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    const existingSnapshot = existing.toObject();
    const startingVersion = context.student.__v;
    const response = await postEnrollment(context);

    assert.equal(response.status, 409);
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.deepEqual(
        (await StudentEnrollment.findById(existing._id)).toObject(),
        existingSnapshot
    );
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        startingVersion
    );
});

test("Student with a missing Program reference is safely rejected", async () => {
    const context = await createEnrollmentContext();
    const danglingProgramStudent = await createStudent({
        program: new mongoose.Types.ObjectId(),
    });
    const response = await postEnrollment({
        ...context,
        student: danglingProgramStudent,
    });

    await assertRejectedWithoutWrites({
        response,
        student: danglingProgramStudent,
        expectedStatus: 400,
    });
});

test("malformed enrollment identifiers are rejected as client errors", async () => {
    const context = await createEnrollmentContext();
    const response = await postEnrollment(context, {
        classSection: "not-an-object-id",
    });

    await assertRejectedWithoutWrites({
        response,
        student: context.student,
        expectedStatus: 400,
    });
});

test("non-Admin users cannot create Student enrollments", async () => {
    const context = await createEnrollmentContext();
    const nonAdmin = await createAuthenticatedUser("teacher");
    const response = await postEnrollment({
        ...context,
        token: nonAdmin.token,
    });

    assert.equal(response.status, 403);
    assert.equal(await StudentEnrollment.countDocuments(), 0);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("transaction rollback removes a saved enrollment and Student fence increment", async () => {
    const context = await createEnrollmentContext();
    const originalSave = StudentEnrollment.prototype.save;
    StudentEnrollment.prototype.save = async function (options) {
        await originalSave.call(this, options);
        throw new Error("Injected enrollment failure after save.");
    };

    let response;
    try {
        response = await postEnrollment(context);
    } finally {
        StudentEnrollment.prototype.save = originalSave;
    }

    assert.equal(response.status, 500);
    assert.equal(await StudentEnrollment.countDocuments(), 0);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("Admin can complete an active enrollment and persists closure audit fields", async () => {
    const context = await createActiveEnrollmentContext();
    const startingVersion = context.student.__v;
    const response = await closeEnrollmentRequest({
        enrollmentId: context.enrollment._id,
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.enrollment.status, "completed");
    assert.equal(response.body.enrollment.endDate.slice(0, 10), "2026-08-15");
    assert.equal(
        response.body.enrollment.endedBy._id,
        admin.user._id.toString()
    );
    assert.equal(response.body.enrollment.endReason, "completed");
    assert.ok(response.body.enrollment.endedAt);

    const savedEnrollment = await StudentEnrollment.findById(
        context.enrollment._id
    );
    assert.equal(savedEnrollment.status, "completed");
    assert.equal(savedEnrollment.endDate.toISOString(), "2026-08-15T00:00:00.000Z");
    assert.equal(savedEnrollment.endedBy.toString(), admin.user._id.toString());
    assert.equal(savedEnrollment.endReason, "completed");
    const savedStudent = await Student.findById(context.student._id);
    assert.equal(savedStudent.status, "active");
    assert.equal(savedStudent.__v, startingVersion + 1);
});

test("Admin can withdraw an active enrollment and persists the date and endedBy", async () => {
    const context = await createActiveEnrollmentContext();
    const response = await closeEnrollmentRequest(
        { enrollmentId: context.enrollment._id },
        { status: "withdrawn", endDate: "2026-12-31" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.enrollment.status, "withdrawn");
    assert.equal(response.body.enrollment.endDate.slice(0, 10), "2026-12-31");
    assert.equal(
        response.body.enrollment.endedBy._id,
        admin.user._id.toString()
    );
    const savedEnrollment = await StudentEnrollment.findById(
        context.enrollment._id
    );
    assert.equal(savedEnrollment.status, "withdrawn");
    assert.equal(savedEnrollment.endDate.toISOString(), "2026-12-31T00:00:00.000Z");
    assert.equal(savedEnrollment.endedBy.toString(), admin.user._id.toString());
    assert.equal(
        (await Student.findById(context.student._id)).status,
        "active"
    );
});

test("non-Admin users cannot close enrollments or increment the Student fence", async () => {
    const context = await createActiveEnrollmentContext();
    const nonAdmin = await createAuthenticatedUser("teacher");
    const response = await closeEnrollmentRequest(
        {
            token: nonAdmin.token,
            enrollmentId: context.enrollment._id,
        },
        { status: "withdrawn" }
    );

    assert.equal(response.status, 403);
    const savedEnrollment = await StudentEnrollment.findById(
        context.enrollment._id
    );
    assert.equal(savedEnrollment.status, "active");
    assert.equal(savedEnrollment.endDate, null);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("malformed and missing enrollment IDs are rejected", async () => {
    const malformedResponse = await closeEnrollmentRequest({
        enrollmentId: "not-an-object-id",
    });
    assert.equal(malformedResponse.status, 400);

    const missingResponse = await closeEnrollmentRequest({
        enrollmentId: new mongoose.Types.ObjectId().toString(),
    });
    assert.equal(missingResponse.status, 404);
    assert.equal(await StudentEnrollment.countDocuments(), 0);
});

test("missing and invalid enrollment end dates are rejected without writes", async () => {
    const context = await createActiveEnrollmentContext();
    for (const body of [
        { status: "completed", endDate: undefined },
        { status: "completed", endDate: "2026-2-01" },
        { status: "completed", endDate: "2026-02-30" },
    ]) {
        const response = await closeEnrollmentRequest(
            { enrollmentId: context.enrollment._id },
            body
        );
        assert.equal(response.status, 400);
        assert.equal((await StudentEnrollment.findById(context.enrollment._id)).status, "active");
        assert.equal(
            (await Student.findById(context.student._id)).__v,
            context.student.__v
        );
    }
});

test("end date cannot precede the enrollment start date", async () => {
    const context = await createActiveEnrollmentContext({
        startDate: new Date("2026-07-01T00:00:00.000Z"),
    });
    const response = await closeEnrollmentRequest(
        { enrollmentId: context.enrollment._id },
        { endDate: "2026-06-30" }
    );

    assert.equal(response.status, 400);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("end date must remain within AcademicSession boundaries", async () => {
    const context = await createActiveEnrollmentContext({
        startDate: new Date("2025-12-01T00:00:00.000Z"),
    });
    for (const endDate of ["2025-12-31", "2027-01-01"]) {
        const response = await closeEnrollmentRequest(
            { enrollmentId: context.enrollment._id },
            { endDate }
        );
        assert.equal(response.status, 400);
        assert.equal(
            (await StudentEnrollment.findById(context.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(context.student._id)).__v,
            context.student.__v
        );
    }
});

test("end date equal to enrollment start date is accepted", async () => {
    const context = await createActiveEnrollmentContext();
    const response = await closeEnrollmentRequest(
        { enrollmentId: context.enrollment._id },
        { endDate: "2026-06-01" }
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.enrollment.endDate.slice(0, 10), "2026-06-01");
    const savedEnrollment = await StudentEnrollment.findById(
        context.enrollment._id
    );
    assert.equal(savedEnrollment.status, "completed");
    assert.equal(savedEnrollment.endDate.toISOString(), "2026-06-01T00:00:00.000Z");
});

test("completed or withdrawn enrollments cannot be closed again", async () => {
    for (const status of ["completed", "withdrawn"]) {
        const context = await createActiveEnrollmentContext();
        const existing = await StudentEnrollment.findById(
            context.enrollment._id
        );
        existing.status = status;
        existing.endDate = new Date("2026-08-01T00:00:00.000Z");
        existing.endedAt = new Date("2026-08-01T12:00:00.000Z");
        existing.endReason = status;
        existing.endedBy = admin.user._id;
        await existing.save();
        const response = await closeEnrollmentRequest({
            enrollmentId: context.enrollment._id,
        });

        assert.equal(response.status, 409);
        assert.equal(
            (await StudentEnrollment.findById(context.enrollment._id)).status,
            status
        );
        assert.equal(
            (await Student.findById(context.student._id)).__v,
            context.student.__v
        );
    }
});

test("invalid closure statuses are rejected", async () => {
    const context = await createActiveEnrollmentContext();
    const response = await closeEnrollmentRequest(
        { enrollmentId: context.enrollment._id },
        { status: "transferred" }
    );

    assert.equal(response.status, 400);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("transaction rollback preserves an active enrollment and Student version", async () => {
    const context = await createActiveEnrollmentContext();
    const originalSave = StudentEnrollment.prototype.save;
    StudentEnrollment.prototype.save = async function (options) {
        if (this.status === "active") {
            return originalSave.call(this, options);
        }
        await originalSave.call(this, options);
        throw new Error("Injected enrollment closure failure after save.");
    };

    let response;
    try {
        response = await closeEnrollmentRequest({
            enrollmentId: context.enrollment._id,
        });
    } finally {
        StudentEnrollment.prototype.save = originalSave;
    }

    assert.equal(response.status, 500);
    const savedEnrollment = await StudentEnrollment.findById(
        context.enrollment._id
    );
    assert.equal(savedEnrollment.status, "active");
    assert.equal(savedEnrollment.endDate, null);
    assert.equal(savedEnrollment.endedAt, null);
    assert.equal(savedEnrollment.endedBy, null);
    assert.equal(savedEnrollment.endReason, null);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("Admin promotion completes the source and creates linked destination enrollment atomically", async () => {
    const context = await createPromotionContext();
    const startingVersion = context.student.__v;
    const response = await postPromotion(context);

    assert.equal(response.status, 201);
    assert.equal(response.body.sourceEnrollment.status, "completed");
    assert.equal(response.body.sourceEnrollment.endDate.slice(0, 10), "2027-06-01");
    assert.equal(
        response.body.sourceEnrollment.endedBy._id,
        admin.user._id.toString()
    );
    assert.equal(response.body.sourceEnrollment.endReason, "promoted");
    assert.equal(response.body.enrollment.status, "active");
    assert.equal(response.body.enrollment.startDate.slice(0, 10), "2027-06-01");
    assert.equal(
        response.body.enrollment.student._id,
        context.student._id.toString()
    );
    assert.equal(
        response.body.enrollment.classSection._id,
        context.destinationClassSection._id.toString()
    );
    assert.equal(
        response.body.enrollment.academicSession._id,
        context.destinationAcademicSession._id.toString()
    );
    assert.equal(
        response.body.enrollment.createdBy._id,
        admin.user._id.toString()
    );
    assert.equal(
        response.body.enrollment.previousEnrollment._id,
        context.enrollment._id.toString()
    );

    const [savedSource, savedDestination, savedStudent] = await Promise.all([
        StudentEnrollment.findById(context.enrollment._id),
        StudentEnrollment.findById(response.body.enrollment._id),
        Student.findById(context.student._id),
    ]);
    assert.equal(savedSource.status, "completed");
    assert.equal(savedSource.endDate.toISOString(), "2027-06-01T00:00:00.000Z");
    assert.equal(savedSource.endedBy.toString(), admin.user._id.toString());
    assert.equal(savedSource.endReason, "promoted");
    assert.equal(savedDestination.status, "active");
    assert.equal(savedDestination.startDate.toISOString(), "2027-06-01T00:00:00.000Z");
    assert.equal(
        savedDestination.previousEnrollment.toString(),
        context.enrollment._id.toString()
    );
    assert.equal(savedDestination.createdBy.toString(), admin.user._id.toString());
    assert.equal(savedStudent.status, "active");
    assert.equal(savedStudent.__v, startingVersion + 1);
    assert.equal(await StudentEnrollment.countDocuments(), 2);
});

test("non-Admin users cannot promote an enrollment or change persisted state", async () => {
    const context = await createPromotionContext();
    const nonAdmin = await createAuthenticatedUser("teacher");
    const response = await postPromotion(
        { ...context, token: nonAdmin.token }
    );

    assert.equal(response.status, 403);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("promotion rejects malformed or missing source and destination IDs", async () => {
    const context = await createPromotionContext();
    const malformedSource = await promoteEnrollmentRequest(
        { enrollmentId: "bad-id" },
        {
            destinationAcademicSession:
                context.destinationAcademicSession._id.toString(),
            destinationClassSection:
                context.destinationClassSection._id.toString(),
            promotionDate: "2027-06-01",
        }
    );
    assert.equal(malformedSource.status, 400);

    const missingSource = await promoteEnrollmentRequest(
        { enrollmentId: new mongoose.Types.ObjectId().toString() },
        {
            destinationAcademicSession:
                context.destinationAcademicSession._id.toString(),
            destinationClassSection:
                context.destinationClassSection._id.toString(),
            promotionDate: "2027-06-01",
        }
    );
    assert.equal(missingSource.status, 404);

    for (const overrides of [
        { destinationAcademicSession: undefined },
        { destinationClassSection: undefined },
        { destinationAcademicSession: "bad-id" },
        { destinationClassSection: "bad-id" },
    ]) {
        const response = await postPromotion(context, overrides);
        assert.equal(response.status, 400);
        assert.equal(await StudentEnrollment.countDocuments(), 1);
        assert.equal(
            (await Student.findById(context.student._id)).__v,
            context.student.__v
        );
    }
});

test("promotion rejects a non-active source enrollment", async () => {
    const context = await createPromotionContext();
    const source = await StudentEnrollment.findById(context.enrollment._id);
    source.status = "completed";
    source.endDate = new Date("2026-08-01T00:00:00.000Z");
    source.endedAt = new Date("2026-08-01T12:00:00.000Z");
    source.endReason = "completed";
    source.endedBy = admin.user._id;
    await source.save();

    const beforeVersion = (await Student.findById(context.student._id)).__v;
    const response = await postPromotion(context);
    assert.equal(response.status, 409);
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        beforeVersion
    );
});

test("promotion rejects missing or inactive Students", async () => {
    const missingContext = await createPromotionContext();
    await Student.deleteOne({ _id: missingContext.student._id });
    const missingResponse = await postPromotion(missingContext);
    assert.equal(missingResponse.status, 404);
    assert.equal(
        (await StudentEnrollment.findById(missingContext.enrollment._id)).status,
        "active"
    );
    assert.equal(await StudentEnrollment.countDocuments(), 1);

    const inactiveContext = await createPromotionContext();
    await Student.updateOne(
        { _id: inactiveContext.student._id },
        { $set: { status: "suspended" } }
    );
    const inactiveStudent = await Student.findById(inactiveContext.student._id);
    const inactiveResponse = await postPromotion(inactiveContext);
    assert.equal(inactiveResponse.status, 400);
    assert.equal(
        (await StudentEnrollment.findById(inactiveContext.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(inactiveContext.student._id)).__v,
        inactiveStudent.__v
    );
    assert.equal(await StudentEnrollment.countDocuments(), 2);
});

test("promotion rejects missing or completed destination AcademicSessions", async () => {
    const context = await createPromotionContext();
    const missingSessionResponse = await postPromotion(context, {
        destinationAcademicSession: new mongoose.Types.ObjectId().toString(),
    });
    assert.equal(missingSessionResponse.status, 404);

    const completedContext = await createPromotionContext();
    const destinationSession = await AcademicSession.findById(
        completedContext.destinationAcademicSession._id
    );
    destinationSession.status = "completed";
    await destinationSession.save();
    const completedResponse = await postPromotion(completedContext);
    assert.equal(completedResponse.status, 400);
    assert.equal(
        (await StudentEnrollment.findById(completedContext.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(completedContext.student._id)).__v,
        completedContext.student.__v
    );
});

test("promotion rejects using the source AcademicSession as the destination", async () => {
    const context = await createPromotionContext();
    const response = await postPromotion(context, {
        destinationAcademicSession: context.academicSession._id.toString(),
    });

    assert.equal(response.status, 400);
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("promotion rejects a ClassSection from another Program", async () => {
    const context = await createPromotionContext();
    const otherProgram = await createProgram({
        department: context.program.department,
    });
    const incompatibleClassSection = await createClassSection(otherProgram);
    const response = await postPromotion(context, {
        destinationClassSection: incompatibleClassSection._id.toString(),
    });

    assert.equal(response.status, 400);
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("promotion rejects missing, malformed, impossible, and out-of-session dates", async () => {
    const context = await createPromotionContext();
    const cases = [
        { promotionDate: undefined, expectedStatus: 400 },
        { promotionDate: "2027-2-01", expectedStatus: 400 },
        { promotionDate: "2027-02-30", expectedStatus: 400 },
        { promotionDate: "2026-12-31", expectedStatus: 400 },
        { promotionDate: "2028-01-01", expectedStatus: 400 },
    ];
    for (const { promotionDate, expectedStatus } of cases) {
        const response = await postPromotion(context, { promotionDate });
        assert.equal(response.status, expectedStatus);
        assert.equal(await StudentEnrollment.countDocuments(), 1);
        assert.equal(
            (await StudentEnrollment.findById(context.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(context.student._id)).__v,
            context.student.__v
        );
    }
});

test("promotion date cannot precede the source enrollment start date", async () => {
    const context = await createPromotionContext({
        startDate: new Date("2027-07-01T00:00:00.000Z"),
    });
    const response = await postPromotion(context, {
        promotionDate: "2027-06-30",
    });

    assert.equal(response.status, 400);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("promotion rejects an existing active enrollment in the destination session", async () => {
    const context = await createPromotionContext();
    await createStudentEnrollment({
        student: context.student,
        classSection: context.destinationClassSection,
        academicSession: context.destinationAcademicSession,
        createdBy: admin.user,
        startDate: new Date("2027-02-01T00:00:00.000Z"),
    });
    const beforeVersion = (await Student.findById(context.student._id)).__v;
    const response = await postPromotion(context);

    assert.equal(response.status, 409);
    assert.equal(await StudentEnrollment.countDocuments(), 2);
    assert.equal(
        (await StudentEnrollment.findById(context.enrollment._id)).status,
        "active"
    );
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        beforeVersion
    );
});

test("promotion rollback restores source enrollment and Student version if destination save fails", async () => {
    const context = await createPromotionContext();
    const originalSave = StudentEnrollment.prototype.save;
    StudentEnrollment.prototype.save = async function (options) {
        if (this.previousEnrollment != null) {
            await originalSave.call(this, options);
            throw new Error("Injected destination enrollment failure.");
        }
        return originalSave.call(this, options);
    };

    let response;
    try {
        response = await postPromotion(context);
    } finally {
        StudentEnrollment.prototype.save = originalSave;
    }

    assert.equal(response.status, 500);
    assert.equal(await StudentEnrollment.countDocuments(), 1);
    const savedSource = await StudentEnrollment.findById(context.enrollment._id);
    assert.equal(savedSource.status, "active");
    assert.equal(savedSource.endDate, null);
    assert.equal(savedSource.endedAt, null);
    assert.equal(savedSource.endedBy, null);
    assert.equal(savedSource.endReason, null);
    assert.equal(
        (await Student.findById(context.student._id)).__v,
        context.student.__v
    );
});

test("Admin bulk promotion atomically closes and links multiple Students in compatible ClassSections", async () => {
    const context = await createBulkPromotionContext();
    const startingStudents = await Promise.all(
        context.members.map((member) => Student.findById(member.student._id))
    );
    const response = await bulkPromoteRequest(bulkPromotionPayload(context));

    assert.equal(response.status, 201);
    assert.equal(response.body.promotions.length, 2);
    for (let index = 0; index < context.members.length; index += 1) {
        const member = context.members[index];
        const promotion = response.body.promotions.find(
            (result) =>
                result.sourceEnrollment._id === member.enrollment._id.toString()
        );
        assert.ok(promotion);
        assert.equal(promotion.sourceEnrollment.status, "completed");
        assert.equal(
            promotion.sourceEnrollment.endDate.slice(0, 10),
            "2027-06-01"
        );
        assert.equal(promotion.sourceEnrollment.endReason, "promoted");
        assert.equal(
            promotion.sourceEnrollment.endedBy._id,
            admin.user._id.toString()
        );
        assert.ok(promotion.sourceEnrollment.endedAt);
        assert.equal(promotion.enrollment.status, "active");
        assert.equal(promotion.enrollment.startDate.slice(0, 10), "2027-06-01");
        assert.equal(
            promotion.enrollment.student._id,
            member.student._id.toString()
        );
        assert.equal(
            promotion.enrollment.classSection._id,
            member.destinationClassSection._id.toString()
        );
        assert.equal(
            promotion.enrollment.academicSession._id,
            context.destinationAcademicSession._id.toString()
        );
        assert.equal(
            promotion.enrollment.createdBy._id,
            admin.user._id.toString()
        );
        assert.equal(
            promotion.enrollment.previousEnrollment._id,
            member.enrollment._id.toString()
        );

        const [savedSource, savedDestination, savedStudent] =
            await Promise.all([
                StudentEnrollment.findById(member.enrollment._id),
                StudentEnrollment.findById(promotion.enrollment._id),
                Student.findById(member.student._id),
            ]);
        assert.equal(savedSource.status, "completed");
        assert.equal(
            savedSource.endDate.toISOString(),
            "2027-06-01T00:00:00.000Z"
        );
        assert.equal(savedSource.endedBy.toString(), admin.user._id.toString());
        assert.equal(savedSource.endReason, "promoted");
        assert.equal(savedDestination.status, "active");
        assert.equal(
            savedDestination.startDate.toISOString(),
            "2027-06-01T00:00:00.000Z"
        );
        assert.equal(
            savedDestination.previousEnrollment.toString(),
            member.enrollment._id.toString()
        );
        assert.equal(
            savedDestination.createdBy.toString(),
            admin.user._id.toString()
        );
        assert.equal(savedStudent.status, startingStudents[index].status);
        assert.equal(
            savedStudent.program.toString(),
            startingStudents[index].program.toString()
        );
        assert.equal(savedStudent.__v, startingStudents[index].__v + 1);
    }
    assert.equal(await StudentEnrollment.countDocuments(), 4);
});

test("non-Admin users cannot bulk promote enrollments or change persisted state", async () => {
    const context = await createBulkPromotionContext();
    const nonAdmin = await createAuthenticatedUser("teacher");
    const response = await bulkPromoteRequest(
        bulkPromotionPayload(context),
        { token: nonAdmin.token }
    );

    assert.equal(response.status, 403);
    assert.equal(await StudentEnrollment.countDocuments(), 2);
    for (const member of context.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            member.student.__v
        );
    }
});

test("bulk promotion rejects empty, oversized, malformed, duplicate, and unmapped batches", async () => {
    const context = await createBulkPromotionContext();
    const payload = bulkPromotionPayload(context);
    const requests = [
        { ...payload, promotions: [] },
        {
            ...payload,
            promotions: Array.from({ length: 101 }, () => ({
                sourceEnrollment: context.members[0].enrollment._id.toString(),
                destinationClassSection:
                    context.members[0].destinationClassSection._id.toString(),
            })),
        },
        {
            ...payload,
            promotions: [
                {
                    sourceEnrollment: "bad-id",
                    destinationClassSection:
                        context.members[0].destinationClassSection._id.toString(),
                },
            ],
        },
        {
            ...payload,
            promotions: [
                payload.promotions[0],
                payload.promotions[0],
            ],
        },
        {
            ...payload,
            promotions: [
                {
                    sourceEnrollment: context.members[0].enrollment._id.toString(),
                },
            ],
        },
        { ...payload, destinationAcademicSession: "bad-id" },
    ];

    for (const body of requests) {
        const response = await bulkPromoteRequest(body);
        assert.equal(response.status, 400);
        assert.equal(await StudentEnrollment.countDocuments(), 2);
        for (const member of context.members) {
            assert.equal(
                (await Student.findById(member.student._id)).__v,
                member.student.__v
            );
        }
    }
});

test("bulk promotion rejects missing or inactive sources and missing or inactive Students", async () => {
    const missingSourceContext = await createBulkPromotionContext();
    const missingSourcePayload = bulkPromotionPayload(missingSourceContext);
    missingSourcePayload.promotions[0].sourceEnrollment =
        new mongoose.Types.ObjectId().toString();
    const missingSourceResponse = await bulkPromoteRequest(
        missingSourcePayload
    );
    assert.equal(missingSourceResponse.status, 404);
    for (const member of missingSourceContext.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            member.student.__v
        );
    }

    const inactiveSourceContext = await createBulkPromotionContext();
    const inactiveSource = await StudentEnrollment.findById(
        inactiveSourceContext.members[1].enrollment._id
    );
    inactiveSource.status = "completed";
    inactiveSource.endDate = new Date("2026-08-01T00:00:00.000Z");
    inactiveSource.endedAt = new Date("2026-08-01T12:00:00.000Z");
    inactiveSource.endReason = "completed";
    inactiveSource.endedBy = admin.user._id;
    await inactiveSource.save();
    const beforeInactiveSourceVersions = await Promise.all(
        inactiveSourceContext.members.map((member) =>
            Student.findById(member.student._id)
        )
    );
    const inactiveSourceResponse = await bulkPromoteRequest(
        bulkPromotionPayload(inactiveSourceContext)
    );
    assert.equal(inactiveSourceResponse.status, 409);
    for (let index = 0; index < inactiveSourceContext.members.length; index += 1) {
        const member = inactiveSourceContext.members[index];
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            index === 1 ? "completed" : "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            beforeInactiveSourceVersions[index].__v
        );
    }

    const missingStudentContext = await createBulkPromotionContext();
    const remainingStudent = await Student.findById(
        missingStudentContext.members[1].student._id
    );
    await Student.deleteOne({ _id: missingStudentContext.members[0].student._id });
    const missingStudentResponse = await bulkPromoteRequest(
        bulkPromotionPayload(missingStudentContext)
    );
    assert.equal(missingStudentResponse.status, 404);
    assert.equal(
        (await StudentEnrollment.findById(
            missingStudentContext.members[1].enrollment._id
        )).status,
        "active"
    );
    assert.equal(
        (await Student.findById(remainingStudent._id)).__v,
        remainingStudent.__v
    );

    const inactiveStudentContext = await createBulkPromotionContext();
    await Student.updateOne(
        { _id: inactiveStudentContext.members[1].student._id },
        { $set: { status: "suspended" } }
    );
    const inactiveStudents = await Promise.all(
        inactiveStudentContext.members.map((member) =>
            Student.findById(member.student._id)
        )
    );
    const inactiveStudentResponse = await bulkPromoteRequest(
        bulkPromotionPayload(inactiveStudentContext)
    );
    assert.equal(inactiveStudentResponse.status, 400);
    for (const member of inactiveStudentContext.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
    }
    for (let index = 0; index < inactiveStudentContext.members.length; index += 1) {
        assert.equal(
            (await Student.findById(
                inactiveStudentContext.members[index].student._id
            )).__v,
            inactiveStudents[index].__v
        );
    }
});

test("bulk promotion validates destination session existence, status, and source-session inequality", async () => {
    const context = await createBulkPromotionContext();
    const missingSessionResponse = await bulkPromoteRequest(
        bulkPromotionPayload(context, {
            destinationAcademicSession:
                new mongoose.Types.ObjectId().toString(),
        })
    );
    assert.equal(missingSessionResponse.status, 404);

    const completedSessionContext = await createBulkPromotionContext();
    const completedSession = await AcademicSession.findById(
        completedSessionContext.destinationAcademicSession._id
    );
    completedSession.status = "completed";
    await completedSession.save();
    const completedSessionResponse = await bulkPromoteRequest(
        bulkPromotionPayload(completedSessionContext)
    );
    assert.equal(completedSessionResponse.status, 400);

    const sameSessionContext = await createBulkPromotionContext();
    const sameSessionResponse = await bulkPromoteRequest(
        bulkPromotionPayload(sameSessionContext, {
            destinationAcademicSession:
                sameSessionContext.members[0].academicSession._id.toString(),
            promotionDate: "2026-06-01",
        })
    );
    assert.equal(sameSessionResponse.status, 400);

    for (const member of sameSessionContext.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            member.student.__v
        );
    }
});

test("bulk promotion rejects missing, malformed, and Program-incompatible destination ClassSections", async () => {
    const context = await createBulkPromotionContext();
    const missingClassResponse = await bulkPromoteRequest(
        bulkPromotionPayload(context, {
            promotions: [
                {
                    ...bulkPromotionPayload(context).promotions[0],
                    destinationClassSection:
                        new mongoose.Types.ObjectId().toString(),
                },
                bulkPromotionPayload(context).promotions[1],
            ],
        })
    );
    assert.equal(missingClassResponse.status, 404);

    const malformedClassResponse = await bulkPromoteRequest(
        bulkPromotionPayload(context, {
            promotions: [
                {
                    ...bulkPromotionPayload(context).promotions[0],
                    destinationClassSection: "bad-id",
                },
                bulkPromotionPayload(context).promotions[1],
            ],
        })
    );
    assert.equal(malformedClassResponse.status, 400);

    const incompatibleProgram = await createProgram();
    const incompatibleClass = await createClassSection(incompatibleProgram);
    const incompatibleResponse = await bulkPromoteRequest(
        bulkPromotionPayload(context, {
            promotions: [
                {
                    ...bulkPromotionPayload(context).promotions[0],
                    destinationClassSection: incompatibleClass._id.toString(),
                },
                bulkPromotionPayload(context).promotions[1],
            ],
        })
    );
    assert.equal(incompatibleResponse.status, 400);
    for (const member of context.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            member.student.__v
        );
    }
});

test("bulk promotion rejects invalid, out-of-session, and pre-start promotion dates", async () => {
    const context = await createBulkPromotionContext();
    for (const promotionDate of ["2027-2-01", "2027-02-30", "2028-01-01"]) {
        const response = await bulkPromoteRequest(
            bulkPromotionPayload(context, { promotionDate })
        );
        assert.equal(response.status, 400);
    }

    const preStartContext = await createBulkPromotionContext({
        sourceStartDate: new Date("2026-12-01T00:00:00.000Z"),
        destinationSessionOverrides: {
            startDate: new Date("2026-01-01T00:00:00.000Z"),
        },
    });
    const preStartResponse = await bulkPromoteRequest(
        bulkPromotionPayload(preStartContext, {
            promotionDate: "2026-11-30",
        })
    );
    assert.equal(preStartResponse.status, 400);
    for (const member of preStartContext.members) {
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            member.student.__v
        );
    }
});

test("bulk promotion rejects an existing active destination enrollment", async () => {
    const context = await createBulkPromotionContext();
    await createStudentEnrollment({
        student: context.members[0].student,
        classSection: context.members[0].destinationClassSection,
        academicSession: context.destinationAcademicSession,
        createdBy: admin.user,
        startDate: new Date("2027-02-01T00:00:00.000Z"),
    });
    const beforeVersions = await Promise.all(
        context.members.map((member) => Student.findById(member.student._id))
    );
    const response = await bulkPromoteRequest(bulkPromotionPayload(context));

    assert.equal(response.status, 409);
    assert.equal(await StudentEnrollment.countDocuments(), 3);
    for (let index = 0; index < context.members.length; index += 1) {
        const member = context.members[index];
        assert.equal(
            (await StudentEnrollment.findById(member.enrollment._id)).status,
            "active"
        );
        assert.equal(
            (await Student.findById(member.student._id)).__v,
            beforeVersions[index].__v
        );
    }
});

test("bulk promotion rolls back every source and destination write and Student fence after a later destination save fails", async () => {
    const context = await createBulkPromotionContext();
    const startingStudents = await Promise.all(
        context.members.map((member) => Student.findById(member.student._id))
    );
    const originalSave = StudentEnrollment.prototype.save;
    let destinationSaveCount = 0;
    StudentEnrollment.prototype.save = async function (options) {
        const saved = await originalSave.call(this, options);
        if (this.previousEnrollment != null) {
            destinationSaveCount += 1;
            if (destinationSaveCount === 2) {
                throw new Error("Injected later destination save failure.");
            }
        }
        return saved;
    };

    let response;
    try {
        response = await bulkPromoteRequest(bulkPromotionPayload(context));
    } finally {
        StudentEnrollment.prototype.save = originalSave;
    }

    assert.equal(response.status, 500);
    assert.equal(destinationSaveCount, 2);
    assert.equal(await StudentEnrollment.countDocuments(), 2);
    assert.equal(
        await StudentEnrollment.countDocuments({
            academicSession: context.destinationAcademicSession._id,
            status: "active",
        }),
        0
    );
    for (let index = 0; index < context.members.length; index += 1) {
        const member = context.members[index];
        const [source, student] = await Promise.all([
            StudentEnrollment.findById(member.enrollment._id),
            Student.findById(member.student._id),
        ]);
        assert.equal(source.status, "active");
        assert.equal(source.endDate, null);
        assert.equal(source.endedAt, null);
        assert.equal(source.endReason, null);
        assert.equal(source.endedBy, null);
        assert.equal(student.__v, startingStudents[index].__v);
    }
});
