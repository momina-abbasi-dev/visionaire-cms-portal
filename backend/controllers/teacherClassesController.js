import User from "../models/User.js"
import Teacher from "../models/Teacher.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Attendance from "../models/Attendance.js"

const assignmentKey = (classSectionId, subjectId, session) =>
    JSON.stringify([String(classSectionId), String(subjectId), session])

export const getTeacherClasses = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("teacherId")
        if (!user) return res.status(404).json({ message: "User not found." })
        if (!user.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })

        const teacher = await Teacher.findById(user.teacherId)
        if (!teacher) return res.status(404).json({ message: "Teacher not found." })

        const assignments = await AcademicAssignment.find({
            teacher: teacher._id,
            isActive: true,
        })
            .populate({
                path: "classSection",
                select: "name section semester program department",
                populate: [
                    { path: "program", select: "name duration" },
                    { path: "department", select: "name code" },
                ],
            })
            .populate({
                path: "subject",
                select: "name code creditHours program department",
                populate: [
                    { path: "program", select: "name" },
                    { path: "department", select: "name code" },
                ],
            })
            .lean()

        const classMap = new Map()
        const subjectMap = new Map()
        const activeAssignmentKeys = new Set()
        const assignmentKeysByClass = new Map()

        for (const assignment of assignments) {
            const cls = assignment.classSection
            const subject = assignment.subject
            if (!cls?._id || !subject?._id) continue

            const classId = String(cls._id)
            const subjectId = String(subject._id)
            const key = assignmentKey(cls._id, subject._id, assignment.session)
            activeAssignmentKeys.add(key)
            if (!assignmentKeysByClass.has(classId)) {
                assignmentKeysByClass.set(classId, new Set())
            }
            assignmentKeysByClass.get(classId).add(key)

            if (!classMap.has(classId)) {
                classMap.set(classId, {
                    _id: cls._id,
                    name: cls.name,
                    section: cls.section,
                    semester: cls.semester,
                    program: cls.program?.name,
                    programDuration: cls.program?.duration,
                    department: cls.department?.name,
                    departmentCode: cls.department?.code,
                    subjects: new Map(),
                })
            }

            const subjectInfo = {
                _id: subject._id,
                name: subject.name,
                code: subject.code,
                creditHours: subject.creditHours,
            }
            classMap.get(classId).subjects.set(subjectId, subjectInfo)

            if (!subjectMap.has(subjectId)) {
                subjectMap.set(subjectId, subjectInfo)
            }
        }

        const classCards = [...classMap.values()].map(cls => ({
            ...cls,
            subjects: [...cls.subjects.values()],
        }))
        const classIds = classCards.map(cls => cls._id)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const [attendanceRecords, academicRecords] = classIds.length
            ? await Promise.all([
                Attendance.find({
                    teacher: teacher._id,
                    classSection: { $in: classIds },
                    date: { $gte: todayStart, $lte: todayEnd },
                })
                    .select("classSection subject session")
                    .lean(),
                AcademicRecord.find({
                    teacher: teacher._id,
                    classSection: { $in: classIds },
                })
                    .select("classSection subject session")
                    .lean(),
            ])
            : [[], []]

        const attendanceAssignmentKeys = new Set()
        for (const record of attendanceRecords) {
            const key = assignmentKey(record.classSection, record.subject, record.session)
            if (activeAssignmentKeys.has(key)) {
                attendanceAssignmentKeys.add(key)
            }
        }

        const recordCounts = new Map()
        for (const record of academicRecords) {
            const classId = String(record.classSection)
            const key = assignmentKey(record.classSection, record.subject, record.session)
            if (activeAssignmentKeys.has(key)) {
                recordCounts.set(classId, (recordCounts.get(classId) || 0) + 1)
            }
        }

        const enrichedClassCards = classCards.map(cls => {
            const classId = String(cls._id)
            const assignmentKeys = assignmentKeysByClass.get(classId) || new Set()
            const attendanceTodayDone = assignmentKeys.size > 0 &&
                [...assignmentKeys].every(key => attendanceAssignmentKeys.has(key))
            return {
                ...cls,
                studentCount: null,
                attendanceTodayDone,
                classAttPct: null,
                pendingMarksCount: null,
                totalRecords: recordCounts.get(classId) || 0,
                resultStatus: null,
                classStatus: attendanceTodayDone ? "Completed Today" : "Attendance Pending",
            }
        })

        const pendingAttendance = enrichedClassCards.filter(
            cls => !cls.attendanceTodayDone
        ).length
        const reminders = enrichedClassCards
            .filter(cls => !cls.attendanceTodayDone)
            .map(cls => ({
                level: "warning",
                icon: "📅",
                message: `Attendance pending for ${cls.name} — ${cls.section}`,
                classId: cls._id,
            }))

        return res.status(200).json({
            stats: {
                totalClasses: enrichedClassCards.length,
                totalStudents: null,
                totalSubjects: subjectMap.size,
                pendingAttendance,
                totalPendingMarks: null,
            },
            classCards: enrichedClassCards,
            reminders,
        })
    } catch (error) {
        return res.status(500).json({ message: "Server Error", error: error.message })
    }
}
