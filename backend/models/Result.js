import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    classSection: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    obtainedMarks: { type: Number, required: true, validate: {
      validator: function(value) {
        return value <= this.totalMarks;
      },
      message: "Obtained marks cannot exceed total marks"
    }},
    totalMarks: { type: Number, required: true },
    marksPercentage: { type: Number, required: true },
    attendancePercentage: { type: Number, required: true },
    grade: { type: String, enum: ["A", "B", "C", "D", "F"], required: true },
    session: { type: String, required: true },
    status: { type: String, enum: ["pass", "fail"], required: true },
    remarks: { type: String },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

resultSchema.index(
  { student: 1, subject: 1, classSection: 1, session: 1 },
  { unique: true }
);

export default mongoose.model("Result", resultSchema);