
import mongoose from "mongoose";

const academicRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    classSection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      required: true,
      index: true,
    },

    marks: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isFinite,
        message: "Marks must be a valid number.",
      },
    },

    examType: {
      type: String,
      enum: [
        "quiz",
        "assignment",
        "practical",
        "midterm",
        "final",
      ],
      required: true,
    },

    session: {
      type: String,
      required: true,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "verified",
        "needs_correction",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    reviewRemarks: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    isLocked: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

academicRecordSchema.index({
  status: 1,
  createdAt: -1,
});

academicRecordSchema.index({
  student: 1,
  session: 1,
  examType: 1,
});

export default mongoose.model(
  "AcademicRecord",
  academicRecordSchema
);