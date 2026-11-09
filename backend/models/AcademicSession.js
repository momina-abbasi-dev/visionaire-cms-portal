import mongoose from "mongoose";

const isUtcMidnight = (value) =>
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;

const academicSessionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        nameKey: {
            type: String,
            required: true,
            unique: true,
        },

        startDate: {
            type: Date,
            required: true,
            validate: {
                validator: isUtcMidnight,
                message: "Start date must be a valid UTC calendar date.",
            },
        },

        endDate: {
            type: Date,
            required: true,
            validate: {
                validator: isUtcMidnight,
                message: "End date must be a valid UTC calendar date.",
            },
        },

        status: {
            type: String,
            enum: ["planned", "active", "completed"],
            default: "planned",
            required: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

academicSessionSchema.pre("validate", function () {
    if (typeof this.name === "string") {
        this.name = this.name.trim();
        this.nameKey = this.name.replace(/\s+/g, " ").toLowerCase();
    }

    if (
        isUtcMidnight(this.startDate) &&
        isUtcMidnight(this.endDate) &&
        this.startDate > this.endDate
    ) {
        this.invalidate("endDate", "End date must be on or after the start date.");
    }
});

export default mongoose.model("AcademicSession", academicSessionSchema);
