import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        creditHours: {
            type: Number,
            required: true,
            min: 1,
            max: 6,
        },

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
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Subject", subjectSchema);