import User from "../models/User.js"
import Teacher from "../models/Teacher.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import Attendance from "../models/Attendance.js"
import AcademicRecord from "../models/AcademicRecord.js"

const assignmentKey = (classSectionId, subjectId, session) =>
    JSON.stringify([String(classSectionId), String(subjectId), session])

export const getTeacherSubjects = async (req, res) => {
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

        const classesById = new Map()
        const subjectsById = new Map()
        const activeAssignmentKeys = new Set()
        const assignmentsBySubject = new Map()
        const assignmentTuplesBySubject = new Map()

        for (const assignment of assignments) {
            const cls = assignment.classSection
            const subject = assignment.subject
            if (!cls?._id || !subject?._id) continue

            const classId = String(cls._id)
            const subjectId = String(subject._id)
            const key = assignmentKey(cls._id, subject._id, assignment.session)
            activeAssignmentKeys.add(key)

            if (!classesById.has(classId)) {
                classesById.set(classId, {
                    _id: cls._id,
                    name: cls.name,
                    section: cls.section,
                    semester: cls.semester,
                })
            }

            if (!subjectsById.has(subjectId)) {
                subjectsById.set(subjectId, {
                    _id: subject._id,
                    name: subject.name,
                    code: subject.code,
                    creditHours: subject.creditHours,
                    department: subject.department?.name,
                    departmentCode: subject.department?.code,
                    program: subject.program?.name,
                    classes: new Map(),
                    assignmentKeys: new Set(),
                })
            }

            const subjectEntry = subjectsById.get(subjectId)
            subjectEntry.classes.set(classId, {
                classId: cls._id,
                className: cls.name,
                section: cls.section,
                semester: cls.semester,
                program: cls.program?.name,
                programId: cls.program?._id,
            })
            subjectEntry.assignmentKeys.add(key)

            if (!assignmentsBySubject.has(subjectId)) {
                assignmentsBySubject.set(subjectId, new Map())
            }
            if (!assignmentsBySubject.get(subjectId).has(classId)) {
                assignmentsBySubject.get(subjectId).set(classId, new Set())
            }
            assignmentsBySubject.get(subjectId).get(classId).add(key)

            if (!assignmentTuplesBySubject.has(subjectId)) {
                assignmentTuplesBySubject.set(subjectId, new Map())
            }
            assignmentTuplesBySubject.get(subjectId).set(key, {
                classSection: cls._id,
                subject: subject._id,
                session: assignment.session,
            })
        }

        const classIds = [...classesById.values()].map(cls => cls._id)
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const [attendanceTotals, todayAttendance, academicRecords] = classIds.length
            ? await Promise.all([
                Attendance.aggregate([
                    { $match: { teacher: teacher._id, classSection: { $in: classIds } } },
                    {
                        $group: {
                            _id: {
                                classSection: "$classSection",
                                subject: "$subject",
                                session: "$session",
                            },
                            total: { $sum: 1 },
                            present: {
                                $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
                            },
                        },
                    },
                ]),
                Attendance.aggregate([
                    {
                        $match: {
                            teacher: teacher._id,
                            classSection: { $in: classIds },
                            date: { $gte: todayStart, $lte: todayEnd },
                        },
                    },
                    {
                        $group: {
                            _id: {
                                classSection: "$classSection",
                                subject: "$subject",
                                session: "$session",
                            },
                        },
                    },
                ]),
                AcademicRecord.find({
                    teacher: teacher._id,
                    classSection: { $in: classIds },
                })
                    .select("classSection subject session")
                    .lean(),
            ])
            : [[], [], []]

        const attendanceByKey = new Map()
        for (const record of attendanceTotals) {
            const key = assignmentKey(
                record._id.classSection,
                record._id.subject,
                record._id.session
            )
            if (!activeAssignmentKeys.has(key)) continue
            attendanceByKey.set(key, { total: record.total, present: record.present })
        }

        const todayAttendanceKeys = new Set(todayAttendance
            .map(record => assignmentKey(
                record._id.classSection,
                record._id.subject,
                record._id.session
            ))
            .filter(key => activeAssignmentKeys.has(key)))
        const recordsByKey = new Map()
        for (const record of academicRecords) {
            const key = assignmentKey(record.classSection, record.subject, record.session)
            if (activeAssignmentKeys.has(key)) {
                recordsByKey.set(key, (recordsByKey.get(key) || 0) + 1)
            }
        }

        const subjects = await Promise.all([...subjectsById.values()].map(async subject => {
            const subjectId = String(subject._id)
            const classAssignments = assignmentsBySubject.get(subjectId) || new Map()
            const subjectKeys = subject.assignmentKeys
            const assignmentConditions = [...(
                assignmentTuplesBySubject.get(subjectId)?.values() || []
            )]
            const subjectAttendance = [...subjectKeys].reduce((totals, key) => {
                const counts = attendanceByKey.get(key)
                if (counts) {
                    totals.total += counts.total
                    totals.present += counts.present
                }
                return totals
            }, { total: 0, present: 0 })

            const attendancePendingClasses = [...classAssignments.values()].filter(
                keys => [...keys].some(key => !todayAttendanceKeys.has(key))
            ).length
            const totalRecords = [...subjectKeys].reduce(
                (total, key) => total + (recordsByKey.get(key) || 0),
                0
            )
            const avgAttPct = subjectAttendance.total > 0
                ? Math.round((subjectAttendance.present / subjectAttendance.total) * 100)
                : null
            const [recentRecords, recentAttendance] = await Promise.all([
                AcademicRecord.find({ teacher: teacher._id, $or: assignmentConditions })
                    .sort({ createdAt: -1 }).limit(3)
                    .populate("classSection", "name section")
                    .populate("student", "name rollNo"),
                Attendance.find({ teacher: teacher._id, $or: assignmentConditions })
                    .sort({ createdAt: -1 }).limit(3)
                    .populate("classSection", "name section"),
            ])
            const recentActivity = [
                ...recentRecords.map(record => ({
                    icon: "📝",
                    message: `Marks entered for ${record.student?.name || "a student"}`,
                    meta: `${record.classSection?.name || ""} ${record.classSection?.section || ""} · ${record.examType} · ${record.marks} marks`,
                    time: record.createdAt,
                })),
                ...recentAttendance.map(record => ({
                    icon: "📅",
                    message: "Attendance marked",
                    meta: `${record.classSection?.name || ""} ${record.classSection?.section || ""} · ${new Date(record.date).toLocaleDateString()}`,
                    time: record.createdAt,
                })),
            ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)

            return {
                _id: subject._id,
                name: subject.name,
                code: subject.code,
                creditHours: subject.creditHours,
                department: subject.department,
                departmentCode: subject.departmentCode,
                program: subject.program,
                classes: [...subject.classes.values()].map(cls => ({
                    ...cls,
                    studentCount: null,
                })),
                totalStudents: null,
                avgAttPct,
                totalRecords,
                pendingMarks: null,
                attendancePendingClasses,
                resultStatus: null,
                subjectStatus: attendancePendingClasses > 0 ? "Attention Required" : "Active",
                recentActivity,
            }
        }))

        const stats = {
            totalSubjects: subjects.length,
            totalClasses: classesById.size,
            totalStudents: null,
            totalPendingMarks: null,
            totalAttPending: subjects.reduce(
                (total, subject) => total + subject.attendancePendingClasses,
                0
            ),
            resultsPending: null,
        }

        return res.status(200).json({ stats, subjects })
    } catch (error) {
        return res.status(500).json({ message: "Server Error", error: error.message })
    }
}
