
import mongoose from "mongoose";
import AcademicAssignment from "../models/AcademicAssignment.js";
import AcademicSession from "../models/AcademicSession.js";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import Subject from "../models/Subject.js";
import Teacher from "../models/Teacher.js";

const isValidId = (id) => mongoose.isValidObjectId(id);
const isValidRequestId = (id) =>
    typeof id === "string" && mongoose.isValidObjectId(id);

const populateAssignment = (query) =>
    query
        .populate("teacher", "name email registrationNo status")
        .populate("subject", "name code creditHours")
        .populate("classSection", "name section semester");

const invalidAssignment = (message, statusCode = 400) =>
    Object.assign(new Error(message), { statusCode });

const handleError = (res, error) => {
    if (error.statusCode) {
        return res.status(error.statusCode).json({
            message: error.message,
        });
    }

    if (error.code === 11000) {
        return res.status(409).json({
            message:
                "An active teacher is already assigned to this subject and class section for this session",
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: error.message,
        });
    }

    console.error("Academic assignment error:", error);

    return res.status(500).json({
        message: "An unexpected server error occurred",
    });
};

const createAssignment = async (req, res) => {
    const { teacher, subject, classSection, session } = req.body;

    try {
        if (
            !isValidId(teacher) ||
            !isValidId(subject) ||
            !isValidId(classSection)
        ) {
            return res.status(400).json({
                message: "Valid teacher, subject, and class section IDs are required",
            });
        }

        if (typeof session !== "string" || !session.trim()) {
            return res.status(400).json({
                message: "Session is required",
            });
        }

        const normalizedSession = session.trim();
        const academicSession = await AcademicSession.findOne({
            name: normalizedSession,
        }).select("_id");
        if (!academicSession) {
            return res.status(400).json({
                message: "Academic session not found",
            });
        }

        const [existingTeacher, existingSubject, existingClassSection] =
            await Promise.all([
                Teacher.findById(teacher),
                Subject.findById(subject),
                ClassSection.findById(classSection),
            ]);

        if (!existingTeacher) {
            return res.status(404).json({
                message: "Teacher not found",
            });
        }

        if (!existingSubject) {
            return res.status(404).json({
                message: "Subject not found",
            });
        }

        if (!existingClassSection) {
            return res.status(404).json({
                message: "Class section not found",
            });
        }

        if (existingTeacher.status !== "active") {
            return res.status(400).json({
                message: "Only an active teacher can receive an academic assignment",
            });
        }

        if (
            existingTeacher.department.toString() !==
                existingSubject.department.toString() ||
            existingTeacher.department.toString() !==
                existingClassSection.department.toString()
        ) {
            return res.status(400).json({
                message:
                    "Teacher, subject, and class section must belong to the same department",
            });
        }

        if (
            existingSubject.program.toString() !==
            existingClassSection.program.toString()
        ) {
            return res.status(400).json({
                message:
                    "The selected subject does not belong to the class section's program",
            });
        }

        // Only one ACTIVE teacher assignment per subject,
        // class section, and session.
        const existingAssignment = await AcademicAssignment.findOne({
            subject,
            classSection,
            session: normalizedSession,
            isActive: true,
        });

        if (existingAssignment) {
            return res.status(409).json({
                message:
                    "This subject already has an active teacher assignment for this class section and session",
            });
        }

        const newAssignment = await AcademicAssignment.create({
            teacher,
            subject,
            classSection,
            session: normalizedSession,
        });

        const populatedAssignment = await AcademicAssignment.findById(
            newAssignment._id
        )
            .populate("teacher", "name email registrationNo status")
            .populate("subject", "name code creditHours")
            .populate("classSection", "name section semester");

        return res.status(201).json({
            message: "Academic assignment created successfully",
            assignment: populatedAssignment,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

const getAssignments = async (req, res) => {
    const { teacher, subject, classSection, session, isActive } = req.query;

    try {
        const filter = {};

        const idFilters = [
            ["teacher", teacher],
            ["subject", subject],
            ["classSection", classSection],
        ];

        for (const [field, value] of idFilters) {
            if (value !== undefined) {
                if (!isValidId(value)) {
                    return res.status(400).json({
                        message: `Invalid ${field} ID`,
                    });
                }

                filter[field] = value;
            }
        }

        if (session !== undefined) {
            if (typeof session !== "string" || !session.trim()) {
                return res.status(400).json({
                    message: "Session must be a non-empty string",
                });
            }

            filter.session = session.trim();
        }

        if (isActive !== undefined) {
            if (isActive !== "true" && isActive !== "false") {
                return res.status(400).json({
                    message: "isActive must be true or false",
                });
            }

            filter.isActive = isActive === "true";
        }

        const assignments = await AcademicAssignment.find(filter)
            .populate("teacher", "name email registrationNo status")
            .populate("subject", "name code creditHours")
            .populate("classSection", "name section semester")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Academic assignments retrieved successfully",
            assignments,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

const updateAssignment = async (req, res) => {
    const { id } = req.params;
    if (!isValidRequestId(id)) {
        return res.status(400).json({
            message: "Invalid academic assignment ID",
        });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            message: "A valid academic assignment update is required",
        });
    }

    const allowedFields = new Set([
        "teacher",
        "subject",
        "classSection",
        "session",
        "isActive",
    ]);
    const unknownField = Object.keys(req.body).find(
        (field) => !allowedFields.has(field)
    );
    if (unknownField) {
        return res.status(400).json({
            message: `Unsupported assignment field: ${unknownField}`,
        });
    }
    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
            message: "At least one assignment field must be provided",
        });
    }

    for (const field of ["teacher", "subject", "classSection"]) {
        if (
            req.body[field] !== undefined &&
            !isValidRequestId(req.body[field])
        ) {
            return res.status(400).json({
                message: `Valid ${field} ID is required`,
            });
        }
    }
    if (
        req.body.session !== undefined &&
        (typeof req.body.session !== "string" || !req.body.session.trim())
    ) {
        return res.status(400).json({
            message: "Session is required",
        });
    }
    if (
        req.body.isActive !== undefined &&
        typeof req.body.isActive !== "boolean"
    ) {
        return res.status(400).json({
            message: "isActive must be a boolean",
        });
    }

    try {
        const assignment = await AcademicAssignment.findById(id);
        if (!assignment) {
            return res.status(404).json({
                message: "Academic assignment not found",
            });
        }

        const teacherId = req.body.teacher ?? assignment.teacher.toString();
        const subjectId = req.body.subject ?? assignment.subject.toString();
        const classSectionId =
            req.body.classSection ?? assignment.classSection.toString();
        const session =
            req.body.session === undefined
                ? assignment.session
                : req.body.session.trim();
        const isActive = req.body.isActive ?? assignment.isActive;

        const [teacher, subject, classSection] = await Promise.all([
            Teacher.findById(teacherId),
            Subject.findById(subjectId),
            ClassSection.findById(classSectionId),
        ]);
        if (!teacher) {
            throw invalidAssignment("Teacher not found", 404);
        }
        if (!subject) {
            throw invalidAssignment("Subject not found", 404);
        }
        if (!classSection) {
            throw invalidAssignment("Class section not found", 404);
        }
        const academicSession = await AcademicSession.findOne({
            name: session,
        }).select("_id");
        if (!academicSession) {
            throw invalidAssignment("Academic session not found");
        }
        if (teacher.status !== "active") {
            throw invalidAssignment(
                "Only an active teacher can receive an academic assignment"
            );
        }
        if (
            !teacher.department ||
            !subject.department ||
            !classSection.department ||
            !subject.program ||
            !classSection.program
        ) {
            throw invalidAssignment(
                "Teacher, subject, or class section has a missing department or program reference"
            );
        }
        if (
            teacher.department.toString() !== subject.department.toString() ||
            teacher.department.toString() !== classSection.department.toString()
        ) {
            throw invalidAssignment(
                "Teacher, subject, and class section must belong to the same department"
            );
        }
        if (
            subject.program.toString() !== classSection.program.toString()
        ) {
            throw invalidAssignment(
                "The selected subject does not belong to the class section's program"
            );
        }

        const [department, program] = await Promise.all([
            Department.findById(teacher.department),
            Program.findById(classSection.program),
        ]);
        if (!department || !program) {
            throw invalidAssignment(
                "Assignment references a missing department or program",
                404
            );
        }
        if (
            !program.department ||
            program.department.toString() !== teacher.department.toString()
        ) {
            throw invalidAssignment(
                "Teacher, subject, class section, and program references are inconsistent"
            );
        }
        if (typeof session !== "string" || !session.trim()) {
            throw invalidAssignment("Session is required");
        }

        if (isActive) {
            const duplicate = await AcademicAssignment.findOne({
                _id: { $ne: assignment._id },
                subject: subject._id,
                classSection: classSection._id,
                session: session.trim(),
                isActive: true,
            });
            if (duplicate) {
                throw invalidAssignment(
                    "This subject already has an active teacher assignment for this class section and session",
                    409
                );
            }
        }

        const updatedAssignment = await AcademicAssignment.findOneAndUpdate(
            {
                _id: assignment._id,
                updatedAt: assignment.updatedAt,
            },
            {
                $set: {
                    teacher: teacher._id,
                    subject: subject._id,
                    classSection: classSection._id,
                    session: session.trim(),
                    isActive,
                },
            },
            { new: true, runValidators: true }
        );
        if (!updatedAssignment) {
            throw invalidAssignment(
                "Academic assignment changed while it was being updated; reload and try again",
                409
            );
        }

        return res.status(200).json({
            message: "Academic assignment updated successfully",
            assignment: await populateAssignment(
                AcademicAssignment.findById(updatedAssignment._id)
            ),
        });
    } catch (error) {
        return handleError(res, error);
    }
};

const deactivateAssignment = async (req, res) => {
    const { id } = req.params;
    if (!isValidRequestId(id)) {
        return res.status(400).json({
            message: "Invalid academic assignment ID",
        });
    }

    try {
        const assignment = await AcademicAssignment.findById(id);
        if (!assignment) {
            return res.status(404).json({
                message: "Academic assignment not found",
            });
        }
        if (!assignment.isActive) {
            return res.status(409).json({
                message: "Academic assignment is already inactive",
            });
        }

        const deactivated = await AcademicAssignment.findOneAndUpdate(
            { _id: assignment._id, isActive: true },
            { $set: { isActive: false } },
            { new: true, runValidators: true }
        );
        if (!deactivated) {
            return res.status(409).json({
                message: "Academic assignment is already inactive",
            });
        }

        return res.status(200).json({
            message: "Academic assignment deactivated successfully",
            assignment: await populateAssignment(
                AcademicAssignment.findById(deactivated._id)
            ),
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export {
    createAssignment,
    deactivateAssignment,
    getAssignments,
    updateAssignment,
};
