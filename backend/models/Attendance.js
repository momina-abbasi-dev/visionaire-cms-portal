import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    classSection: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    session: { type: String, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ["present", "absent", "late"], required: true },
    remarks: { type: String, trim: true, default: "" },
}, { timestamps: true });

attendanceSchema.index({ student: 1, subject: 1, classSection: 1, date: 1 }, { unique: true })

export default mongoose.model("Attendance", attendanceSchema);