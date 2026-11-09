import mongoose from "mongoose";
import ClassSection from "../models/ClassSection.js";
import Department from "../models/Department.js";
import Program from "../models/Program.js";
import AcademicAssignment from "../models/AcademicAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import Attendance from "../models/Attendance.js";
import Student from "../models/Student.js";
import { isTransactionWriteConflict } from "../utils/studentWriteFence.js";

const isValidObjectId = (value) =>
    typeof value === "string" && mongoose.isValidObjectId(value);

const isValidSemester = (value) => {
    if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
    ) {
        return false;
    }

    const number = Number(value);
    return Number.isInteger(number) && number >= 1;
};

const sendControllerError = (res, error) => {
    if (error.statusCode || isTransactionWriteConflict(error)) {
        const response = { message: error.message };
        if (error.dependencies) response.dependencies = error.dependencies;
        return res.status(error.statusCode || 409).json(response);
    }

    if (
        error.name === "ValidationError" ||
        error.name === "CastError"
    ) {
        return res.status(400).json({
            message: error.message,
        });
    }

    if (error.code === 11000) {
        return res.status(400).json({
            message:
                "This class section already exists for the selected program.",
        });
    }

    console.error("Class section controller error:", error);

    return res.status(500).json({
        message:
            "Something went wrong while processing the class section.",
    });
};

const validateClassRelationships = async ({
    program,
    department,
    session,
}) => {
    if (
        !isValidObjectId(program) ||
        !isValidObjectId(department)
    ) {
        return {
            error: "Please select a valid program and department.",
            status: 400,
        };
    }

    let existingProgram;
    let existingDepartment;
    if (session) {
        existingProgram = await Program.findById(program).session(session);
        existingDepartment = await Department.findById(department).session(session);
    } else {
        [existingProgram, existingDepartment] = await Promise.all([
            Program.findById(program),
            Department.findById(department),
        ]);
    }

    if (!existingProgram) {
        return {
            error: "Program not found.",
            status: 404,
        };

    }

    if (!existingDepartment) {
        return {
            error: "Department not found.",
            status: 404,
        };
    }

    if (
        existingProgram.department.toString() !==
        existingDepartment._id.toString()
    ) {
        return {
            error:
                "The selected program does not belong to the selected department.",
            status: 400,
        };
    }

    return {
        existingProgram,
        existingDepartment,
    };
};

const acquireClassSectionFence = async (id, session) => {
    const snapshot = await ClassSection.findById(id)
        .select("_id __v")
        .session(session);
    if (!snapshot) return null;

    const versionFilter =
        snapshot.__v === undefined
            ? { __v: { $exists: false } }
            : { __v: snapshot.__v };
    const result = await ClassSection.updateOne(
        { _id: snapshot._id, ...versionFilter },
        { $inc: { __v: 1 } },
        { session }
    );
    if (result.matchedCount !== 1) {
        const error = new Error("Class section changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }

    const classSection = await ClassSection.findById(snapshot._id)
        .session(session);
    if (!classSection) {
        const error = new Error("Class section changed during the operation.");
        error.code = "WRITE_FENCE_CONFLICT";
        throw error;
    }
    return classSection;
};

const createClass = async (req, res) => {
    try {
        const {
            name,
            section,
            semester,
            program,
            department,
        } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Class name is required.",
            });
        }

        if (
            typeof section !== "string" ||
            !section.trim()
        ) {
            return res.status(400).json({
                message: "Section is required.",
            });
        }

        if (!isValidSemester(semester)) {
            return res.status(400).json({
                message: "Semester must be a positive whole number.",
            });
        }

        const relationshipValidation =
            await validateClassRelationships({
                program,
                department,
            });

        if (relationshipValidation.error) {
            return res.status(
                relationshipValidation.status
            ).json({
                message: relationshipValidation.error,
            });
        }

        const normalizedName = name.trim();
        const normalizedSection = section.trim();
        const numericSemester = Number(semester);

        const existingClass = await ClassSection.findOne({
            name: normalizedName,
            section: normalizedSection,
            semester: numericSemester,
            program,
        });

        if (existingClass) {
            return res.status(400).json({
                message:
                    "This class section already exists for the selected program.",
            });
        }

        const newClass = new ClassSection({
            name: normalizedName,
            section: normalizedSection,
            semester: numericSemester,
            program,
            department,
        });

        await newClass.save();

        const populatedClass = await ClassSection.findById(
            newClass._id
        )
            .populate("program", "name")
            .populate("department", "name code");

        return res.status(201).json({
            message: "Class section created successfully.",
            class: populatedClass,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const getClasses = async (req, res) => {
    try {
        const {
            program,
            semester,
            department,
        } = req.query;

        const filter = {};

        if (program !== undefined) {
            if (!isValidObjectId(program)) {
                return res.status(400).json({
                    message: "Invalid program filter.",
                });
            }

            filter.program = program;
        }

        if (department !== undefined) {
            if (!isValidObjectId(department)) {
                return res.status(400).json({
                    message: "Invalid department filter.",
                });
            }

            filter.department = department;
        }

        if (semester !== undefined) {
            if (!isValidSemester(semester)) {
                return res.status(400).json({
                    message:
                        "Semester filter must be a positive whole number.",
                });
            }

            filter.semester = Number(semester);
        }

        const classes = await ClassSection.find(filter)
            .populate("program", "name")
            .populate("department", "name code")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Classes accessed successfully.",
            classes,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const getClassById = async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid class section ID.",
        });
    }

    try {
        const aClass = await ClassSection.findById(id)
            .populate("program", "name")
            .populate("department", "name code");

        if (!aClass) {
            return res.status(404).json({
                message: "Class section not found.",
            });
        }

        return res.status(200).json({
            message: "Class accessed successfully.",
            aClass,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const updateClass = async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid class section ID.",
        });
    }

    let transactionSession;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
        const existingClass = await acquireClassSectionFence(
            id,
            transactionSession
        );
        if (!existingClass) {
            throw Object.assign(
                new Error("Class section not found."),
                { statusCode: 404 }
            );
        }

        const {
            name,
            section,
            semester,
            program,
            department,
        } = req.body;

        const finalName =
            name !== undefined
                ? typeof name === "string"
                    ? name.trim()
                    : ""
                : existingClass.name;

        const finalSection =
            section !== undefined
                ? typeof section === "string"
                    ? section.trim()
                    : ""
                : existingClass.section;

        const finalSemester =
            semester !== undefined
                ? Number(semester)
                : existingClass.semester;

        const finalProgram =
            program !== undefined
                ? program
                : existingClass.program.toString();

        const finalDepartment =
            department !== undefined
                ? department
                : existingClass.department.toString();

        if (!finalName) {
            throw Object.assign(new Error("Class name is required."), {
                statusCode: 400,
            });
        }

        if (!finalSection) {
            throw Object.assign(new Error("Section is required."), {
                statusCode: 400,
            });
        }

        if (
            (semester !== undefined &&
                !isValidSemester(semester)) ||
            !isValidSemester(finalSemester)
        ) {
            throw Object.assign(
                new Error("Semester must be a positive whole number."),
                {
                    statusCode: 400,
                }
            );
        }

        const relationshipChanged =
            finalProgram.toString() !==
                existingClass.program.toString() ||
            finalDepartment.toString() !==
                existingClass.department.toString();

        if (relationshipChanged) {
            const hasAttendance = await Attendance.exists({
                classSection: existingClass._id,
            }).session(transactionSession);
            if (hasAttendance) {
                throw Object.assign(
                    new Error(
                        "This class cannot change its program or department because attendance history exists."
                    ),
                    { statusCode: 409 }
                );
            }

            const assignmentCount =
                await AcademicAssignment.countDocuments({
                    classSection: existingClass._id,
                }).session(transactionSession);

            if (assignmentCount > 0) {
                const error = Object.assign(
                    new Error(
                        "This class cannot be moved to another program or department because academic assignments already depend on it."
                    ),
                    { statusCode: 400 }
                );
                error.dependencies = {
                    academicAssignments: assignmentCount,
                };
                throw error;
            }

            const enrollments = await StudentEnrollment.find({
                classSection: existingClass._id,
            })
                .select("student")
                .session(transactionSession);
            let invalidatesEnrollment = false;
            for (const enrollment of enrollments) {
                const enrolledStudent = await Student.findById(
                    enrollment.student
                )
                    .select("program")
                    .session(transactionSession);
                if (
                    !enrolledStudent ||
                    enrolledStudent.program.toString() !==
                        finalProgram.toString()
                ) {
                    invalidatesEnrollment = true;
                    break;
                }
            }
            if (invalidatesEnrollment) {
                throw Object.assign(
                    new Error(
                        "This class change would invalidate existing enrollment relationships."
                    ),
                    { statusCode: 409 }
                );
            }
        }

        const relationshipValidation =
            await validateClassRelationships({
                program: finalProgram,
                department: finalDepartment,
                session: transactionSession,
            });

        if (relationshipValidation.error) {
            throw Object.assign(
                new Error(relationshipValidation.error),
                { statusCode: relationshipValidation.status }
            );
        }

        const duplicateClass = await ClassSection.findOne({
            _id: { $ne: existingClass._id },
            name: finalName,
            section: finalSection,
            semester: Number(finalSemester),
            program: finalProgram,
        }).session(transactionSession);

        if (duplicateClass) {
            throw Object.assign(
                new Error(
                    "This class section already exists for the selected program."
                ),
                { statusCode: 400 }
            );
        }

        existingClass.name = finalName;
        existingClass.section = finalSection;
        existingClass.semester = Number(finalSemester);
        existingClass.program = finalProgram;
        existingClass.department = finalDepartment;

        await existingClass.save({ session: transactionSession });
        });

        const populatedClass = await ClassSection.findById(id)
            .populate("program", "name")
            .populate("department", "name code");

        return res.status(200).json({
            message: "Class updated successfully.",
            class: populatedClass,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

const deleteClass = async (req, res) => {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid class section ID.",
        });
    }

    let transactionSession;
    let deletedClass;
    try {
        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            deletedClass = await acquireClassSectionFence(
                id,
                transactionSession
            );
            if (!deletedClass) {
                throw Object.assign(
                    new Error("Class section not found."),
                    { statusCode: 404 }
                );
            }

            const assignmentCount =
                await AcademicAssignment.countDocuments({
                    classSection: deletedClass._id,
                }).session(transactionSession);
            if (assignmentCount > 0) {
                const error = Object.assign(
                    new Error(
                        "This class cannot be deleted because academic assignments depend on it."
                    ),
                    { statusCode: 400 }
                );
                error.dependencies = {
                    academicAssignments: assignmentCount,
                };
                throw error;
            }

            const hasEnrollment = await StudentEnrollment.exists({
                classSection: deletedClass._id,
            }).session(transactionSession);
            if (hasEnrollment) {
                throw Object.assign(
                    new Error(
                        "This class cannot be deleted because enrollment history references it."
                    ),
                    { statusCode: 409 }
                );
            }

            const hasAttendance = await Attendance.exists({
                classSection: deletedClass._id,
            }).session(transactionSession);
            if (hasAttendance) {
                throw Object.assign(
                    new Error(
                        "This class cannot be deleted because attendance history exists."
                    ),
                    { statusCode: 409 }
                );
            }

            const deletion = await ClassSection.deleteOne(
                { _id: deletedClass._id, __v: deletedClass.__v },
                { session: transactionSession }
            );
            if (deletion.deletedCount !== 1) {
                throw Object.assign(
                    new Error("Class section changed during the operation."),
                    { statusCode: 409 }
                );
            }
        });

        return res.status(200).json({
            message: "Class section deleted successfully.",
            class: deletedClass,
        });
    } catch (error) {
        return sendControllerError(res, error);
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

export {
    createClass,
    getClasses,
    getClassById,
    updateClass,
    deleteClass,
};
