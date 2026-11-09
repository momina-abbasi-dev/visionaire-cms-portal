import mongoose from "mongoose";
import User from "../models/User.js";
import Program from "../models/Program.js";
import Student from "../models/Student.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import AcademicRecord from "../models/AcademicRecord.js";
import Attendance from "../models/Attendance.js";
import Result from "../models/Result.js";
import FeeRecord from "../models/FeesFinance.js";
import {
    acquireStudentWriteFence,
    isTransactionWriteConflict,
} from "../utils/studentWriteFence.js";

const createHttpError = (message, statusCode) =>
    Object.assign(new Error(message), { statusCode });


// ─── Create Student ──────────────────────────────────────────────────────────

const createStudent = async (req, res) => {
    const {
        name,
        rollNo,
        email,
        cnic,
        dob,
        contact,
        address,
        city,
        image,
        program,
        dateOfAdmission,
        previousAcademicDocument,
        documentsVerified,
        status,
        password,
    } = req.body;

    let transactionSession;
    let newStudent;
    let newUser;
    try {
        // ── Validate required account information ─────────────────────────

        if (!password) {
            return res.status(400).json({
                message: "Student account password is required.",
            });
        }

        transactionSession = await mongoose.startSession();
        await transactionSession.withTransaction(async () => {
            // ── Check duplicate Student identity ──────────────────────────

            const existingStudent = await Student.findOne({
                $or: [{ email }, { rollNo }, { cnic }],
            }).session(transactionSession);

            if (existingStudent) {
                throw createHttpError(
                    "Student with this email, rollNo or CNIC already exists.",
                    400
                );
            }

            // ── Check duplicate User identity ─────────────────────────────

            const existingUser = await User.findOne({
                $or: [{ email }, { cnic }],
            }).session(transactionSession);

            if (existingUser) {
                throw createHttpError(
                    "A user with this email or CNIC already exists.",
                    400
                );
            }

            // ── Validate Program capacity within the transaction ─────────

            const existingProgram = await Program.findById(program)
                .session(transactionSession);

            if (!existingProgram) {
                throw createHttpError("Program not found.", 404);
            }

            if (existingProgram.availableSeats <= 0) {
                throw createHttpError(
                    "No seats available in this program.",
                    400
                );
            }

            // ── Create Student profile ────────────────────────────────────

            newStudent = new Student({
                name,
                rollNo,
                email,
                cnic,
                dob,
                contact,
                address,
                city,
                image,
                program,
                dateOfAdmission,
                previousAcademicDocument,
                documentsVerified,
                status,
                createdBy: req.user.id,
            });

            await newStudent.save({ session: transactionSession });

            // ── Create linked User account ────────────────────────────────

            newUser = new User({
                name: newStudent.name,
                email: newStudent.email,
                cnic: newStudent.cnic,
                password,
                role: "student",
                studentId: newStudent._id,
            });

            await newUser.save({ session: transactionSession });

            // ── Atomically reserve a Program seat ────────────────────────

            const seatReservation = await Program.updateOne(
                {
                    _id: existingProgram._id,
                    availableSeats: { $gt: 0 },
                },
                { $inc: { availableSeats: -1 } },
                { session: transactionSession }
            );
            if (seatReservation.matchedCount !== 1) {
                throw createHttpError(
                    "No seats available in this program.",
                    400
                );
            }
        });

        // ── Return created resources ──────────────────────────────────────

        const createdStudent = await Student.findById(newStudent._id)
            .session(transactionSession)
            .populate({
                path: "program",
                populate: {
                    path: "department",
                    select: "name code",
                },
            });

        const createdUser = await User.findById(newUser._id)
            .session(transactionSession)
            .select("-password")
            .populate("studentId", "name rollNo");

        return res.status(201).json({
            message: "Student created successfully.",
            student: createdStudent,
            user: createdUser,
        });
    } catch (error) {
        console.error("Create student error:", error);

        const statusCode =
            error.statusCode ||
            (error.code === 11000 ? 400 : 500);
        const message =
            error.code === 11000
                ? "Student with this email, rollNo or CNIC already exists."
                : error.message;
        return res.status(statusCode).json({
            message,
        });
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};


// ─── Get Students ────────────────────────────────────────────────────────────

const getStudents = async (req, res) => {
    try {
        const {
            search,
            status,
            program,
            feeStatus,
            page = 1,
            limit = 10,
        } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                {
                    name: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    rollNo: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    email: {
                        $regex: search,
                        $options: "i",
                    },
                },
                {
                    cnic: {
                        $regex: search,
                        $options: "i",
                    },
                },
            ];
        }

        if (status && status !== "All") {
            query.status = status;
        }

        if (feeStatus && feeStatus !== "All") {
            query.feeStatus = feeStatus;
        }

        if (program && program !== "All") {
            query.program = program;
        }

        const skip = (page - 1) * limit;

        const students = await Student.find(query)
            .populate({
                path: "program",
                populate: {
                    path: "department",
                    select: "name code",
                },
            })
            .skip(Number(skip))
            .limit(Number(limit))
            .sort({
                createdAt: -1,
            });

        const total = await Student.countDocuments(query);

        res.status(200).json({
            students,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Get students error:", error);

        res.status(500).json({
            message: error.message,
        });
    }
};


// ─── Get Student By ID ───────────────────────────────────────────────────────

const getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate({
                path: "program",
                populate: {
                    path: "department",
                    select: "name code",
                },
            });

        if (!student) {
            return res.status(404).json({
                message: "Student not found.",
            });
        }

        res.status(200).json({
            message: "Student accessed successfully.",
            student,
        });
    } catch (error) {
        console.error("Get student error:", error);

        res.status(500).json({
            message: error.message,
        });
    }
};


// ─── Update Student ──────────────────────────────────────────────────────────

const updateStudent = async (req, res) => {
    const { id } = req.params;
    let session;
    let linkedUser;

    try {
        let student = await Student.findById(id);

        if (!student) {
            return res.status(404).json({
                message: "Student not found.",
            });
        }

        const {
            name,
            rollNo,
            email,
            cnic,
            dob,
            contact,
            address,
            city,
            image,
            program: newProgramId,
            dateOfAdmission,
            previousAcademicDocument,
            documentsVerified,
            status,
            feeStatus,
        } = req.body;


        // ── Find linked User account ──────────────────────────────────────

        linkedUser = await User.findOne({
            studentId: student._id,
        });


        // ── Check duplicate Student identity ──────────────────────────────

        const identityChanged =
            email !== undefined ||
            cnic !== undefined ||
            rollNo !== undefined;

        if (identityChanged) {
            const duplicateStudentConditions = [];

            if (email !== undefined) {
                duplicateStudentConditions.push({
                    email,
                });
            }

            if (cnic !== undefined) {
                duplicateStudentConditions.push({
                    cnic,
                });
            }

            if (rollNo !== undefined) {
                duplicateStudentConditions.push({
                    rollNo,
                });
            }

            if (duplicateStudentConditions.length > 0) {
                const duplicateStudent = await Student.findOne({
                    _id: {
                        $ne: id,
                    },
                    $or: duplicateStudentConditions,
                });

                if (duplicateStudent) {
                    return res.status(400).json({
                        message:
                            "Another student already uses this email, rollNo or CNIC.",
                    });
                }
            }
        }


        // ── Check duplicate User identity ─────────────────────────────────

        if (linkedUser) {
            const duplicateUserConditions = [];

            if (email !== undefined) {
                duplicateUserConditions.push({
                    email,
                });
            }

            if (cnic !== undefined) {
                duplicateUserConditions.push({
                    cnic,
                });
            }

            if (duplicateUserConditions.length > 0) {
                const duplicateUser = await User.findOne({
                    _id: {
                        $ne: linkedUser._id,
                    },
                    $or: duplicateUserConditions,
                });

                if (duplicateUser) {
                    return res.status(400).json({
                        message:
                            "Another user already uses this email or CNIC.",
                    });
                }
            }
        }


        let oldProgram = null;
        let newProgram = null;
        let programChanged = false;

        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            student = await acquireStudentWriteFence(id, session);
            if (!student) {
                throw createHttpError("Student not found.", 404);
            }

            const oldProgramId = student.program;
            programChanged =
                Boolean(newProgramId) &&
                student.program.toString() !== newProgramId.toString();

            linkedUser = await User.findOne({
                studentId: student._id,
            }).session(session);

            if (programChanged) {
                const hasEnrollment = await StudentEnrollment.exists({
                    student: student._id,
                }).session(session);

                if (hasEnrollment) {
                    throw createHttpError(
                        "A student with enrollment history cannot change programs outside the transfer workflow.",
                        409
                    );
                }

                oldProgram = await Program.findById(oldProgramId).session(session);
                if (!oldProgram) {
                    throw createHttpError(
                        "Previous program not found; the program change was not completed.",
                        409
                    );
                }

                newProgram = await Program.findById(newProgramId).session(session);

                if (!newProgram) {
                    throw createHttpError("New program not found.", 404);
                }
                if (
                    !Number.isInteger(newProgram.availableSeats) ||
                    !Number.isInteger(newProgram.totalSeats) ||
                    newProgram.availableSeats <= 0 ||
                    newProgram.availableSeats > newProgram.totalSeats
                ) {
                    throw createHttpError(
                        "No seats available in the new program.",
                        400
                    );
                }
            }

        if (name !== undefined) {
            student.name = name;
        }

        if (rollNo !== undefined) {
            student.rollNo = rollNo;
        }

        if (email !== undefined) {
            student.email = email;
        }

        if (cnic !== undefined) {
            student.cnic = cnic;
        }

        if (dob !== undefined) {
            student.dob = dob;
        }

        if (contact !== undefined) {
            student.contact = contact;
        }

        if (address !== undefined) {
            student.address = address;
        }

        if (city !== undefined) {
            student.city = city;
        }

        if (image !== undefined) {
            student.image = image;
        }

        if (newProgramId !== undefined) {
            student.program = newProgramId;
        }

        if (dateOfAdmission !== undefined) {
            student.dateOfAdmission = dateOfAdmission;
        }

        if (previousAcademicDocument !== undefined) {
            student.previousAcademicDocument =
                previousAcademicDocument;
        }

        if (documentsVerified !== undefined) {
            student.documentsVerified =
                documentsVerified;
        }

        if (status !== undefined) {
            student.status = status;
        }

        /*
         * NOTE:
         *
         * feeStatus remains supported here for compatibility
         * with the existing Student Management workflow.
         *
         * We will address Finance ↔ Student fee ownership
         * separately after this identity workflow is complete.
         */
        if (feeStatus !== undefined) {
            student.feeStatus = feeStatus;
        }

        await student.save({ session });


        /*
         * ─────────────────────────────────────────────────────────────
         * Synchronize linked User
         * ─────────────────────────────────────────────────────────────
         *
         * Student Management owns the Student identity.
         *
         * Therefore these fields are mirrored into User:
         *
         * Student.name  → User.name
         * Student.email → User.email
         * Student.cnic  → User.cnic
         */

        if (linkedUser) {
            if (name !== undefined) {
                linkedUser.name = name;
            }

            if (email !== undefined) {
                linkedUser.email = email;
            }

            if (cnic !== undefined) {
                linkedUser.cnic = cnic;
            }

            await linkedUser.save({ session });
        }


        /*
         * ─────────────────────────────────────────────────────────────
         * Update Program Seats
         * ─────────────────────────────────────────────────────────────
         */

        if (programChanged) {
            const reservedSeat = await Program.updateOne(
                {
                    _id: newProgram._id,
                    availableSeats: { $gt: 0 },
                },
                { $inc: { availableSeats: -1 } },
                { session }
            );
            if (reservedSeat.matchedCount !== 1) {
                throw createHttpError(
                    "No seats available in the new program.",
                    409
                );
            }

            if (
                !Number.isInteger(oldProgram.availableSeats) ||
                !Number.isInteger(oldProgram.totalSeats) ||
                oldProgram.availableSeats >= oldProgram.totalSeats
            ) {
                throw createHttpError(
                    "The previous program has no available seat capacity to restore.",
                    409
                );
            }

            const releasedSeat = await Program.updateOne(
                {
                    _id: oldProgram._id,
                    availableSeats: oldProgram.availableSeats,
                },
                { $inc: { availableSeats: 1 } },
                { session }
            );
            if (releasedSeat.matchedCount !== 1) {
                throw createHttpError(
                    "Program seat counts changed during the operation.",
                    409
                );
            }
        }
        });


        /*
         * ─────────────────────────────────────────────────────────────
         * Return updated Student
         * ─────────────────────────────────────────────────────────────
         */

        const updatedStudent = await Student.findById(id)
            .populate({
                path: "program",
                populate: {
                    path: "department",
                    select: "name code",
                },
            });

        const updatedUser = linkedUser
            ? await User.findById(linkedUser._id)
                  .select("-password")
                  .populate(
                      "studentId",
                      "name rollNo"
                  )
            : null;

        return res.status(200).json({
            message:
                "Student and linked user account updated successfully.",
            student: updatedStudent,
            user: updatedUser,
        });
    } catch (error) {
        console.error("Update student error:", error);

        /*
         * At this stage the normal operation should already have
         * been validated before persistence.
         *
         * Mongoose validation/unique-index errors are surfaced
         * directly to the frontend.
         */

        const statusCode =
            error.statusCode || (isTransactionWriteConflict(error) ? 409 : 500);
        return res.status(statusCode).json({ message: error.message });
    } finally {
        if (session) await session.endSession();
    }
};


// ─── Delete Student ──────────────────────────────────────────────────────────

const deleteStudent = async (req, res) => {
    let session;
    let linkedUserFound = false;

    try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
        const student = await acquireStudentWriteFence(
            req.params.id,
            session
        );
        if (!student) {
            throw createHttpError("Student not found.", 404);
        }

        for (const HistoryModel of [
            StudentEnrollment,
            AcademicRecord,
            Attendance,
            Result,
            FeeRecord,
        ]) {
            const historyExists = await HistoryModel.exists({
                student: student._id,
            }).session(session);
            if (historyExists) {
                throw createHttpError(
                    "Student cannot be deleted because enrollment or academic history exists.",
                    409
                );
            }
        }

        // ── Find linked User account ──────────────────────────────────────

        const linkedUser = await User.findOne({
            studentId: student._id,
        }).session(session);
        linkedUserFound = Boolean(linkedUser);

        // ── Find student's Program ────────────────────────────────────────

        // ── Restore Program seat ──────────────────────────────────────────

        const program = await Program.findById(student.program)
            .select("availableSeats totalSeats")
            .session(session);
        if (!program) {
            throw createHttpError(
                "Student program not found; deletion was not completed.",
                409
            );
        }
        if (
            !Number.isInteger(program.availableSeats) ||
            !Number.isInteger(program.totalSeats) ||
            program.availableSeats >= program.totalSeats
        ) {
            throw createHttpError(
                "Program seat counts cannot be restored safely.",
                409
            );
        }

        const releasedSeat = await Program.updateOne(
            {
                _id: program._id,
                availableSeats: program.availableSeats,
            },
            { $inc: { availableSeats: 1 } },
            { session }
        );
        if (releasedSeat.matchedCount !== 1) {
            throw createHttpError(
                "Program seat counts changed during the operation.",
                409
            );
        }

        /*
         * Delete only after the history and seat checks have passed.
         * The transaction still rolls back all changes if either deletion fails.
         */
        const deletion = await Student.deleteOne(
            { _id: student._id, __v: student.__v },
            { session }
        );
        if (deletion.deletedCount !== 1) {
            throw createHttpError(
                "Student changed during the operation.",
                409
            );
        }

        if (linkedUser) {
            const userDeletion = await User.deleteOne(
                {
                    _id: linkedUser._id,
                    studentId: student._id,
                },
                { session }
            );
            if (userDeletion.deletedCount !== 1) {
                throw createHttpError(
                    "Linked user changed during the operation.",
                    409
                );
            }
        }

        });
        return res.status(200).json({
            message: linkedUserFound
                ? "Student and linked user account deleted successfully."
                : "Student deleted successfully. No linked user account was found.",
        });
    } catch (error) {
        console.error("Delete student error:", error);
        const statusCode =
            error.statusCode || (isTransactionWriteConflict(error) ? 409 : 500);
        return res.status(statusCode).json({ message: error.message });
    } finally {
        if (session) await session.endSession();
    }
};


// ─── Student Statistics ──────────────────────────────────────────────────────

const getStudentStats = async (req, res) => {
    try {
        const [
            totalStudents,
            activeStudents,
            suspendedStudents,
            newAdmissions,
            pendingDocuments,
            feeDefaulters,
        ] = await Promise.all([
            Student.countDocuments(),

            Student.countDocuments({
                status: "active",
            }),

            Student.countDocuments({
                status: "suspended",
            }),

            Student.countDocuments({
                createdAt: {
                    $gte: new Date(
                        new Date().setMonth(
                            new Date().getMonth() - 1
                        )
                    ),
                },
            }),

            Student.countDocuments({
                documentsVerified: false,
            }),

            Student.countDocuments({
                feeStatus: "pending",
            }),
        ]);

        res.status(200).json({
            totalStudents,
            activeStudents,
            suspendedStudents,
            newAdmissions,
            pendingDocuments,
            feeDefaulters,
        });
    } catch (error) {
        console.error(
            "Get student stats error:",
            error
        );

        res.status(500).json({
            message: error.message,
        });
    }
};


export {
    createStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    getStudentStats,
};