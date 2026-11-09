
import mongoose from "mongoose";
import Program from "../models/Program.js";
import Department from "../models/Department.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import ClassSection from "../models/ClassSection.js";

const isValidWholeNumber = (value, minimum = 0) => {
    if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
    ) {
        return false;
    }

    const number = Number(value);

    return Number.isInteger(number) && number >= minimum;
};

const sendControllerError = (res, error) => {
    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({
            message: error.message,
        });
    }

    if (error.code === 11000) {
        return res.status(400).json({
            message:
                "A program with this name already exists in this department.",
        });
    }

    console.error("Program controller error:", error);

    return res.status(500).json({
        message: "Something went wrong while processing the program.",
    });
};

const createProgram = async (req, res) => {
    try {
        const {
            name,
            duration,
            totalSeats,
            availableSeats,
            department,
        } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                message: "Program name is required.",
            });
        }

        if (
            !isValidWholeNumber(duration, 1) ||
            !isValidWholeNumber(totalSeats) ||
            !isValidWholeNumber(availableSeats)
        ) {
            return res.status(400).json({
                message:
                    "Duration must be a positive whole number, and seat counts must be non-negative whole numbers.",
            });
        }

        const numericDuration = Number(duration);
        const numericTotalSeats = Number(totalSeats);
        const numericAvailableSeats = Number(availableSeats);

        if (numericAvailableSeats > numericTotalSeats) {
            return res.status(400).json({
                message: "Available seats cannot exceed total seats.",
            });
        }

        if (
            typeof department !== "string" ||
            !mongoose.isValidObjectId(department)
        ) {
            return res.status(400).json({
                message: "A valid department must be selected.",
            });
        }

        const existingDepartment = await Department.findById(department);

        if (!existingDepartment) {
            return res.status(404).json({
                message: "Department not found.",
            });
        }

        const normalizedName = name.trim();

        const existingProgram = await Program.findOne({
            name: normalizedName,
            department,
        });

        if (existingProgram) {
            return res.status(400).json({
                message:
                    "A program with this name already exists in this department.",
            });
        }

        const newProgram = new Program({
            name: normalizedName,
            duration: numericDuration,
            totalSeats: numericTotalSeats,
            availableSeats: numericAvailableSeats,
            department,
        });

        await newProgram.save();

        return res.status(201).json({
            message: "Program created successfully.",
            program: newProgram,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const getPrograms = async (req, res) => {
    try {
        const programs = await Program.find()
            .populate("department", "name code")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Programs accessed successfully.",
            programs,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const getProgramById = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid program ID.",
        });
    }

    try {
        const program = await Program.findById(id)
            .populate("department", "name code");

        if (!program) {
            return res.status(404).json({
                message: "Program does not exist.",
            });
        }

        return res.status(200).json({
            message: "Program accessed successfully.",
            program,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const updateProgram = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid program ID.",
        });
    }

    try {
        const existingProgram = await Program.findById(id);

        if (!existingProgram) {
            return res.status(404).json({
                message: "Program does not exist.",
            });
        }

        const {
            name,
            duration,
            totalSeats,
            availableSeats,
            department,
        } = req.body;

        // Calculate final values before validating, so partial updates
        // are checked against the program's existing values.
        const finalName =
            name !== undefined
                ? typeof name === "string"
                    ? name.trim()
                    : ""
                : existingProgram.name;

        const finalDuration =
            duration !== undefined
                ? Number(duration)
                : existingProgram.duration;

        const finalTotalSeats =
            totalSeats !== undefined
                ? Number(totalSeats)
                : existingProgram.totalSeats;

        const finalAvailableSeats =
            availableSeats !== undefined
                ? Number(availableSeats)
                : existingProgram.availableSeats;

        const finalDepartment =
            department !== undefined
                ? department
                : existingProgram.department.toString();

        if (!finalName) {
            return res.status(400).json({
                message: "Program name is required.",
            });
        }

        if (
            (duration !== undefined &&
                !isValidWholeNumber(duration, 1)) ||
            !isValidWholeNumber(finalDuration, 1)
        ) {
            return res.status(400).json({
                message: "Program duration must be a positive whole number.",
            });
        }

        if (
            (totalSeats !== undefined &&
                !isValidWholeNumber(totalSeats)) ||
            (availableSeats !== undefined &&
                !isValidWholeNumber(availableSeats)) ||
            !isValidWholeNumber(finalTotalSeats) ||
            !isValidWholeNumber(finalAvailableSeats)
        ) {
            return res.status(400).json({
                message: "Seat counts must be non-negative whole numbers.",
            });
        }

        if (finalAvailableSeats > finalTotalSeats) {
            return res.status(400).json({
                message: "Available seats cannot exceed total seats.",
            });
        }

        if (
            typeof finalDepartment !== "string" ||
            !mongoose.isValidObjectId(finalDepartment)
        ) {
            return res.status(400).json({
                message: "A valid department must be selected.",
            });
        }

        const departmentChanged =
            finalDepartment.toString() !==
            existingProgram.department.toString();

        // Prevent moving a program if other records depend on it.
        if (departmentChanged) {
            const [studentCount, subjectCount, classCount] =
                await Promise.all([
                    Student.countDocuments({
                        program: existingProgram._id,
                    }),
                    Subject.countDocuments({
                        program: existingProgram._id,
                    }),
                    ClassSection.countDocuments({
                        program: existingProgram._id,
                    }),
                ]);

            if (
                studentCount > 0 ||
                subjectCount > 0 ||
                classCount > 0
            ) {
                return res.status(400).json({
                    message:
                        "This program cannot be moved to another department because it has dependent students, subjects, or classes.",
                    dependencies: {
                        students: studentCount,
                        subjects: subjectCount,
                        classes: classCount,
                    },
                });
            }
        }

        const existingDepartment = await Department.findById(
            finalDepartment
        );

        if (!existingDepartment) {
            return res.status(404).json({
                message: "Department not found.",
            });
        }

        const duplicateProgram = await Program.findOne({
            _id: { $ne: existingProgram._id },
            name: finalName,
            department: finalDepartment,
        });

        if (duplicateProgram) {
            return res.status(400).json({
                message:
                    "A program with this name already exists in this department.",
            });
        }

        existingProgram.name = finalName;
        existingProgram.duration = finalDuration;
        existingProgram.totalSeats = finalTotalSeats;
        existingProgram.availableSeats = finalAvailableSeats;
        existingProgram.department = finalDepartment;

        await existingProgram.save();

        return res.status(200).json({
            message: "Program updated successfully.",
            program: existingProgram,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

const deleteProgram = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid program ID.",
        });
    }

    try {
        const program = await Program.findById(id);

        if (!program) {
            return res.status(404).json({
                message: "Program does not exist.",
            });
        }

        const [studentCount, subjectCount, classCount] =
            await Promise.all([
                Student.countDocuments({ program: id }),
                Subject.countDocuments({ program: id }),
                ClassSection.countDocuments({ program: id }),
            ]);

        if (studentCount > 0 || subjectCount > 0 || classCount > 0) {
            return res.status(400).json({
                message:
                    "This program cannot be deleted because it has dependent students, subjects, or classes.",
                dependencies: {
                    students: studentCount,
                    subjects: subjectCount,
                    classes: classCount,
                },
            });
        }

        await Program.findByIdAndDelete(id);

        return res.status(200).json({
            message: "Program deleted successfully.",
            program,
        });
    } catch (error) {
        return sendControllerError(res, error);
    }
};

export {
    createProgram,
    getPrograms,
    getProgramById,
    updateProgram,
    deleteProgram,
};