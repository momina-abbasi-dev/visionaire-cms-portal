import mongoose from "mongoose";

const programSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Program name is required."],
            trim: true,
        },

        duration: {
            type: Number,
            required: [true, "Program duration is required."],
            min: [1, "Program duration must be at least 1."],
            validate: {
                validator: Number.isInteger,
                message: "Program duration must be a whole number.",
            },
        },

        totalSeats: {
            type: Number,
            required: [true, "Total seats are required."],
            min: [0, "Total seats cannot be negative."],
            validate: {
                validator: Number.isInteger,
                message: "Total seats must be a whole number.",
            },
        },

        availableSeats: {
            type: Number,
            required: [true, "Available seats are required."],
            min: [0, "Available seats cannot be negative."],
            validate: {
                validator: Number.isInteger,
                message: "Available seats must be a whole number.",
            },
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

// Available seats must never exceed total seats.
programSchema.pre("validate", function () {
    if (
        Number.isInteger(this.totalSeats) &&
        Number.isInteger(this.availableSeats) &&
        this.availableSeats > this.totalSeats
    ) {
        this.invalidate(
            "availableSeats",
            "Available seats cannot exceed total seats."
        );
    }
});

// A department cannot contain two programs with the same name.
programSchema.index(
    { name: 1, department: 1 },
    { unique: true }
);

export default mongoose.model("Program", programSchema);
