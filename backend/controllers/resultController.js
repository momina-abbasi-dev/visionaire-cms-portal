import Result from "../models/Result.js";
import AcademicRecord from "../models/AcademicRecord.js";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import ClassSection from "../models/ClassSection.js";

const generateResult = async (req, res) => {
    const user = await User.findById(req.user.id);
    const student = user.studentId;
    const { subject, classSection, session } = req.body;
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({ message: "Only students allowed" });
        }
        const records = await AcademicRecord.find({ student, subject, classSection, session });
        if (records.length === 0) {
            return res.status(404).json({
                message: "No academic records found"
            });
        }
        const maxMarksMap = {
            "quiz": 10,
            "assignment": 10,
            "practical": 15,
            "midterm": 15,
            "final": 50
        }
        let obtainedMarks = 0;
        let totalMarks = 0;
        records.forEach(record => {
            obtainedMarks += record.marks;
            totalMarks += maxMarksMap[record.examType];
        })
        const marksPercentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
        const filter = { student, subject, classSection, session };
        const present = await Attendance.countDocuments({...filter, status: {$in: ["present", "late"]}})
        const total = await Attendance.countDocuments({...filter});
        const attendancePercentage = total > 0 ? (present / total) * 100 : 0;
        const existingStudent = await Student.findById(student);
        if (!existingStudent) {
            return res.status(404).json({ message: "Student not found" });
        }
        const existingSubject = await Subject.findById(subject);
        if (!existingSubject) {
            return res.status(404).json({ message: "Subject not found" });
        }
        const existingClassSection = await ClassSection.findById(classSection);
        if (!existingClassSection) {
            return res.status(404).json({ message: "Class Section not found" });
        }
        const existingResult = await Result.findOne({ student, subject, classSection, session });
        if (existingResult) {
            return res.status(400).json({ message: "Result for this student, subject, class section, and session already exists" });
        }
        let grade;
        if (marksPercentage >= 90) {
            grade = "A";
        } else if (marksPercentage >= 80) {
            grade = "B";
        } else if (marksPercentage >= 70) {
            grade = "C";
        } else if (marksPercentage >= 60) {
            grade = "D";
        } else {
            grade = "F";
        }
        let status;
        if (grade === "F") {
            status = "fail";
        } else {
            status = "pass";
        }
        const newResult = new Result({
            student,
            subject,
            classSection,
            session,
            obtainedMarks,
            totalMarks,
            marksPercentage,
            attendancePercentage,
            grade,
            status,
            generatedBy: req.user.id
        });
        await newResult.save();
        res.status(201).json({ message: "Result generated successfully", result: newResult });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const viewResults = async (req, res) => {
    const user = await User.findById(req.user.id);
    const student = user.studentId;
    const { subject, classSection, session } = req.query;
    try {
        if (req.user.role !== "student") {
            return res.status(403).json({
                message: "Only students can view results"
            });
        }
        const filter = { student };
        if (subject) filter.subject = subject;
        if (classSection) filter.classSection = classSection;
        if (session) filter.session = session;
        const results = await Result.find({...filter, student})
            .populate("subject", "name code")
            .populate("classSection", "name");
        res.status(200).json({
            message: "Results retrieved successfully",
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export { generateResult, viewResults };