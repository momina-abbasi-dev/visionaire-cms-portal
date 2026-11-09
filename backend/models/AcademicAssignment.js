import mongoose from "mongoose";

const academicAssignmentSchema = new mongoose.Schema(
    {
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
            required: true,
        },

        subject: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true,
        },

        classSection: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSection",
            required: true,
        },

        session: {
            type: String,
            required: true,
            trim: true,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

academicAssignmentSchema.index(
    { subject: 1, classSection: 1, session: 1 },
    {
        unique: true,
        partialFilterExpression: { isActive: true },
    }
);

export default mongoose.model(
    "AcademicAssignment",
    academicAssignmentSchema
);