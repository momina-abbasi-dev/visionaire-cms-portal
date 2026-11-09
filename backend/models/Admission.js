import mongoose from "mongoose";

const admissionSchema = new mongoose.Schema(
    {
        applicationId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        name: {
            type: String,
            required: true,
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

        previousEducation: {
            type: String,
            required: true,
            trim: true,
        },

        documents: [
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

        program: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Program",
            required: true,
        },

        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
            index: true,
        },

        appliedAt: {
            type: Date,
            default: Date.now,
        },

        reviewedAt: {
            type: Date,
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        remarks: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Admission", admissionSchema);