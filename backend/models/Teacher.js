
import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    registrationNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    cnic: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    contact: {
      type: String,
      required: true,
      trim: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
    },

    education: {
      type: String,
      required: true,
      trim: true,
    },

    educationDocuments: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        fileUrl: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    role: {
      type: String,
      enum: ["junior", "senior"],
      required: true,
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

export default mongoose.model("Teacher", teacherSchema);
