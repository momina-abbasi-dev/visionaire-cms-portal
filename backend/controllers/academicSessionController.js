import mongoose from "mongoose";
import AcademicSession from "../models/AcademicSession.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import { isTransactionWriteConflict } from "../utils/studentWriteFence.js";

const VALID_STATUSES = ["planned", "active", "completed"];
const WRITABLE_FIELDS = ["name", "startDate", "endDate", "status"];

const parseUtcDate = (value) => {
    if (typeof value !== "string") return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

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

const populateAuditUsers = (query) =>
    query
        .populate("createdBy", "name")
        .populate("updatedBy", "name");

const sendControllerError = (res, error) => {
    if (error.code === 11000) {
        return res.status(409).json({
            message: "An academic session with this name already exists.",
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({ message: error.message });
    }

    console.error("Academic session controller error:", error);
    return res.status(500).json({
        message: "Failed to process the academic session.",
    });
};

const validateName = (name) =>
    typeof name === "string" && Boolean(name.trim());

const validateStatus = (status) =>
    typeof status === "string" && VALID_STATUSES.includes(status);

const acquireAcademicSessionFence = async (id, session) => {
    const snapshot = await AcademicSession.findById(id)
        .select("_id __v")
        .session(session);
    if (!snapshot) return null;

    const versionFilter =
        snapshot.__v === undefined
            ? { __v: { $exists: false } }
            : { __v: snapshot.__v };
    const result = await AcademicSession.updateOne(
        { _id: snapshot._id, ...versionFilter },
        { $inc: { __v: 1 } },
        { session }
    );
    if (result.matchedCount !== 1) {
        const error = new Error("Academic session changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }

    const academicSession = await AcademicSession.findById(snapshot._id)
        .session(session);
    if (!academicSession) {
        const error = new Error("Academic session changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }
    return academicSession;
};

export const getAcademicSessions = async (req, res) => {
    try {
        const filter = {};
        if (req.query.status !== undefined) {
            if (!validateStatus(req.query.status)) {
                return res.status(400).json({
                    message: "Status must be planned, active, or completed.",
                });
            }
            filter.status = req.query.status;
        }

        const sessions = await populateAuditUsers(
            AcademicSession.find(filter).sort({ startDate: -1, name: 1 })
        );

        return res.status(200).json({
            message: "Academic sessions retrieved successfully.",
            count: sessions.length,
            sessions,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export const getAcademicSessionById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid academic session ID." });
    }

    try {
        const academicSession = await populateAuditUsers(
            AcademicSession.findById(id)
        );
        if (!academicSession) {
            return res.status(404).json({ message: "Academic session not found." });
        }

        return res.status(200).json({
            message: "Academic session retrieved successfully.",
            session: academicSession,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export const createAcademicSession = async (req, res) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ message: "A valid request body is required." });
    }

    const { name, startDate, endDate, status = "planned" } = req.body;

    if (!validateName(name)) {
        return res.status(400).json({ message: "Session name is required." });
    }

    const parsedStartDate = parseUtcDate(startDate);
    const parsedEndDate = parseUtcDate(endDate);
    if (!parsedStartDate || !parsedEndDate) {
        return res.status(400).json({
            message: "Start date and end date must be valid YYYY-MM-DD dates.",
        });
    }
    if (parsedStartDate > parsedEndDate) {
        return res.status(400).json({
            message: "End date must be on or after the start date.",
        });
    }
    if (!validateStatus(status)) {
        return res.status(400).json({
            message: "Status must be planned, active, or completed.",
        });
    }

    try {
        const actorId = req.user.id;
        const session = await AcademicSession.create({
            name: name.trim(),
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            status,
            createdBy: actorId,
            updatedBy: actorId,
        });

        const populatedSession = await populateAuditUsers(
            AcademicSession.findById(session._id)
        );
        return res.status(201).json({
            message: "Academic session created successfully.",
            session: populatedSession,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export const updateAcademicSession = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ message: "Invalid academic session ID." });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ message: "A valid request body is required." });
    }

    const unknownFields = Object.keys(req.body).filter(
        (field) => !WRITABLE_FIELDS.includes(field)
    );
    if (unknownFields.length > 0) {
        return res.status(400).json({
            message: `Unsupported field: ${unknownFields[0]}.`,
        });
    }
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
            message: "At least one academic session field must be provided.",
        });
    }
    if (Object.hasOwn(req.body, "name") && !validateName(req.body.name)) {
        return res.status(400).json({ message: "Session name is required." });
    }
    if (
        Object.hasOwn(req.body, "status") &&
        !validateStatus(req.body.status)
    ) {
        return res.status(400).json({
            message: "Status must be planned, active, or completed.",
        });
    }

    const parsedDates = {};
    for (const field of ["startDate", "endDate"]) {
        if (Object.hasOwn(req.body, field)) {
            parsedDates[field] = parseUtcDate(req.body[field]);
            if (!parsedDates[field]) {
                return res.status(400).json({
                    message: `${field} must be a valid YYYY-MM-DD date.`,
                });
            }
        }
    }

    let transactionSession;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            const academicSession = await acquireAcademicSessionFence(
                id,
                transactionSession
            );
            if (!academicSession) {
                throw Object.assign(
                    new Error("Academic session not found."),
                    { statusCode: 404 }
                );
            }

            const startDate = parsedDates.startDate || academicSession.startDate;
            const endDate = parsedDates.endDate || academicSession.endDate;
            if (startDate > endDate) {
                throw Object.assign(
                    new Error("End date must be on or after the start date."),
                    { statusCode: 400 }
                );
            }

            if (parsedDates.startDate || parsedDates.endDate) {
                const invalidatingEnrollment =
                    await StudentEnrollment.exists({
                        academicSession: academicSession._id,
                        $or: [
                            { startDate: { $lt: startDate } },
                            { startDate: { $gt: endDate } },
                            {
                                endDate: {
                                    $ne: null,
                                    $lt: startDate,
                                },
                            },
                            {
                                endDate: {
                                    $ne: null,
                                    $gt: endDate,
                                },
                            },
                        ],
                    }).session(transactionSession);

                if (invalidatingEnrollment) {
                    throw Object.assign(
                        new Error(
                            "Session dates cannot exclude an existing enrollment start or end date."
                        ),
                        { statusCode: 409 }
                    );
                }
            }

            if (Object.hasOwn(req.body, "name")) {
                academicSession.name = req.body.name.trim();
            }
            if (parsedDates.startDate) {
                academicSession.startDate = parsedDates.startDate;
            }
            if (parsedDates.endDate) {
                academicSession.endDate = parsedDates.endDate;
            }
            if (Object.hasOwn(req.body, "status")) {
                academicSession.status = req.body.status;
            }
            academicSession.updatedBy = req.user.id;

            await academicSession.save({ session: transactionSession });
        });

        const populatedSession = await populateAuditUsers(
            AcademicSession.findById(id)
        );
        return res.status(200).json({
            message: "Academic session updated successfully.",
            session: populatedSession,
        });
    } catch (error) {
        if (error.statusCode || isTransactionWriteConflict(error)) {
            const statusCode =
                error.statusCode || 409;
            return res.status(statusCode).json({ message: error.message });
        }
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};
