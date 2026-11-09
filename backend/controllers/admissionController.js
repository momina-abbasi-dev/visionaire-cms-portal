import mongoose from "mongoose";
import { randomBytes } from "crypto";

import Admission from "../models/Admission.js";
import Program from "../models/Program.js";
import Department from "../models/Department.js";
import Student from "../models/Student.js";
import User from "../models/User.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createApplicationId = () =>
    `ADM-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

const createRollNo = () =>
    `STU-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;

const isValidObjectId = (id) =>
    mongoose.Types.ObjectId.isValid(id);

// ─── Statistics ──────────────────────────────────────────────────────────────

const getAdmissionStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfNextYear = new Date(now.getFullYear() + 1, 0, 1);

        const [
            totalApplications,
            pendingReview,
            approved,
            rejected,
            missingDocuments,
            admissionsThisYear,
        ] = await Promise.all([
            Admission.countDocuments(),

            Admission.countDocuments({
                status: "pending",
            }),

            Admission.countDocuments({
                status: "approved",
            }),

            Admission.countDocuments({
                status: "rejected",
            }),

            Admission.countDocuments({
                $or: [
                    { documents: { $exists: false } },
                    { documents: { $size: 0 } },
                ],
            }),

            Admission.countDocuments({
                status: "approved",
                reviewedAt: {
                    $gte: startOfYear,
                    $lt: startOfNextYear,
                },
            }),
        ]);

        return res.status(200).json({
            totalApplications,
            pendingReview,
            approved,
            rejected,
            missingDocuments,
            admissionsThisYear,
        });
    } catch (error) {
        console.error("Get admission stats error:", error);

        return res.status(500).json({
            message: "Failed to load admission statistics.",
        });
    }
};

// ─── Submit Application ──────────────────────────────────────────────────────

const applyAdmission = async (req, res) => {
    try {
        const {
            name,
            email,
            cnic,
            contact,
            dob,
            address,
            city,
            previousEducation,
            program,
            department,
            documents = [],
        } = req.body;

        if (
            !name?.trim() ||
            !email?.trim() ||
            !cnic?.trim() ||
            !contact?.trim() ||
            !dob ||
            !address?.trim() ||
            !city?.trim() ||
            !previousEducation?.trim() ||
            !program ||
            !department
        ) {
            return res.status(400).json({
                message: "Please provide all required application fields.",
            });
        }

        if (!isValidObjectId(program) || !isValidObjectId(department)) {
            return res.status(400).json({
                message: "Invalid department or program.",
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedCnic = cnic.trim();

        const parsedDob = new Date(dob);

        if (Number.isNaN(parsedDob.getTime()) || parsedDob >= new Date()) {
            return res.status(400).json({
                message: "Please provide a valid date of birth.",
            });
        }

        if (!Array.isArray(documents)) {
            return res.status(400).json({
                message: "Documents must be provided as a list.",
            });
        }

        const [existingAdmission, existingStudent, existingUser] =
            await Promise.all([
                Admission.findOne({
                    $or: [
                        { email: normalizedEmail },
                        { cnic: normalizedCnic },
                    ],
                }),

                Student.findOne({
                    $or: [
                        { email: normalizedEmail },
                        { cnic: normalizedCnic },
                    ],
                }),

                User.findOne({
                    $or: [
                        { email: normalizedEmail },
                        { cnic: normalizedCnic },
                    ],
                }),
            ]);

        if (existingAdmission) {
            return res.status(409).json({
                message:
                    "An application already exists with this email or CNIC. Rejected applications cannot be resubmitted under the current admission rules.",
            });
        }

        if (existingStudent || existingUser) {
            return res.status(409).json({
                message:
                    "A student or user account already exists with this email or CNIC.",
            });
        }

        const [programDoc, departmentDoc] = await Promise.all([
            Program.findById(program),
            Department.findById(department),
        ]);

        if (!programDoc) {
            return res.status(404).json({
                message: "Program not found.",
            });
        }

        if (!departmentDoc) {
            return res.status(404).json({
                message: "Department not found.",
            });
        }

        if (
            programDoc.department.toString() !==
            departmentDoc._id.toString()
        ) {
            return res.status(400).json({
                message: "The selected program does not belong to this department.",
            });
        }

        const admission = await Admission.create({
            applicationId: createApplicationId(),
            name: name.trim(),
            email: normalizedEmail,
            cnic: normalizedCnic,
            contact: contact.trim(),
            dob: parsedDob,
            address: address.trim(),
            city: city.trim(),
            previousEducation: previousEducation.trim(),
            documents,
            program: programDoc._id,
            department: departmentDoc._id,
        });

        return res.status(201).json({
            message: "Application submitted successfully.",
            admission,
        });
    } catch (error) {
        console.error("Submit admission error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message:
                    "An application already exists with this email, CNIC, or application ID.",
            });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message: "Failed to submit the admission application.",
        });
    }
};

// ─── Get Applications ────────────────────────────────────────────────────────

const getAdmissions = async (req, res) => {
    try {
        const { status, search } = req.query;
        const filter = {};

        if (status && status !== "All") {
            if (!["pending", "approved", "rejected"].includes(status)) {
                return res.status(400).json({
                    message: "Invalid admission status filter.",
                });
            }

            filter.status = status;
        }

        if (search?.trim()) {
            const escapedSearch = search.trim().replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { name: { $regex: escapedSearch, $options: "i" } },
                { email: { $regex: escapedSearch, $options: "i" } },
                { cnic: { $regex: escapedSearch, $options: "i" } },
                {
                    applicationId: {
                        $regex: escapedSearch,
                        $options: "i",
                    },
                },
            ];
        }

        const admissions = await Admission.find(filter)
            .populate("department", "name code")
            .populate("program", "name duration")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            message: "Admissions fetched successfully.",
            count: admissions.length,
            admissions,
        });
    } catch (error) {
        console.error("Get admissions error:", error);

        return res.status(500).json({
            message: "Failed to load admission applications.",
        });
    }
};

// ─── Review Application ──────────────────────────────────────────────────────

const reviewAdmission = async (req, res) => {
    const { id } = req.params;
    const { status, remarks = "" } = req.body;

    if (!isValidObjectId(id)) {
        return res.status(400).json({
            message: "Invalid application ID.",
        });
    }

    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({
            message: "Status must be 'approved' or 'rejected'.",
        });
    }

    if (status === "rejected" && !remarks.trim()) {
        return res.status(400).json({
            message: "Remarks are required when rejecting an application.",
        });
    }

    const session = await mongoose.startSession();

    try {
        let updatedAdmissionId;

        await session.withTransaction(async () => {
            const admission = await Admission.findById(id).session(session);

            if (!admission) {
                const error = new Error("Application not found.");
                error.statusCode = 404;
                throw error;
            }

            if (admission.status !== "pending") {
                const error = new Error(
                    "Only pending applications can be reviewed."
                );
                error.statusCode = 409;
                throw error;
            }

            if (status === "approved") {
                const program = await Program.findById(
                    admission.program
                ).session(session);

                if (!program) {
                    const error = new Error("Program not found.");
                    error.statusCode = 404;
                    throw error;
                }

                // Atomically reserve one seat only if seats remain.
                const reservedProgram = await Program.findOneAndUpdate(
                    {
                        _id: program._id,
                        availableSeats: { $gt: 0 },
                    },
                    {
                        $inc: { availableSeats: -1 },
                    },
                    {
                        new: true,
                        session,
                    }
                );

                if (!reservedProgram) {
                    const error = new Error(
                        "No seats available in this program."
                    );
                    error.statusCode = 409;
                    throw error;
                }

                const existingStudent = await Student.findOne({
                    $or: [
                        { email: admission.email },
                        { cnic: admission.cnic },
                    ],
                }).session(session);

                const existingUser = await User.findOne({
                    $or: [
                        { email: admission.email },
                        { cnic: admission.cnic },
                    ],
                }).session(session);

                if (existingStudent || existingUser) {
                    const error = new Error(
                        "A student or user account already exists with this email or CNIC."
                    );
                    error.statusCode = 409;
                    throw error;
                }

                const student = new Student({
                    name: admission.name,
                    rollNo: createRollNo(),
                    email: admission.email,
                    cnic: admission.cnic,
                    dob: admission.dob,
                    contact: admission.contact,
                    address: admission.address,
                    city: admission.city,
                    program: admission.program,
                    dateOfAdmission: new Date(),
                    previousAcademicDocument: admission.documents,
                    documentsVerified: false,
                    status: "active",
                    feeStatus: "pending",
                    createdBy: req.user.id,
                });

                await student.save({ session });

                const user = new User({
                    name: student.name,
                    email: student.email,
                    cnic: student.cnic,
                    // Demo-only initial password; see note below.
                    password: student.cnic,
                    role: "student",
                    studentId: student._id,
                });

                await user.save({ session });
            }

            admission.status = status;
            admission.reviewedBy = req.user.id;
            admission.reviewedAt = new Date();
            admission.remarks = remarks.trim();

            await admission.save({ session });

            updatedAdmissionId = admission._id;
        });

        const updatedAdmission = await Admission.findById(updatedAdmissionId)
            .populate("department", "name code")
            .populate("program", "name duration")
            .populate("reviewedBy", "name email");

        return res.status(200).json({
            message: `Application ${status} successfully.`,
            admission: updatedAdmission,
        });
    } catch (error) {
        console.error("Review admission error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message:
                    "A duplicate email, CNIC, roll number, or application ID already exists. No approval changes were committed.",
            });
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message,
            });
        }

        return res.status(500).json({
            message:
                error.message ||
                "Failed to review the application. No approval changes were committed.",
        });
    } finally {
        await session.endSession();
    }
};

export {
    getAdmissionStats,
    applyAdmission,
    getAdmissions,
    reviewAdmission,
};