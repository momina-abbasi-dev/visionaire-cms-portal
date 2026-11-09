import mongoose from "mongoose";

import AcademicRecord from "../models/AcademicRecord.js";
import AcademicAssignment from "../models/AcademicAssignment.js";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import ClassSection from "../models/ClassSection.js";
import Teacher from "../models/Teacher.js";
import {
  acquireStudentWriteFence,
  isTransactionWriteConflict,
} from "../utils/studentWriteFence.js";

const VALID_STATUSES = [
  "pending",
  "verified",
  "needs_correction",
  "rejected",
];

const VALID_EXAM_TYPES = [
  "quiz",
  "assignment",
  "practical",
  "midterm",
  "final",
];

const isValidId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getErrorStatus = (error) => {
  if (error.name === "ValidationError") return 400;
  if (error.name === "CastError") return 400;
  if (error.code === 11000) return 409;
  return 500;
};

const populateRecord = (query) =>
  query
    .populate("student", "name rollNo email")
    .populate("teacher", "name registrationNo")
    .populate("subject", "name code creditHours")
    .populate("classSection", "name section semester")
    .populate("reviewedBy", "name");

// ─── Statistics ──────────────────────────────────────────────────────────────

export const getAcademicRecordStats = async (req, res) => {
  try {
    const [
      totalRecords,
      pendingReview,
      verifiedRecords,
      needsCorrection,
      rejectedRecords,
      teacherIds,
      classIds,
    ] = await Promise.all([
      AcademicRecord.countDocuments(),
      AcademicRecord.countDocuments({ status: "pending" }),
      AcademicRecord.countDocuments({ status: "verified" }),
      AcademicRecord.countDocuments({
        status: "needs_correction",
      }),
      AcademicRecord.countDocuments({ status: "rejected" }),
      AcademicRecord.distinct("teacher"),
      AcademicRecord.distinct("classSection"),
    ]);

    return res.status(200).json({
      totalRecords,
      teachersWithRecords: teacherIds.length,
      pendingReview,
      verifiedRecords,
      needsCorrection,
      rejectedRecords,
      classesWithRecords: classIds.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load academic record statistics.",
    });
  }
};

// ─── Admin: List records ─────────────────────────────────────────────────────

export const getRecords = async (req, res) => {
  try {
    const { status, examType, search } = req.query;
    const filter = {};

    if (status && status !== "All") {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid record status filter.",
        });
      }

      filter.status = status;
    }

    if (examType && examType !== "All") {
      if (!VALID_EXAM_TYPES.includes(examType)) {
        return res.status(400).json({
          message: "Invalid exam type filter.",
        });
      }

      filter.examType = examType;
    }

    const searchTerm =
      typeof search === "string" ? search.trim() : "";

    if (searchTerm) {
      const regex = new RegExp(
        escapeRegex(searchTerm),
        "i"
      );

      const [students, subjects, teachers] =
        await Promise.all([
          Student.find({
            $or: [
              { name: regex },
              { rollNo: regex },
              { email: regex },
            ],
          }).select("_id"),

          Subject.find({
            $or: [
              { name: regex },
              { code: regex },
            ],
          }).select("_id"),

          Teacher.find({
            name: regex,
          }).select("_id"),
        ]);

      filter.$or = [
        { session: regex },
        {
          student: {
            $in: students.map((item) => item._id),
          },
        },
        {
          subject: {
            $in: subjects.map((item) => item._id),
          },
        },
        {
          teacher: {
            $in: teachers.map((item) => item._id),
          },
        },
      ];
    }

    const records = await populateRecord(
      AcademicRecord.find(filter)
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Records fetched successfully.",
      records,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch academic records.",
    });
  }
};

// ─── Admin: Review or lock a record ──────────────────────────────────────────

export const updateRecordStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewRemarks, isLocked } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid academic record ID.",
      });
    }

    const hasStatus = status !== undefined;
    const hasLock = isLocked !== undefined;
    const hasRemarks = reviewRemarks !== undefined;

    if (!hasStatus && !hasLock && !hasRemarks) {
      return res.status(400).json({
        message: "No update fields were provided.",
      });
    }

    if (
      hasStatus &&
      !VALID_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        message: "Invalid academic record status.",
      });
    }

    if (hasLock && typeof isLocked !== "boolean") {
      return res.status(400).json({
        message: "isLocked must be a boolean.",
      });
    }

    if (
      hasRemarks &&
      typeof reviewRemarks !== "string"
    ) {
      return res.status(400).json({
        message: "Review remarks must be text.",
      });
    }

    if (
      hasStatus &&
      ["needs_correction", "rejected"].includes(status) &&
      !String(reviewRemarks ?? "").trim()
    ) {
      return res.status(400).json({
        message:
          "Review remarks are required when requesting corrections or rejecting a record.",
      });
    }

    const record = await AcademicRecord.findById(id);

    if (!record) {
      return res.status(404).json({
        message: "Academic record not found.",
      });
    }

    // Locked records cannot be reviewed or edited.
    // They must first be explicitly unlocked.
    if (record.isLocked && (hasStatus || hasRemarks)) {
      return res.status(409).json({
        message:
          "This record is locked. Unlock it before changing its review.",
      });
    }

    if (hasLock && isLocked && record.status !== "verified") {
      return res.status(400).json({
        message:
          "Only verified academic records can be locked.",
      });
    }

    if (hasStatus) {
      record.status = status;
      record.reviewedBy = req.user.id;
      record.reviewedAt = new Date();

      if (hasRemarks) {
        record.reviewRemarks = reviewRemarks.trim();
      } else if (
        status === "verified" ||
        status === "pending"
      ) {
        record.reviewRemarks = "";
      }
    } else if (hasRemarks) {
      record.reviewRemarks = reviewRemarks.trim();
    }

    if (hasLock) {
      record.isLocked = isLocked;
    }

    await record.save();

    const updated = await populateRecord(
      AcademicRecord.findById(record._id)
    );

    return res.status(200).json({
      message: "Academic record updated successfully.",
      record: updated,
    });
  } catch (error) {
    return res.status(getErrorStatus(error)).json({
      message:
        error.name === "ValidationError" ||
        error.name === "CastError"
          ? error.message
          : "Failed to update academic record.",
    });
  }
};

// ─── Teacher: Submit marks ───────────────────────────────────────────────────

export const createRecord = async (req, res) => {
  let transactionSession;

  try {
    const {
      subject,
      student,
      classSection,
      marks,
      examType,
      session,
      remarks,
    } = req.body;

    if (
      !subject ||
      !student ||
      !classSection ||
      !examType ||
      !session ||
      marks === undefined ||
      marks === null ||
      marks === ""
    ) {
      return res.status(400).json({
        message:
          "Student, subject, class, marks, exam type, and session are required.",
      });
    }

    if (
      !isValidId(subject) ||
      !isValidId(student) ||
      !isValidId(classSection)
    ) {
      return res.status(400).json({
        message:
          "Student, subject, or class contains an invalid ID.",
      });
    }

    const numericMarks = Number(marks);

    if (
      !Number.isFinite(numericMarks) ||
      numericMarks < 0
    ) {
      return res.status(400).json({
        message:
          "Marks must be a valid nonnegative number.",
      });
    }

    if (!VALID_EXAM_TYPES.includes(examType)) {
      return res.status(400).json({
        message: "Invalid exam type.",
      });
    }

    if (
      typeof session !== "string" ||
      !session.trim() ||
      session.trim().length > 100
    ) {
      return res.status(400).json({
        message: "A valid session is required.",
      });
    }

    if (
      remarks !== undefined &&
      (typeof remarks !== "string" ||
        remarks.trim().length > 1000)
    ) {
      return res.status(400).json({
        message:
          "Remarks must be text of no more than 1000 characters.",
      });
    }

    transactionSession = await mongoose.startSession();
    let newRecord;

    await transactionSession.withTransaction(async () => {
      const user = await User.findById(req.user.id).session(transactionSession);
      if (!user) {
        throw Object.assign(
          new Error("Authenticated user was not found."),
          { statusCode: 401 }
        );
      }

      if (!user.teacherId) {
        throw Object.assign(
          new Error("This account is not linked to a teacher profile."),
          { statusCode: 403 }
        );
      }

      const teacher = await Teacher.findById(user.teacherId)
        .session(transactionSession);
      if (!teacher || teacher.status !== "active") {
        throw Object.assign(
          new Error("An active teacher profile is required to submit marks."),
          { statusCode: 403 }
        );
      }

      const existingStudent = await acquireStudentWriteFence(
        student,
        transactionSession
      );
      if (!existingStudent) {
        throw Object.assign(new Error("Student not found."), {
          statusCode: 404,
        });
      }
      if (existingStudent.status !== "active") {
        throw Object.assign(
          new Error("Student is not eligible for this class."),
          { statusCode: 400 }
        );
      }

      const existingSubject = await Subject.findById(subject)
        .session(transactionSession);
      if (!existingSubject) {
        throw Object.assign(new Error("Subject not found."), {
          statusCode: 404,
        });
      }

      const existingClassSection = await ClassSection.findById(classSection)
        .session(transactionSession);
      if (!existingClassSection) {
        throw Object.assign(
          new Error(
            "You are not assigned to this subject, class, and session."
          ),
          { statusCode: 403 }
        );
      }
      if (
        !existingStudent.program ||
        !existingClassSection.program ||
        existingStudent.program.toString() !==
          existingClassSection.program.toString()
      ) {
        throw Object.assign(
          new Error("Student is not eligible for this class."),
          { statusCode: 400 }
        );
      }

      const assignment = await AcademicAssignment.findOne({
        teacher: teacher._id,
        subject,
        classSection,
        session: session.trim(),
        isActive: true,
      }).session(transactionSession);
      if (!assignment) {
        throw Object.assign(
          new Error(
            "You are not assigned to this subject, class, and session."
          ),
          { statusCode: 403 }
        );
      }

      const existingRecord = await AcademicRecord.findOne({
        student,
        teacher: teacher._id,
        classSection,
        subject,
        examType,
        session: session.trim(),
      }).session(transactionSession);
      if (existingRecord) {
        throw Object.assign(
          new Error(
            "An academic record already exists for this student, subject, class, exam type, and session."
          ),
          { statusCode: 409 }
        );
      }

      newRecord = new AcademicRecord({
        teacher: teacher._id,
        student,
        subject,
        classSection,
        marks: numericMarks,
        examType,
        session: session.trim(),
        remarks: remarks?.trim() || "",
        status: "pending",
        createdBy: user._id,
      });
      await newRecord.save({ session: transactionSession });
    });

    const populatedRecord = await populateRecord(
      AcademicRecord.findById(newRecord._id)
    );

    return res.status(201).json({
      message: "Academic record submitted for review.",
      record: populatedRecord,
    });
  } catch (error) {
    const statusCode =
      error.statusCode ||
      (isTransactionWriteConflict(error) ? 409 : getErrorStatus(error));
    const message = error.statusCode || isTransactionWriteConflict(error)
      ? error.message
      : error.name === "ValidationError" || error.name === "CastError"
        ? error.message
        : "Failed to submit academic record.";

    return res.status(statusCode).json({
      message,
    });
  } finally {
    if (transactionSession) await transactionSession.endSession();
  }
};

// ─── Student / Teacher / Admin: View marks ────────────────────────────────────

export const viewMarks = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(401).json({
        message: "Authenticated user was not found.",
      });
    }

    const filter = {};
    const { subject, examType, session } = req.query;

    if (subject) {
      if (!isValidId(subject)) {
        return res.status(400).json({
          message: "Invalid subject ID.",
        });
      }

      filter.subject = subject;
    }

    if (examType) {
      if (!VALID_EXAM_TYPES.includes(examType)) {
        return res.status(400).json({
          message: "Invalid exam type.",
        });
      }

      filter.examType = examType;
    }

    if (session) {
      filter.session = session;
    }

    if (user.role === "student") {
      if (!user.studentId) {
        return res.status(403).json({
          message:
            "This account is not linked to a student profile.",
        });
      }

      filter.student = user.studentId;

      // Students see only records approved by an admin.
      filter.status = "verified";
    } else if (user.role === "teacher") {
      if (!user.teacherId) {
        return res.status(403).json({
          message:
            "This account is not linked to a teacher profile.",
        });
      }

      filter.teacher = user.teacherId;
    } else if (user.role !== "admin") {
      return res.status(403).json({
        message: "You are not allowed to view these records.",
      });
    }

    const marks = await populateRecord(
      AcademicRecord.find(filter)
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Academic records fetched successfully.",
      marks,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch academic records.",
    });
  }
};