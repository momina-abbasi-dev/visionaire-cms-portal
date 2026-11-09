import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        rollNo: {
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

        dob: {
            type: Date,
            required: true,
        },

        contact: {
            type: String,
            required: true,
            trim: true,
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

        program: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Program",
            required: true,
        },

        dateOfAdmission: {
            type: Date,
            default: Date.now,
        },

        previousAcademicDocument: [
            {
                name: {
                    type: String,
                    trim: true,
                },

                fileUrl: {
                    type: String,
                    trim: true,
                },
            },
        ],

        documentsVerified: {
            type: Boolean,
            default: false,
        },

        status: {
            type: String,
            enum: [
                "active",
                "suspended",
                "graduated",
                "pending",
            ],
            default: "active",
        },

        /*
         * Kept for compatibility with the current Student
         * Management workflow.
         *
         * Finance should eventually become the source of truth
         * for actual fee state.
         */
        feeStatus: {
            type: String,
            enum: [
                "paid",
                "partial",
                "pending",
            ],
            default: "pending",
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model(
    "Student",
    studentSchema
);