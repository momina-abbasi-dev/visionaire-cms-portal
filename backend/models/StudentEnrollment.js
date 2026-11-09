import mongoose from "mongoose";

const ENROLLMENT_STATUSES = [
    "active",
    "completed",
    "withdrawn",
    "transferred",
];
const CLOSED_STATUSES = ["completed", "withdrawn", "transferred"];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOnly = (value) => {
    if (value == null || value instanceof Date) {
        return value;
    }

    if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
        throw new TypeError("Enrollment dates must use YYYY-MM-DD format.");
    }

    const [year, month, day] = value.split("-").map(Number);
    if (year < 1) {
        throw new TypeError("Enrollment date must be a valid calendar date.");
    }

    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        throw new TypeError("Enrollment date must be a valid calendar date.");
    }

    return date;
};

const isUtcMidnight = (value) =>
    value instanceof Date &&
    Number.isFinite(value.getTime()) &&
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0;

const studentEnrollmentSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            immutable: true,
        },

        classSection: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ClassSection",
            required: true,
            immutable: true,
        },

        academicSession: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AcademicSession",
            required: true,
            immutable: true,
        },

        status: {
            type: String,
            enum: ENROLLMENT_STATUSES,
            default: "active",
            required: true,
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
            default: null,
            required: function () {
                return CLOSED_STATUSES.includes(this.status);
            },
            validate: {
                validator: (value) => value == null || isUtcMidnight(value),
                message: "End date must be a valid UTC calendar date.",
            },
        },

        endedAt: {
            type: Date,
            default: null,
            required: function () {
                return CLOSED_STATUSES.includes(this.status);
            },
        },

        endReason: {
            type: String,
            trim: true,
            default: null,
            required: function () {
                return CLOSED_STATUSES.includes(this.status);
            },
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        endedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            required: function () {
                return CLOSED_STATUSES.includes(this.status);
            },
        },

        previousEnrollment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "StudentEnrollment",
            default: null,
        },

        reason: {
            type: String,
            trim: true,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

const dateCaster = mongoose.Schema.Types.Date.cast();
for (const path of ["startDate", "endDate"]) {
    studentEnrollmentSchema
        .path(path)
        .castFunction((value) => dateCaster(parseDateOnly(value)));
}

const rejectQueryMutation = function () {
    throw new Error(
        "StudentEnrollment query mutations are not supported. Load the document, modify it, then validate and save it."
    );
};

studentEnrollmentSchema.pre(
    [
        "updateOne",
        "updateMany",
        "findOneAndUpdate",
        "replaceOne",
        "findOneAndReplace",
    ],
    rejectQueryMutation
);
studentEnrollmentSchema.pre("bulkWrite", rejectQueryMutation);

studentEnrollmentSchema.pre("validate", async function () {
    const hasClosureData = [
        this.endDate,
        this.endedAt,
        this.endedBy,
        this.endReason,
    ].some((value) => value != null && value !== "");

    if (this.status === "active" && hasClosureData) {
        this.invalidate(
            "status",
            "Active enrollments cannot contain closure information."
        );
    }

    if (
        isUtcMidnight(this.startDate) &&
        isUtcMidnight(this.endDate) &&
        this.endDate < this.startDate
    ) {
        this.invalidate("endDate", "End date cannot precede the start date.");
    }

    if (
        this.startDate instanceof Date &&
        this.endedAt instanceof Date &&
        this.endedAt < this.startDate
    ) {
        this.invalidate("endedAt", "End timestamp cannot precede the start date.");
    }

    if (this.previousEnrollment != null) {
        if (
            this._id &&
            this.previousEnrollment.toString() === this._id.toString()
        ) {
            this.invalidate(
                "previousEnrollment",
                "An enrollment cannot refer to itself as its previous enrollment."
            );
            return;
        }

        const previous = await this.constructor
            .findById(this.previousEnrollment)
            .select("student previousEnrollment")
            .session(this.$session())
            .lean();

        if (!previous) {
            this.invalidate(
                "previousEnrollment",
                "Previous enrollment was not found."
            );
        } else if (previous.student.toString() !== this.student?.toString()) {
            this.invalidate(
                "previousEnrollment",
                "Previous enrollment must belong to the same student."
            );
        } else {
            const visitedEnrollmentIds = new Set(
                this._id ? [this._id.toString()] : []
            );
            let current = previous;

            while (current?.previousEnrollment != null) {
                const previousId = current.previousEnrollment.toString();
                if (visitedEnrollmentIds.has(previousId)) {
                    this.invalidate(
                        "previousEnrollment",
                        "Previous enrollment cannot create a cycle in enrollment history."
                    );
                    break;
                }

                visitedEnrollmentIds.add(previousId);
                current = await this.constructor
                    .findById(previousId)
                    .select("previousEnrollment")
                    .session(this.$session())
                    .lean();
            }
        }
    }
});

studentEnrollmentSchema.index(
    { student: 1, academicSession: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "active" },
    }
);

studentEnrollmentSchema.index({
    academicSession: 1,
    classSection: 1,
    status: 1,
    startDate: 1,
});

studentEnrollmentSchema.index({
    student: 1,
    academicSession: 1,
    startDate: -1,
});

export default mongoose.model("StudentEnrollment", studentEnrollmentSchema);
