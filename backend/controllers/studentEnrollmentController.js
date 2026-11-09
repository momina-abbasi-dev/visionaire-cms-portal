import mongoose from "mongoose";
import AcademicSession from "../models/AcademicSession.js";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import Student from "../models/Student.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import {
    acquireStudentWriteFence,
    isTransactionWriteConflict,
} from "../utils/studentWriteFence.js";

const ENROLLMENT_STATUSES = [
    "active",
    "completed",
    "withdrawn",
    "transferred",
];
const ALLOWED_QUERY_FIELDS = new Set([
    "student",
    "classSection",
    "academicSession",
    "status",
    "page",
    "limit",
]);
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_OFFSET = 100_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidObjectId = (value) =>
    typeof value === "string" && mongoose.isValidObjectId(value);

const parseDateOnly = (value) => {
    if (
        typeof value !== "string" ||
        value.length !== 10 ||
        !DATE_ONLY_PATTERN.test(value)
    ) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);
    if (year < 1) return null;

    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    return date;
};

const parsePagination = (query) => {
    const page =
        query.page === undefined
            ? 1
            : typeof query.page === "string" && /^\d+$/.test(query.page)
              ? Number(query.page)
              : NaN;
    const limit =
        query.limit === undefined
            ? DEFAULT_PAGE_SIZE
            : typeof query.limit === "string" && /^\d+$/.test(query.limit)
              ? Number(query.limit)
              : NaN;
    const offset = (page - 1) * limit;

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > MAX_PAGE_SIZE ||
        !Number.isSafeInteger(offset) ||
        offset > MAX_PAGE_OFFSET
    ) {
        return null;
    }

    return { page, limit, offset };
};

const populateEnrollment = (query) =>
    query
        .populate({
            path: "student",
            select: "name rollNo status program",
            populate: { path: "program", select: "name" },
        })
        .populate({
            path: "classSection",
            select: "name section semester program department",
            populate: [
                { path: "program", select: "name" },
                { path: "department", select: "name code" },
            ],
        })
        .populate("academicSession", "name startDate endDate status")
        .populate("createdBy", "name")
        .populate("endedBy", "name")
        .populate("previousEnrollment", "status startDate endDate");

const sendControllerError = (res, error) => {
    if (error.statusCode || isTransactionWriteConflict(error)) {
        return res.status(error.statusCode || 409).json({
            message: error.message,
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({
            message:
                "An active enrollment already exists for this student and academic session.",
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({ message: error.message });
    }

    console.error("Student enrollment controller error:", error);
    return res.status(500).json({
        message: "Failed to process student enrollments.",
    });
};

export const createStudentEnrollment = async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            message: "A valid enrollment request body is required.",
        });
    }

    const allowedFields = new Set([
        "student",
        "classSection",
        "academicSession",
        "startDate",
    ]);
    const unknownField = Object.keys(req.body).find(
        (field) => !allowedFields.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported enrollment field: ${unknownField}.`,
        });
    }

    const { student: studentId, classSection: classSectionId, academicSession: academicSessionId } =
        req.body;
    if (
        !isValidObjectId(studentId) ||
        !isValidObjectId(classSectionId) ||
        !isValidObjectId(academicSessionId)
    ) {
        return res.status(400).json({
            message: "Valid student, classSection, and academicSession IDs are required.",
        });
    }

    const startDate = parseDateOnly(req.body.startDate);
    if (!startDate) {
        return res.status(400).json({
            message: "Enrollment startDate must be a valid YYYY-MM-DD date.",
        });
    }

    let transactionSession;
    let enrollmentId;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            const student = await acquireStudentWriteFence(
                studentId,
                transactionSession
            );
            if (!student) {
                throw Object.assign(new Error("Student not found."), {
                    statusCode: 404,
                });
            }
            if (student.status !== "active") {
                throw Object.assign(
                    new Error("Only active students can be enrolled."),
                    { statusCode: 400 }
                );
            }
            if (!student.program) {
                throw Object.assign(
                    new Error("Student does not reference a valid Program."),
                    { statusCode: 400 }
                );
            }

            const classSection = await ClassSection.findById(classSectionId)
                .session(transactionSession);
            if (!classSection) {
                throw Object.assign(new Error("Class section not found."), {
                    statusCode: 404,
                });
            }
            if (!classSection.program) {
                throw Object.assign(
                    new Error("Class section does not reference a valid Program."),
                    { statusCode: 400 }
                );
            }
            if (
                student.program.toString() !== classSection.program.toString()
            ) {
                throw Object.assign(
                    new Error(
                        "Student Program does not match the selected class section."
                    ),
                    { statusCode: 400 }
                );
            }

            const program = await Program.findById(classSection.program)
                .session(transactionSession);
            if (!program) {
                throw Object.assign(
                    new Error("Class section does not reference an existing Program."),
                    { statusCode: 400 }
                );
            }
            if (
                !classSection.department ||
                !program.department ||
                program.department.toString() !==
                    classSection.department.toString()
            ) {
                throw Object.assign(
                    new Error(
                        "The class section department does not match its Program."
                    ),
                    { statusCode: 400 }
                );
            }

            const departmentExists = await Department.exists({
                _id: classSection.department,
            }).session(transactionSession);
            if (!departmentExists) {
                throw Object.assign(
                    new Error(
                        "The class section or Program references a missing department."
                    ),
                    { statusCode: 400 }
                );
            }

            const academicSession = await AcademicSession.findById(
                academicSessionId
            ).session(transactionSession);
            if (!academicSession) {
                throw Object.assign(
                    new Error("Academic session not found."),
                    { statusCode: 404 }
                );
            }
            if (!["planned", "active"].includes(academicSession.status)) {
                throw Object.assign(
                    new Error(
                        "Only planned or active academic sessions accept enrollments."
                    ),
                    { statusCode: 400 }
                );
            }
            if (
                startDate < academicSession.startDate ||
                startDate > academicSession.endDate
            ) {
                throw Object.assign(
                    new Error(
                        "Enrollment start date must be within the academic session dates."
                    ),
                    { statusCode: 400 }
                );
            }

            const existingEnrollment = await StudentEnrollment.findOne({
                student: student._id,
                academicSession: academicSession._id,
                status: "active",
            }).session(transactionSession);
            if (existingEnrollment) {
                throw Object.assign(
                    new Error(
                        "An active enrollment already exists for this student and academic session."
                    ),
                    { statusCode: 409 }
                );
            }

            const enrollment = new StudentEnrollment({
                student: student._id,
                classSection: classSection._id,
                academicSession: academicSession._id,
                status: "active",
                startDate,
                createdBy: req.user.id,
            });
            await enrollment.save({ session: transactionSession });
            enrollmentId = enrollment._id;
        });

        const enrollment = await populateEnrollment(
            StudentEnrollment.findById(enrollmentId)
        );
        return res.status(201).json({
            message: "Student enrolled successfully.",
            enrollment,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

export const closeStudentEnrollment = async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            message: "A valid enrollment closure request is required.",
        });
    }

    const allowedFields = new Set(["status", "endDate"]);
    const unknownField = Object.keys(req.body).find(
        (field) => !allowedFields.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported enrollment closure field: ${unknownField}.`,
        });
    }

    const { status, endDate: rawEndDate } = req.body;
    if (!["completed", "withdrawn"].includes(status)) {
        return res.status(400).json({
            message: "Enrollment status must be completed or withdrawn.",
        });
    }

    const endDate = parseDateOnly(rawEndDate);
    if (!endDate) {
        return res.status(400).json({
            message: "Enrollment endDate must be a valid YYYY-MM-DD date.",
        });
    }

    let transactionSession;
    let populatedEnrollment;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            const enrollmentSnapshot = await StudentEnrollment.findById(id)
                .session(transactionSession);
            if (!enrollmentSnapshot) {
                throw Object.assign(new Error("Enrollment not found."), {
                    statusCode: 404,
                });
            }

            const student = await acquireStudentWriteFence(
                enrollmentSnapshot.student,
                transactionSession
            );
            if (!student) {
                throw Object.assign(
                    new Error("Enrollment Student not found."),
                    { statusCode: 404 }
                );
            }

            const enrollment = await StudentEnrollment.findById(id)
                .session(transactionSession);
            if (!enrollment) {
                throw Object.assign(new Error("Enrollment not found."), {
                    statusCode: 404,
                });
            }
            if (enrollment.status !== "active") {
                throw Object.assign(
                    new Error("Only active enrollments can be closed."),
                    { statusCode: 409 }
                );
            }

            const academicSession = await AcademicSession.findById(
                enrollment.academicSession
            ).session(transactionSession);
            if (!academicSession) {
                throw Object.assign(
                    new Error("Enrollment AcademicSession not found."),
                    { statusCode: 409 }
                );
            }
            if (
                endDate < enrollment.startDate ||
                endDate < academicSession.startDate ||
                endDate > academicSession.endDate
            ) {
                throw Object.assign(
                    new Error(
                        "Enrollment endDate must be on or after its start date and within the AcademicSession boundaries."
                    ),
                    { statusCode: 400 }
                );
            }

            enrollment.status = status;
            enrollment.endDate = endDate;
            enrollment.endedAt = new Date();
            enrollment.endReason = status;
            enrollment.endedBy = req.user.id;
            await enrollment.save({ session: transactionSession });

            populatedEnrollment = await populateEnrollment(
                StudentEnrollment.findById(id).session(transactionSession)
            );
        });

        return res.status(200).json({
            message: "Student enrollment closed successfully.",
            enrollment: populatedEnrollment,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

export const promoteStudentEnrollment = async (req, res) => {
    const { id: sourceEnrollmentId } = req.params;
    if (!isValidObjectId(sourceEnrollmentId)) {
        return res.status(400).json({ message: "Invalid source enrollment ID." });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            message: "A valid enrollment promotion request is required.",
        });
    }

    const allowedFields = new Set([
        "destinationAcademicSession",
        "destinationClassSection",
        "promotionDate",
    ]);
    const unknownField = Object.keys(req.body).find(
        (field) => !allowedFields.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported enrollment promotion field: ${unknownField}.`,
        });
    }

    const {
        destinationAcademicSession: destinationSessionId,
        destinationClassSection: destinationClassSectionId,
    } = req.body;
    if (
        !isValidObjectId(destinationSessionId) ||
        !isValidObjectId(destinationClassSectionId)
    ) {
        return res.status(400).json({
            message:
                "Valid destinationAcademicSession and destinationClassSection IDs are required.",
        });
    }

    const promotionDate = parseDateOnly(req.body.promotionDate);
    if (!promotionDate) {
        return res.status(400).json({
            message: "Promotion date must be a valid YYYY-MM-DD date.",
        });
    }

    let transactionSession;
    let sourceEnrollmentResult;
    let destinationEnrollmentResult;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            const sourceSnapshot = await StudentEnrollment.findById(
                sourceEnrollmentId
            ).session(transactionSession);
            if (!sourceSnapshot) {
                throw Object.assign(
                    new Error("Source enrollment not found."),
                    { statusCode: 404 }
                );
            }

            const student = await acquireStudentWriteFence(
                sourceSnapshot.student,
                transactionSession
            );
            if (!student) {
                throw Object.assign(
                    new Error("Enrollment Student not found."),
                    { statusCode: 404 }
                );
            }
            if (student.status !== "active") {
                throw Object.assign(
                    new Error("Only active Students can be promoted."),
                    { statusCode: 400 }
                );
            }
            if (!student.program) {
                throw Object.assign(
                    new Error("Student does not reference a valid Program."),
                    { statusCode: 400 }
                );
            }

            const sourceEnrollment = await StudentEnrollment.findById(
                sourceEnrollmentId
            ).session(transactionSession);
            if (!sourceEnrollment) {
                throw Object.assign(
                    new Error("Source enrollment not found."),
                    { statusCode: 404 }
                );
            }
            if (sourceEnrollment.status !== "active") {
                throw Object.assign(
                    new Error("Only active enrollments can be promoted."),
                    { statusCode: 409 }
                );
            }
            if (sourceEnrollment.student.toString() !== student._id.toString()) {
                throw Object.assign(
                    new Error("Source enrollment Student changed during promotion."),
                    { statusCode: 409 }
                );
            }
            if (
                !(sourceEnrollment.startDate instanceof Date) ||
                !Number.isFinite(sourceEnrollment.startDate.getTime()) ||
                sourceEnrollment.startDate.getUTCHours() !== 0 ||
                sourceEnrollment.startDate.getUTCMinutes() !== 0 ||
                sourceEnrollment.startDate.getUTCSeconds() !== 0 ||
                sourceEnrollment.startDate.getUTCMilliseconds() !== 0
            ) {
                throw Object.assign(
                    new Error("Source enrollment has an invalid start date."),
                    { statusCode: 409 }
                );
            }
            if (promotionDate < sourceEnrollment.startDate) {
                throw Object.assign(
                    new Error(
                        "Promotion date cannot precede the source enrollment start date."
                    ),
                    { statusCode: 400 }
                );
            }

            const destinationSession = await AcademicSession.findById(
                destinationSessionId
            ).session(transactionSession);
            if (!destinationSession) {
                throw Object.assign(
                    new Error("Destination AcademicSession not found."),
                    { statusCode: 404 }
                );
            }
            if (
                destinationSession._id.toString() ===
                sourceEnrollment.academicSession.toString()
            ) {
                throw Object.assign(
                    new Error(
                        "Destination AcademicSession must differ from the source session."
                    ),
                    { statusCode: 400 }
                );
            }
            if (!["planned", "active"].includes(destinationSession.status)) {
                throw Object.assign(
                    new Error(
                        "Only planned or active AcademicSessions accept promotions."
                    ),
                    { statusCode: 400 }
                );
            }
            if (
                promotionDate < destinationSession.startDate ||
                promotionDate > destinationSession.endDate
            ) {
                throw Object.assign(
                    new Error(
                        "Promotion date must be within the destination AcademicSession boundaries."
                    ),
                    { statusCode: 400 }
                );
            }

            const classSection = await ClassSection.findById(
                destinationClassSectionId
            ).session(transactionSession);
            if (!classSection) {
                throw Object.assign(
                    new Error("Destination ClassSection not found."),
                    { statusCode: 404 }
                );
            }
            if (!classSection.program || !classSection.department) {
                throw Object.assign(
                    new Error(
                        "Destination ClassSection does not reference a valid Program and Department."
                    ),
                    { statusCode: 400 }
                );
            }
            if (classSection.program.toString() !== student.program.toString()) {
                throw Object.assign(
                    new Error(
                        "Destination ClassSection must belong to the Student's Program."
                    ),
                    { statusCode: 400 }
                );
            }

            const program = await Program.findById(classSection.program)
                .session(transactionSession);
            if (
                !program ||
                !program.department ||
                program.department.toString() !== classSection.department.toString()
            ) {
                throw Object.assign(
                    new Error(
                        "Destination ClassSection has an invalid Program or Department reference."
                    ),
                    { statusCode: 400 }
                );
            }
            const departmentExists = await Department.exists({
                _id: classSection.department,
            }).session(transactionSession);
            if (!departmentExists) {
                throw Object.assign(
                    new Error(
                        "Destination ClassSection references a missing Department."
                    ),
                    { statusCode: 400 }
                );
            }

            const existingDestinationEnrollment =
                await StudentEnrollment.findOne({
                    student: student._id,
                    academicSession: destinationSession._id,
                    status: "active",
                }).session(transactionSession);
            if (existingDestinationEnrollment) {
                throw Object.assign(
                    new Error(
                        "An active enrollment already exists for this Student and destination AcademicSession."
                    ),
                    { statusCode: 409 }
                );
            }

            sourceEnrollment.status = "completed";
            sourceEnrollment.endDate = promotionDate;
            sourceEnrollment.endedAt = new Date();
            sourceEnrollment.endReason = "promoted";
            sourceEnrollment.endedBy = req.user.id;
            await sourceEnrollment.save({ session: transactionSession });

            const destinationEnrollment = new StudentEnrollment({
                student: student._id,
                classSection: classSection._id,
                academicSession: destinationSession._id,
                status: "active",
                startDate: promotionDate,
                createdBy: req.user.id,
                previousEnrollment: sourceEnrollment._id,
            });
            await destinationEnrollment.save({ session: transactionSession });

            sourceEnrollmentResult = await populateEnrollment(
                StudentEnrollment.findById(sourceEnrollment._id)
                    .session(transactionSession)
            );
            destinationEnrollmentResult = await populateEnrollment(
                StudentEnrollment.findById(destinationEnrollment._id)
                    .session(transactionSession)
            );
        });

        return res.status(201).json({
            message: "Student promoted successfully.",
            sourceEnrollment: sourceEnrollmentResult,
            enrollment: destinationEnrollmentResult,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

export const bulkPromoteStudentEnrollments = async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            message: "A valid bulk promotion request is required.",
        });
    }

    const allowedFields = new Set([
        "promotions",
        "destinationAcademicSession",
        "promotionDate",
    ]);
    const unknownField = Object.keys(req.body).find(
        (field) => !allowedFields.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported bulk promotion field: ${unknownField}.`,
        });
    }

    const {
        promotions,
        destinationAcademicSession: destinationSessionId,
    } = req.body;
    if (!Array.isArray(promotions) || promotions.length === 0) {
        return res.status(400).json({
            message: "Select at least one active enrollment to promote.",
        });
    }
    if (promotions.length > 100) {
        return res.status(400).json({
            message: "A bulk promotion batch cannot exceed 100 enrollments.",
        });
    }
    if (!isValidObjectId(destinationSessionId)) {
        return res.status(400).json({
            message: "A valid destinationAcademicSession ID is required.",
        });
    }

    const promotionDate = parseDateOnly(req.body.promotionDate);
    if (!promotionDate) {
        return res.status(400).json({
            message: "Promotion date must be a valid YYYY-MM-DD date.",
        });
    }

    const sourceIds = [];
    const destinationClassIds = [];
    const sourceIdSet = new Set();
    const normalizedPromotions = [];
    for (let index = 0; index < promotions.length; index += 1) {
        const promotion = promotions[index];
        if (
            !promotion ||
            typeof promotion !== "object" ||
            Array.isArray(promotion) ||
            Object.keys(promotion).some(
                (field) =>
                    !["sourceEnrollment", "destinationClassSection"].includes(
                        field
                    )
            ) ||
            !isValidObjectId(promotion.sourceEnrollment) ||
            !isValidObjectId(promotion.destinationClassSection)
        ) {
            return res.status(400).json({
                message: `Promotion item ${index + 1} must include valid sourceEnrollment and destinationClassSection IDs.`,
            });
        }
        const sourceId = new mongoose.Types.ObjectId(
            promotion.sourceEnrollment
        ).toString();
        const destinationClassId = new mongoose.Types.ObjectId(
            promotion.destinationClassSection
        ).toString();
        if (sourceIdSet.has(sourceId)) {
            return res.status(400).json({
                message: `Duplicate source enrollment ID: ${sourceId}.`,
            });
        }
        sourceIdSet.add(sourceId);
        sourceIds.push(sourceId);
        destinationClassIds.push(destinationClassId);
        normalizedPromotions.push({
            sourceEnrollment: sourceId,
            destinationClassSection: destinationClassId,
        });
    }

    let transactionSession;
    let promotionResults;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            const sourceSnapshots = await StudentEnrollment.find({
                _id: { $in: sourceIds },
            }).session(transactionSession);
            const sourceById = new Map(
                sourceSnapshots.map((enrollment) => [
                    enrollment._id.toString(),
                    enrollment,
                ])
            );
            for (const sourceId of sourceIds) {
                if (!sourceById.has(sourceId)) {
                    throw Object.assign(
                        new Error(`Source enrollment ${sourceId} not found.`),
                        { statusCode: 404 }
                    );
                }
            }

            const studentIds = [];
            for (const enrollment of sourceSnapshots) {
                if (!enrollment.student) {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${enrollment._id} does not reference a Student.`
                        ),
                        { statusCode: 409 }
                    );
                }
                studentIds.push(enrollment.student.toString());
            }
            const sortedStudentIds = [...new Set(studentIds)].sort();
            if (sortedStudentIds.length !== sourceSnapshots.length) {
                throw Object.assign(
                    new Error(
                        "A Student can appear only once in a bulk promotion batch."
                    ),
                    { statusCode: 400 }
                );
            }
            const studentsById = new Map();
            for (const studentId of sortedStudentIds) {
                const student = await acquireStudentWriteFence(
                    studentId,
                    transactionSession
                );
                if (!student) {
                    throw Object.assign(
                        new Error(
                            `Student ${studentId} referenced by a source enrollment was not found.`
                        ),
                        { statusCode: 404 }
                    );
                }
                if (student.status !== "active") {
                    throw Object.assign(
                        new Error(
                            `Student ${studentId} is not active and cannot be promoted.`
                        ),
                        { statusCode: 400 }
                    );
                }
                if (!student.program) {
                    throw Object.assign(
                        new Error(
                            `Student ${studentId} does not reference a valid Program.`
                        ),
                        { statusCode: 400 }
                    );
                }
                studentsById.set(studentId, student);
            }

            const sources = await StudentEnrollment.find({
                _id: { $in: sourceIds },
            }).session(transactionSession);
            const sourcesById = new Map(
                sources.map((enrollment) => [
                    enrollment._id.toString(),
                    enrollment,
                ])
            );
            for (const sourceId of sourceIds) {
                if (!sourcesById.has(sourceId)) {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${sourceId} changed during promotion.`
                        ),
                        { statusCode: 409 }
                    );
                }
            }
            const currentStudentIds = [
                ...new Set(
                    sources.map((enrollment) =>
                        enrollment.student?.toString()
                    )
                ),
            ];
            if (
                currentStudentIds.length !== sortedStudentIds.length ||
                currentStudentIds.some(
                    (studentId) => !studentsById.has(studentId)
                )
            ) {
                throw Object.assign(
                    new Error(
                        "A source enrollment Student reference changed during promotion."
                    ),
                    { statusCode: 409 }
                );
            }
            const destinationSession = await AcademicSession.findById(
                destinationSessionId
            ).session(transactionSession);
            if (!destinationSession) {
                throw Object.assign(
                    new Error("Destination AcademicSession not found."),
                    { statusCode: 404 }
                );
            }
            if (!["planned", "active"].includes(destinationSession.status)) {
                throw Object.assign(
                    new Error(
                        "Only planned or active AcademicSessions accept promotions."
                    ),
                    { statusCode: 400 }
                );
            }
            if (
                promotionDate < destinationSession.startDate ||
                promotionDate > destinationSession.endDate
            ) {
                throw Object.assign(
                    new Error(
                        "Promotion date must be within the destination AcademicSession boundaries."
                    ),
                    { statusCode: 400 }
                );
            }

            const activeDestinationStudentIds = new Set(
                (
                    await StudentEnrollment.find({
                        student: { $in: sortedStudentIds },
                        academicSession: destinationSession._id,
                        status: "active",
                    })
                        .select("student")
                        .session(transactionSession)
                ).map((enrollment) => enrollment.student.toString())
            );

            const classSections = await ClassSection.find({
                _id: {
                    $in: [
                        ...new Set(
                            destinationClassIds.map((value) =>
                                value.toString()
                            )
                        ),
                    ],
                },
            }).session(transactionSession);
            const classesById = new Map(
                classSections.map((classSection) => [
                    classSection._id.toString(),
                    classSection,
                ])
            );
            const programIds = [
                ...new Set(
                    classSections
                        .map((classSection) =>
                            classSection.program?.toString()
                        )
                        .filter(Boolean)
                ),
            ];
            const programs = await Program.find({
                _id: { $in: programIds },
            }).session(transactionSession);
            const programsById = new Map(
                programs.map((program) => [program._id.toString(), program])
            );
            const departmentIds = [
                ...new Set(
                    [
                        ...classSections.map((classSection) =>
                            classSection.department?.toString()
                        ),
                        ...programs.map((program) =>
                            program.department?.toString()
                        ),
                    ].filter(Boolean)
                ),
            ];
            const departments = await Department.find({
                _id: { $in: departmentIds },
            })
                .select("_id")
                .session(transactionSession);
            const existingDepartmentIds = new Set(
                departments.map((department) => department._id.toString())
            );

            const preparedPromotions = [];
            for (const promotion of normalizedPromotions) {
                const sourceEnrollment = sourcesById.get(
                    promotion.sourceEnrollment
                );
                if (!sourceEnrollment.student || !sourceEnrollment.academicSession) {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${sourceEnrollment._id} has a missing Student or AcademicSession reference.`
                        ),
                        { statusCode: 409 }
                    );
                }
                const studentId = sourceEnrollment.student.toString();
                const student = studentsById.get(studentId);
                if (sourceEnrollment.status !== "active") {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${sourceEnrollment._id} for Student ${studentId} is not active.`
                        ),
                        { statusCode: 409 }
                    );
                }
                if (
                    sourceEnrollment.student.toString() !== student._id.toString()
                ) {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${sourceEnrollment._id} Student reference changed during promotion.`
                        ),
                        { statusCode: 409 }
                    );
                }
                const sourceStartDate = sourceEnrollment.startDate;
                if (
                    !(sourceStartDate instanceof Date) ||
                    !Number.isFinite(sourceStartDate.getTime()) ||
                    sourceStartDate.getUTCHours() !== 0 ||
                    sourceStartDate.getUTCMinutes() !== 0 ||
                    sourceStartDate.getUTCSeconds() !== 0 ||
                    sourceStartDate.getUTCMilliseconds() !== 0
                ) {
                    throw Object.assign(
                        new Error(
                            `Source enrollment ${sourceEnrollment._id} has an invalid start date.`
                        ),
                        { statusCode: 409 }
                    );
                }
                if (promotionDate < sourceStartDate) {
                    throw Object.assign(
                        new Error(
                            `Promotion date cannot precede source enrollment ${sourceEnrollment._id} start date for Student ${studentId}.`
                        ),
                        { statusCode: 400 }
                    );
                }
                if (
                    destinationSession._id.toString() ===
                    sourceEnrollment.academicSession.toString()
                ) {
                    throw Object.assign(
                        new Error(
                            `Destination AcademicSession must differ from the source session for enrollment ${sourceEnrollment._id}.`
                        ),
                        { statusCode: 400 }
                    );
                }
                if (activeDestinationStudentIds.has(studentId)) {
                    throw Object.assign(
                        new Error(
                            `Student ${studentId} already has an active enrollment in the destination AcademicSession.`
                        ),
                        { statusCode: 409 }
                    );
                }

                const classSection = classesById.get(
                    promotion.destinationClassSection
                );
                if (!classSection) {
                    throw Object.assign(
                        new Error(
                            `Destination ClassSection ${promotion.destinationClassSection} for Student ${studentId} not found.`
                        ),
                        { statusCode: 404 }
                    );
                }
                if (!classSection.program || !classSection.department) {
                    throw Object.assign(
                        new Error(
                            `Destination ClassSection ${classSection._id} for Student ${studentId} has invalid Program or Department references.`
                        ),
                        { statusCode: 400 }
                    );
                }
                if (
                    classSection.program.toString() !== student.program.toString()
                ) {
                    throw Object.assign(
                        new Error(
                            `Destination ClassSection ${classSection._id} does not match Student ${studentId} Program.`
                        ),
                        { statusCode: 400 }
                    );
                }
                const program = programsById.get(classSection.program.toString());
                if (
                    !program ||
                    !program.department ||
                    program.department.toString() !==
                        classSection.department.toString() ||
                    !existingDepartmentIds.has(classSection.department.toString()) ||
                    !existingDepartmentIds.has(program.department.toString())
                ) {
                    throw Object.assign(
                        new Error(
                            `Destination ClassSection ${classSection._id} for Student ${studentId} has missing or inconsistent Program/Department references.`
                        ),
                        { statusCode: 400 }
                    );
                }

                preparedPromotions.push({
                    sourceEnrollment,
                    student,
                    classSection,
                });
            }

            const results = [];
            for (const promotion of preparedPromotions) {
                const { sourceEnrollment, student, classSection } = promotion;
                sourceEnrollment.status = "completed";
                sourceEnrollment.endDate = promotionDate;
                sourceEnrollment.endedAt = new Date();
                sourceEnrollment.endReason = "promoted";
                sourceEnrollment.endedBy = req.user.id;
                await sourceEnrollment.save({ session: transactionSession });

                const destinationEnrollment = new StudentEnrollment({
                    student: student._id,
                    classSection: classSection._id,
                    academicSession: destinationSession._id,
                    status: "active",
                    startDate: promotionDate,
                    createdBy: req.user.id,
                    previousEnrollment: sourceEnrollment._id,
                });
                await destinationEnrollment.save({ session: transactionSession });
                results.push({
                    sourceEnrollmentId: sourceEnrollment._id,
                    destinationEnrollmentId: destinationEnrollment._id,
                });
            }

            promotionResults = [];
            for (const result of results) {
                promotionResults.push({
                    sourceEnrollment: await populateEnrollment(
                        StudentEnrollment.findById(result.sourceEnrollmentId)
                            .session(transactionSession)
                    ),
                    enrollment: await populateEnrollment(
                        StudentEnrollment.findById(
                            result.destinationEnrollmentId
                        ).session(transactionSession)
                    ),
                });
            }
        });

        return res.status(201).json({
            message: "Students promoted successfully.",
            promotions: promotionResults,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

export const getStudentEnrollments = async (req, res) => {
    const unknownField = Object.keys(req.query).find(
        (field) => !ALLOWED_QUERY_FIELDS.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported filter: ${unknownField}.`,
        });
    }

    const filter = {};
    for (const field of ["student", "classSection", "academicSession"]) {
        if (req.query[field] !== undefined) {
            if (!isValidObjectId(req.query[field])) {
                return res.status(400).json({
                    message: `Invalid ${field} ID.`,
                });
            }
            filter[field] = req.query[field];
        }
    }

    if (req.query.status !== undefined) {
        if (
            typeof req.query.status !== "string" ||
            !ENROLLMENT_STATUSES.includes(req.query.status)
        ) {
            return res.status(400).json({
                message: "Invalid enrollment status filter.",
            });
        }
        filter.status = req.query.status;
    }

    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({
            message: `Page and limit must be positive integers, limit cannot exceed ${MAX_PAGE_SIZE}, and page offset cannot exceed ${MAX_PAGE_OFFSET}.`,
        });
    }

    try {
        const [enrollments, total] = await Promise.all([
            populateEnrollment(
                StudentEnrollment.find(filter)
                    .sort({ createdAt: -1 })
                    .skip(pagination.offset)
                    .limit(pagination.limit)
            ),
            StudentEnrollment.countDocuments(filter),
        ]);

        return res.status(200).json({
            message: "Student enrollments retrieved successfully.",
            enrollments,
            pagination: {
                total,
                page: pagination.page,
                limit: pagination.limit,
                pages: Math.ceil(total / pagination.limit),
            },
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export const getStudentEnrollmentById = async (req, res) => {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid enrollment ID." });
    }

    try {
        const enrollment = await populateEnrollment(
            StudentEnrollment.findById(id)
        );
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found." });
        }

        return res.status(200).json({
            message: "Student enrollment retrieved successfully.",
            enrollment,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export const getEligibleStudents = async (req, res) => {
    const { classSection: classSectionId, academicSession: academicSessionId } =
        req.query;

    if (!isValidObjectId(classSectionId) || !isValidObjectId(academicSessionId)) {
        return res.status(400).json({
            message: "Valid classSection and academicSession IDs are required.",
        });
    }

    const unknownFields = Object.keys(req.query).filter(
        (field) =>
            !["classSection", "academicSession", "page", "limit"].includes(field)
    );
    if (unknownFields.length > 0) {
        return res.status(400).json({
            message: `Unsupported filter: ${unknownFields[0]}.`,
        });
    }

    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({
            message: `Page and limit must be positive integers, limit cannot exceed ${MAX_PAGE_SIZE}, and page offset cannot exceed ${MAX_PAGE_OFFSET}.`,
        });
    }

    try {
        const [classSection, academicSession] = await Promise.all([
            ClassSection.findById(classSectionId).populate({
                path: "program",
                select: "name department",
            }),
            AcademicSession.findById(academicSessionId).select(
                "name startDate endDate status"
            ),
        ]);

        if (!classSection) {
            return res.status(404).json({ message: "Class section not found." });
        }
        if (!academicSession) {
            return res.status(404).json({ message: "Academic session not found." });
        }
        if (academicSession.status === "completed") {
            return res.status(400).json({
                message: "Students cannot be enrolled in a completed academic session.",
            });
        }
        if (!["planned", "active"].includes(academicSession.status)) {
            return res.status(400).json({
                message: "Academic session is not available for enrollment.",
            });
        }

        const program = classSection.program;
        if (!program) {
            return res.status(400).json({
                message: "The class section does not reference a valid program.",
            });
        }
        if (
            !classSection.department ||
            !program.department ||
            program.department.toString() !== classSection.department.toString()
        ) {
            return res.status(400).json({
                message:
                    "The class section department does not match its program department.",
            });
        }

        const departmentExists = await Department.exists({
            _id: classSection.department,
        });
        if (!departmentExists) {
            return res.status(400).json({
                message:
                    "The class section or program references a department that does not exist.",
            });
        }

        const activeStudentIds = await StudentEnrollment.distinct("student", {
            academicSession: academicSession._id,
            status: "active",
        });
        const studentFilter = {
            program: program._id,
            status: "active",
            _id: { $nin: activeStudentIds },
        };
        const [students, total] = await Promise.all([
            Student.find(studentFilter)
                .select("name rollNo status program")
                .populate("program", "name")
                .sort({ name: 1 })
                .skip(pagination.offset)
                .limit(pagination.limit),
            Student.countDocuments(studentFilter),
        ]);

        return res.status(200).json({
            message: "Eligible students retrieved successfully.",
            classSection: {
                _id: classSection._id,
                name: classSection.name,
                section: classSection.section,
                semester: classSection.semester,
                program: { _id: program._id, name: program.name },
            },
            academicSession,
            eligibleStudents: students,
            pagination: {
                total,
                page: pagination.page,
                limit: pagination.limit,
                pages: Math.ceil(total / pagination.limit),
            },
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};
