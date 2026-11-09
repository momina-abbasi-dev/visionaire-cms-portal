
import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            unique: true,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            unique: true,
            required: true,
            trim: true,
            uppercase: true,
        },
        description: {
            type: String,
            trim: true,
            default: "",
        },
        totalSeats: {
            type: Number,
            required: true,
            min: [0, "Total seats cannot be negative."],
            validate: {
                validator: Number.isInteger,
                message: "Total seats must be a whole number.",
            },
        },
        availableSeats: {
            type: Number,
            required: true,
            min: [0, "Available seats cannot be negative."],
            validate: {
                validator: Number.isInteger,
                message: "Available seats must be a whole number.",
            },
        },
    },
    { timestamps: true }
);

// Ensure available seats never exceed total seats.
departmentSchema.pre("validate", function () {
    if (
        Number.isFinite(this.totalSeats) &&
        Number.isFinite(this.availableSeats) &&
        this.availableSeats > this.totalSeats
    ) {
        this.invalidate(
            "availableSeats",
            "Available seats cannot exceed total seats."
        );
    }
});

export default mongoose.model("Department", departmentSchema);