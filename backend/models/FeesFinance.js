import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be greater than zero."],
    },
    method: {
      type: String,
      enum: ["cash", "bank", "online"],
      required: true,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    reference: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { _id: true }
);

const feeRecordSchema = new mongoose.Schema(
  {
    challanId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      default: null,
    },
    classSection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassSection",
      default: null,
    },
    semester: {
      type: String,
      required: true,
      trim: true,
    },
    session: {
      type: String,
      required: true,
      trim: true,
    },

    totalFee: {
      type: Number,
      required: true,
      min: [0, "Total fee cannot be negative."],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative."],
    },
    lateFee: {
      type: Number,
      default: 0,
      min: [0, "Late fee cannot be negative."],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, "Paid amount cannot be negative."],
    },

    dueDate: {
      type: Date,
      required: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["unpaid", "paid", "partial", "overdue", "cancelled"],
      default: "unpaid",
      index: true,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

feeRecordSchema.virtual("balance").get(function () {
  return Math.max(
    0,
    this.totalFee + this.lateFee - this.discount - this.paidAmount
  );
});

feeRecordSchema.set("toJSON", { virtuals: true });
feeRecordSchema.set("toObject", { virtuals: true });

feeRecordSchema.pre("validate", function () {
  const netDue = this.totalFee + this.lateFee - this.discount;

  if (this.discount > this.totalFee + this.lateFee) {
    this.invalidate(
      "discount",
      "Discount cannot exceed the total fee plus late fee."
    );
  }

  if (this.paidAmount > netDue) {
    this.invalidate(
      "paidAmount",
      "Paid amount cannot exceed the net amount due."
    );
  }

  if (this.dueDate && Number.isNaN(this.dueDate.getTime())) {
    this.invalidate("dueDate", "Please provide a valid due date.");
  }
});

feeRecordSchema.pre("save", function () {
  if (this.status === "cancelled") return;

  const netDue = this.totalFee + this.lateFee - this.discount;

  if (this.paidAmount >= netDue) {
    this.status = "paid";
    if (!this.paidAt) this.paidAt = new Date();
  } else {
    this.paidAt = null;

    if (this.dueDate < new Date()) {
      this.status = "overdue";
    } else if (this.paidAmount > 0) {
      this.status = "partial";
    } else {
      this.status = "unpaid";
    }
  }
});

feeRecordSchema.index({ student: 1, createdAt: -1 });
feeRecordSchema.index({ status: 1, dueDate: 1 });

export default mongoose.model("FeeRecord", feeRecordSchema);