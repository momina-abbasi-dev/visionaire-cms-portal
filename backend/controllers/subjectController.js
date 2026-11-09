import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import Program from "../models/Program.js";
import Department from "../models/Department.js";
import AcademicAssignment from "../models/AcademicAssignment.js";

const isValidId = (id) =>
    typeof id === "string" &&
    mongoose.isValidObjectId(id);

const handleError = (res, error) => {
    if (error.code === 11000) {
        return res.status(400).json({
            message: "A subject with this code already exists",
        });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: error.message,
        });
    }

    console.error("Subject controller error:", error);

    return res.status(500).json({
        message: "An unexpected server error occurred",
    });
};

const validateSubjectFields = ({
    name,
    code,
    creditHours,
    program,
    department,
}) => {
    if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof code !== "string" ||
        !code.trim()
    ) {
        return "Subject name and code are required";
    }

    if (
        creditHours === undefined ||
        creditHours === null ||
        creditHours === "" ||
        !Number.isInteger(Number(creditHours)) ||
        Number(creditHours) < 1 ||
        Number(creditHours) > 6
    ) {
        return "Credit hours must be an integer between 1 and 6";
    }

    if (!isValidId(program) || !isValidId(department)) {
        return "A valid program and department are required";
    }

    return null;
};

const validateProgramDepartment = async (programId, departmentId) => {
    const existingProgram = await Program.findById(programId);

    if (!existingProgram) {
        return {
            status: 404,
            message: "Program not found",
        };
    }

    const existingDepartment = await Department.findById(departmentId);

    if (!existingDepartment) {
        return {
            status: 404,
            message: "Department not found",
        };
    }

    if (
        existingProgram.department.toString() !==
        departmentId.toString()
    ) {
        return {
            status: 400,
            message:
                "The selected program does not belong to the selected department",
        };
    }

    return null;
};

// Create subject
const createSubject = async (req, res) => {
    try {
        const {
            name,
            code,
            creditHours,
            program,
            department,
        } = req.body;

        const validationError = validateSubjectFields({
            name,
            code,
            creditHours,
            program,
            department,
        });

        if (validationError) {
            return res.status(400).json({
                message: validationError,
            });
        }

        const normalizedCode = code.trim().toUpperCase();

        const relationshipError = await validateProgramDepartment(
            program,
            department
        );

        if (relationshipError) {
            return res.status(relationshipError.status).json({
                message: relationshipError.message,
            });
        }

        const subject = await Subject.create({
            name: name.trim(),
            code: normalizedCode,
            creditHours: Number(creditHours),
            program,
            department,
        });

        return res.status(201).json({
            message: "Subject created successfully",
            subject,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// Get all subjects
const getSubjects = async (req, res) => {
    try {
        const subjects = await Subject.find()
            .populate("program", "name duration")
            .populate("department", "name code")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Subjects accessed successfully",
            subjects,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// Get subject by ID
const getSubjectById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: "Invalid subject ID",
            });
        }

        const subject = await Subject.findById(id)
            .populate("program", "name duration")
            .populate("department", "name code");

        if (!subject) {
            return res.status(404).json({
                message: "Subject not found",
            });
        }

        return res.status(200).json({
            message: "Subject accessed successfully",
            subject,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// Update subject
const updateSubject = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: "Invalid subject ID",
            });
        }

        const existingSubject = await Subject.findById(id);

        if (!existingSubject) {
            return res.status(404).json({
                message: "Subject not found",
            });
        }

        const {
            name,
            code,
            creditHours,
            program,
            department,
        } = req.body;

        // Validate only fields supplied by the client.
        if (
            name !== undefined &&
            (typeof name !== "string" || !name.trim())
        ) {
            return res.status(400).json({
                message: "Subject name cannot be empty",
            });
        }

        if (
            code !== undefined &&
            (typeof code !== "string" || !code.trim())
        ) {
            return res.status(400).json({
                message: "Subject code cannot be empty",
            });
        }

        if (
            creditHours !== undefined &&
            (
                creditHours === null ||
                creditHours === "" ||
                !Number.isInteger(Number(creditHours)) ||
                Number(creditHours) < 1 ||
                Number(creditHours) > 6
            )
        ) {
            return res.status(400).json({
                message: "Credit hours must be an integer between 1 and 6",
            });
        }

        if (
            program !== undefined &&
            !isValidId(program)
        ) {
            return res.status(400).json({
                message: "Invalid program ID",
            });
        }

        if (
            department !== undefined &&
            !isValidId(department)
        ) {
            return res.status(400).json({
                message: "Invalid department ID",
            });
        }

        const finalProgram =
            program ?? existingSubject.program.toString();

        const finalDepartment =
            department ?? existingSubject.department.toString();

        const finalCode =
            code !== undefined
                ? code.trim().toUpperCase()
                : existingSubject.code;

        const relationshipChanged =
            finalProgram.toString() !==
                existingSubject.program.toString() ||
            finalDepartment.toString() !==
                existingSubject.department.toString();

        // Preserve assignments: don't move a subject after it is assigned.
        if (relationshipChanged) {
            const assignmentExists =
                await AcademicAssignment.exists({
                    subject: existingSubject._id,
                });

            if (assignmentExists) {
                return res.status(400).json({
                    message:
                        "This subject cannot be moved to another program or department because academic assignments already depend on it.",
                });
            }
        }

        const relationshipError = await validateProgramDepartment(
            finalProgram,
            finalDepartment
        );

        if (relationshipError) {
            return res.status(relationshipError.status).json({
                message: relationshipError.message,
            });
        }

        const duplicateCode = await Subject.exists({
            _id: { $ne: existingSubject._id },
            code: finalCode,
        });

        if (duplicateCode) {
            return res.status(400).json({
                message: "A subject with this code already exists",
            });
        }

        if (name !== undefined) {
            existingSubject.name = name.trim();
        }

        existingSubject.code = finalCode;

        if (creditHours !== undefined) {
            existingSubject.creditHours = Number(creditHours);
        }

        existingSubject.program = finalProgram;
        existingSubject.department = finalDepartment;

        await existingSubject.save();

        return res.status(200).json({
            message: "Subject updated successfully",
            subject: existingSubject,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

// Delete subject
const deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: "Invalid subject ID",
            });
        }

        const subject = await Subject.findById(id);

        if (!subject) {
            return res.status(404).json({
                message: "Subject not found",
            });
        }

        const assignmentExists =
            await AcademicAssignment.exists({
                subject: subject._id,
            });

        if (assignmentExists) {
            return res.status(400).json({
                message:
                    "This subject cannot be deleted because academic assignments depend on it.",
            });
        }

        await Subject.findByIdAndDelete(subject._id);

        return res.status(200).json({
            message: "Subject deleted successfully",
            subject,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export {
    createSubject,
    getSubjects,
    getSubjectById,
    updateSubject,
    deleteSubject,
};