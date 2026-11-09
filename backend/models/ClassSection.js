
import mongoose from "mongoose";

const classSectionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Class name is required."],
            trim: true,
        },

        section: {
            type: String,
            required: [true, "Section is required."],
            trim: true,
        },

        semester: {
            type: Number,
            required: [true, "Semester is required."],
            min: [1, "Semester must be at least 1."],
            validate: {
                validator: Number.isInteger,
                message: "Semester must be a whole number.",
            },
        },

        program: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Program",
            required: [true, "Program is required."],
        },

        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department",
            required: [true, "Department is required."],
        },
    },
    {
        timestamps: true,
    }
);

classSectionSchema.index(
    {
        name: 1,
        section: 1,
        semester: 1,
        program: 1,
    },
    {
        unique: true,
    }
);

export default mongoose.model("ClassSection", classSectionSchema);