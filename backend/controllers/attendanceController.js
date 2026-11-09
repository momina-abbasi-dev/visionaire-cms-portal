import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import ClassSection from "../models/ClassSection.js";
import AcademicAssignment from "../models/AcademicAssignment.js";
import {
    acquireStudentWriteFence,
    isTransactionWriteConflict,
} from "../utils/studentWriteFence.js";

const createAttendance = async (req, res) => {
    const {student, subject, classSection, session, status} = req.body;
    let transactionSession;

    try {
        transactionSession = await mongoose.startSession();
        let newAttendance;

        await transactionSession.withTransaction(async () => {
            const user = await User.findById(req.user.id).session(transactionSession);
            const teacher = user?.teacherId;
            const existingStudent = await acquireStudentWriteFence(
                student,
                transactionSession
            );
            if (!existingStudent) {
                throw Object.assign(new Error("Student not found"), {
                    statusCode: 404,
                });
            }

            const existingSubject = await Subject.findById(subject).session(transactionSession);
            if (!existingSubject) {
                throw Object.assign(new Error("Subject not found"), {
                    statusCode: 404,
                });
            }
            const existingClassSection = await ClassSection.findById(classSection)
                .session(transactionSession);
            if (!existingClassSection) {
                throw Object.assign(new Error("Class Section not found"), {
                    statusCode: 404,
                });
            }
            if (!existingStudent.program || !existingClassSection.program) {
                throw Object.assign(
                    new Error("Student is not eligible for this class."),
                    { statusCode: 400 }
                );
            }
            if (
                existingStudent.status !== "active" ||
                existingStudent.program.toString() !==
                    existingClassSection.program.toString()
            ) {
                throw Object.assign(
                    new Error("Student is not eligible for this class."),
                    { statusCode: 400 }
                );
            }
            const checkAcademicAssignment = await AcademicAssignment.findOne({
                teacher,
                subject,
                classSection,
                session,
            }).session(transactionSession);
            if (!checkAcademicAssignment) {
                throw Object.assign(new Error("Academic Assignment not found"), {
                    statusCode: 404,
                });
            }

            const date = new Date();
            date.setHours(0, 0, 0, 0);
            const existingAttendance = await Attendance.findOne({
                student,
                subject,
                classSection,
                session,
                date,
            }).session(transactionSession);
            if (existingAttendance) {
                throw Object.assign(new Error("Attendance already marked"), {
                    statusCode: 400,
                });
            }

            newAttendance = new Attendance({
                teacher,
                student,
                subject,
                classSection,
                session,
                status,
                date,
            });
            await newAttendance.save({ session: transactionSession });
        });

        res.status(201).json({
            message: "Attendance created successfully",
            newAttendance
        });
    } catch (error) {
        res.status(
            error.statusCode || (isTransactionWriteConflict(error) ? 409 : 500)
        ).json({ message: error.message });
    } finally {
        if (transactionSession) await transactionSession.endSession();
    }
};

const attendancePercentage = async (req, res) => {
    const user = await User.findById(req.user.id);
    const student = user.studentId;
    const {teacher, subject, classSection, session} = req.query;
    try {
        const filter = {student};
        if (teacher) filter.teacher = teacher;
        if (subject) filter.subject = subject;
        if (classSection) filter.classSection = classSection;
        if (session) filter.session = session;
        const totalPresent = await Attendance.countDocuments({...filter, status: { $in: ["present", "late"] }});
        const totalAbsent = await Attendance.countDocuments({...filter, status: "absent"});
        const totalLectures = await Attendance.countDocuments(filter);
        const percentage = totalLectures > 0 ? (totalPresent / totalLectures) * 100 : 0;
        const attendance = await Attendance.find(filter)
            .populate({path: "teacher", select: "name"})
            .populate({path: "subject", select: "name"})
            .populate({path: "classSection", select: "name"})
        ;
        res.status(200).json({
            message: "Attendance Percentage is accessed successfully",
            attendance,
            summary: {
                totalLectures,
                totalPresent,
                totalAbsent,
                percentage
            }
        })
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export {createAttendance, attendancePercentage};