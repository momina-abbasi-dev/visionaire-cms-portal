import mongoose from "mongoose"
import User           from "../models/User.js"
import Teacher        from "../models/Teacher.js"
import Student        from "../models/Student.js"
import ClassSection   from "../models/ClassSection.js"
import Attendance     from "../models/Attendance.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import AcademicSession from "../models/AcademicSession.js"
import StudentEnrollment from "../models/StudentEnrollment.js"
import {
    acquireStudentWriteFence,
    isTransactionWriteConflict,
} from "../utils/studentWriteFence.js"

// ── helpers ────────────────────────────────────────────────────────────────────
const todayBounds = () => {
    const s = new Date()
    s.setUTCHours(0, 0, 0, 0)
    const e = new Date(s.getTime() + 24 * 60 * 60 * 1000 - 1)
    return { todayStart: s, todayEnd: e }
}

const parseDateOnly = (dateStr) => {
    if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return null
    }

    const [year, month, day] = dateStr.split("-").map(Number)
    if (year < 1) return null

    const date = new Date(0)
    date.setUTCHours(0, 0, 0, 0)
    date.setUTCFullYear(year, month - 1, day)
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }
    return date
}

const dateBounds = (dateStr) => {
    const start = parseDateOnly(dateStr)
    if (!start) return null
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
    return { start, end }
}

const qualifyingEnrollmentFilter = (studentIds, classId, academicSessionId, date) => ({
    ...(studentIds ? { student: { $in: studentIds } } : {}),
    classSection: classId,
    academicSession: academicSessionId,
    startDate: { $lte: date },
    $or: [
        { status: "active" },
        {
            status: { $in: ["completed", "withdrawn", "transferred"] },
            endDate: { $gte: date },
        },
    ],
})

const getActiveAssignment = (teacherId, classId, subjectId, session) =>
    AcademicAssignment.findOne({
        teacher: teacherId,
        classSection: classId,
        subject: subjectId,
        session,
        isActive: true,
    }).populate({
        path: "classSection",
        select: "name section semester program",
        populate: { path: "program", select: "name" },
    })

const assignmentKey = (classSection, subject, session) =>
    JSON.stringify([String(classSection), String(subject), session])


// ══════════════════════════════════════════════════════════════════════════════
//  GET ATTENDANCE PAGE DATA — summary cards + assigned classes/subjects
// ══════════════════════════════════════════════════════════════════════════════

export const getAttendancePageData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const teacher = await Teacher.findById(teacherId).select("role name")
        if (!teacher) return res.status(404).json({ message: "Teacher profile not found." })

        const assignments = await AcademicAssignment.find({
            teacher: teacherId,
            isActive: true,
        })
            .populate({
                path: "classSection",
                select: "name section semester program",
                populate: { path: "program", select: "name" },
            })
            .populate("subject", "name code")
            .lean()

        const classesById = new Map()
        const subjectsById = new Map()
        const assignmentTuples = new Map()
        for (const assignment of assignments) {
            const cls = assignment.classSection
            const subject = assignment.subject
            if (!cls?._id || !subject?._id || !assignment.session) continue

            const classId = String(cls._id)
            const subjectId = String(subject._id)
            const key = assignmentKey(cls._id, subject._id, assignment.session)
            assignmentTuples.set(key, {
                classId: cls._id,
                subjectId: subject._id,
                session: assignment.session,
                className: cls.name,
                section: cls.section,
                subjectName: subject.name,
                subjectCode: subject.code,
            })

            if (!classesById.has(classId)) {
                classesById.set(classId, {
                    _id: cls._id,
                    name: cls.name,
                    section: cls.section,
                    semester: cls.semester,
                    program: cls.program?.name,
                    subjects: new Map(),
                })
            }
            classesById.get(classId).subjects.set(subjectId, {
                _id: subject._id,
                name: subject.name,
                code: subject.code,
            })
            if (!subjectsById.has(subjectId)) {
                subjectsById.set(subjectId, {
                    _id: subject._id,
                    name: subject.name,
                    code: subject.code,
                })
            }
        }

        const classes = [...classesById.values()]
        const classIds = classes.map(cls => cls._id)
        const tupleConditions = [...assignmentTuples.values()].map(tuple => ({
            classSection: tuple.classId,
            subject: tuple.subjectId,
            session: tuple.session,
        }))

        // ── today stats ────────────────────────────────────────────────────────
        const { todayStart, todayEnd } = todayBounds()

        // classes that have attendance submitted today
        const todayAttendance = tupleConditions.length
            ? await Attendance.find({
                teacher: teacherId,
                date: { $gte: todayStart, $lte: todayEnd },
                $or: tupleConditions,
            }).select("classSection subject session").lean()
            : []
        const submittedTupleKeys = new Set(todayAttendance.map(record =>
            assignmentKey(record.classSection, record.subject, record.session)
        ))
        const submittedToday = submittedTupleKeys.size
        const pendingToday = Math.max(0, assignmentTuples.size - submittedToday)
        const allSubjects = [...subjectsById.values()]

        // ── recent activity ────────────────────────────────────────────────────
        const recentActivity = await Attendance.aggregate([
            { $match: { teacher: teacherId } },
            { $sort:  { createdAt: -1 } },
            {
                $group: {
                    _id:          { classSection: "$classSection", subject: "$subject", session: "$session", date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } } },
                    date:         { $first: "$date" },
                    classSection: { $first: "$classSection" },
                    subject:      { $first: "$subject" },
                    session:      { $first: "$session" },
                    submittedAt:  { $first: "$createdAt" },
                    totalCount:   { $sum: 1 },
                    presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
                }
            },
            { $sort: { submittedAt: -1 } },
            { $limit: 20 },
        ])

        // populate classSection and subject names
        await ClassSection.populate(recentActivity, { path: "_id.classSection", select: "name section" })
        await ClassSection.populate(recentActivity, { path: "classSection",     select: "name section" })

        res.status(200).json({
            teacher: {
                _id:  teacher._id,
                name: teacher.name,
                role: teacher.role,   // "junior" | "senior" — determines edit permission
            },
            stats: {
                totalClasses:    classIds.length,
                totalSubjects:   allSubjects.length,
                submittedToday,
                pendingToday,
            },
            classes: classes.map(c => ({
                _id:      c._id,
                name:     c.name,
                section:  c.section,
                semester: c.semester,
                program:  c.program,
                subjects: [...c.subjects.values()],
            })),
            subjects: allSubjects,
            assignments: [...assignmentTuples.values()],
            recentActivity,
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  LOAD STUDENTS FOR ATTENDANCE — checks if already submitted
// ══════════════════════════════════════════════════════════════════════════════

export const loadStudentsForAttendance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, session, date } = req.query
        if (!classId || !subjectId || !session || !date) {
            return res.status(400).json({ message: "classId, subjectId, session, and date are required." })
        }

        const assignment = await getActiveAssignment(teacherId, classId, subjectId, session)
        if (!assignment?.classSection?._id) {
            return res.status(403).json({ message: "Assignment not found or inactive." })
        }
        const cls = assignment.classSection

        const academicSession = await AcademicSession.findOne({ name: session })
            .select("_id startDate endDate")
        if (!academicSession) {
            return res.status(400).json({ message: "Academic session for this assignment was not found." })
        }

        // ── check if attendance already submitted for this date ────────────────
        const bounds = dateBounds(date)
        if (!bounds) {
            return res.status(400).json({ message: "A valid attendance date in YYYY-MM-DD format is required." })
        }
        const { start, end } = bounds
        if (start < academicSession.startDate || start > academicSession.endDate) {
            return res.status(400).json({ message: "Attendance date must be within the AcademicSession boundaries." })
        }
        const existing = await Attendance.find({
            teacher:      teacherId,
            classSection: classId,
            subject:      subjectId,
            session,
            date:         { $gte: start, $lte: end },
        }).populate("student", "name rollNo image")

        const alreadySubmitted = existing.length > 0

        // ── get students from this program ─────────────────────────────────────
        const eligibleStudentIds = await StudentEnrollment.distinct(
            "student",
            qualifyingEnrollmentFilter(null, classId, academicSession._id, start)
        )
        const students = eligibleStudentIds.length
            ? await Student.find({
                _id: { $in: eligibleStudentIds },
                program: cls.program?._id,
                status: "active",
            }).select("name rollNo email image").sort({ name: 1 })
            : []

        // ── if already submitted, return existing records ──────────────────────
        if (alreadySubmitted) {
            const submittedMap = {}
            for (const rec of existing) {
                const sid = rec.student?._id?.toString() || rec.student?.toString()
                submittedMap[sid] = { status: rec.status, remarks: rec.remarks || "", _id: rec._id }
            }

            return res.status(200).json({
                alreadySubmitted: true,
                session: {
                    className:   cls.name,
                    section:     cls.section,
                    date,
                    totalCount:   existing.length,
                    presentCount: existing.filter(r => r.status === "present").length,
                    absentCount:  existing.filter(r => r.status === "absent").length,
                    lateCount:    existing.filter(r => r.status === "late").length,
                },
                students: students.map(s => ({
                    _id:     s._id,
                    name:    s.name,
                    rollNo:  s.rollNo,
                    image:   s.image,
                    status:  submittedMap[s._id.toString()]?.status  || "absent",
                    remarks: submittedMap[s._id.toString()]?.remarks || "",
                    recordId:submittedMap[s._id.toString()]?._id     || null,
                })),
            })
        }

        // ── not submitted — return fresh list defaulting to present ────────────
        res.status(200).json({
            alreadySubmitted: false,
            session: null,
            students: students.map(s => ({
                _id:      s._id,
                name:     s.name,
                rollNo:   s.rollNo,
                image:    s.image,
                status:   "present",   // default
                remarks:  "",
                recordId: null,
            })),
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  SUBMIT ATTENDANCE — bulk create attendance records
// ══════════════════════════════════════════════════════════════════════════════

export const submitAttendance = async (req, res) => {
    let transactionSession

    try {
        const { classId, subjectId, date, session, records } = req.body
        if (!classId || !subjectId || !session || !date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: "classId, subjectId, session, date, and records are required." })
        }

        const parsedDate = parseDateOnly(date)
        if (!parsedDate) {
            return res.status(400).json({ message: "A valid attendance date in YYYY-MM-DD format is required." })
        }

        const invalidRecord = records.find((record) =>
            !record ||
            typeof record !== "object" ||
            !mongoose.isValidObjectId(record.studentId) ||
            (record.status !== undefined &&
                !["present", "absent", "late"].includes(record.status))
        )
        if (invalidRecord) {
            return res.status(400).json({
                message: "Every attendance record must contain a valid student ID and status.",
            })
        }

        const studentIds = [...new Set(
            records.map((record) => record.studentId.toString())
        )].sort()
        const { start, end } = dateBounds(date)
        const attendanceDate = parsedDate

        transactionSession = await mongoose.startSession()
        await transactionSession.withTransaction(async () => {
            const user = await User.findById(req.user.id).session(transactionSession)
            if (!user?.teacherId) {
                throw Object.assign(new Error("Teacher profile not linked."), {
                    statusCode: 404,
                })
            }
            const teacherId = user.teacherId

            const assignment = await getActiveAssignment(
                teacherId,
                classId,
                subjectId,
                session
            ).session(transactionSession)
            if (!assignment?.classSection?._id) {
                throw Object.assign(
                    new Error("Assignment not found or inactive."),
                    { statusCode: 403 }
                )
            }

            const academicSession = await AcademicSession.findOne({ name: session })
                .select("_id startDate endDate")
                .session(transactionSession)
            if (!academicSession) {
                throw Object.assign(
                    new Error("Academic session for this assignment was not found."),
                    { statusCode: 400 }
                )
            }
            if (
                attendanceDate < academicSession.startDate ||
                attendanceDate > academicSession.endDate
            ) {
                throw Object.assign(
                    new Error("Attendance date must be within the AcademicSession boundaries."),
                    { statusCode: 400 }
                )
            }

            const assignedProgramId =
                assignment.classSection.program?._id?.toString()
            const requestedStudents = await Student.find({
                _id: { $in: studentIds },
            })
                .select("_id program status")
                .session(transactionSession)
            if (requestedStudents.length !== studentIds.length) {
                throw Object.assign(new Error("Student not found."), {
                    statusCode: 404,
                })
            }
            if (
                !assignedProgramId ||
                requestedStudents.some((student) =>
                    student.status !== "active" ||
                    student.program.toString() !== assignedProgramId
                )
            ) {
                throw Object.assign(
                    new Error("Student is not eligible for this class."),
                    { statusCode: 400 }
                )
            }

            const fencedStudents = new Map()
            for (const studentId of studentIds) {
                const student = await acquireStudentWriteFence(
                    studentId,
                    transactionSession
                )
                if (!student) {
                    throw Object.assign(new Error("Student not found."), {
                        statusCode: 404,
                    })
                }
                if (
                    student.status !== "active" ||
                    student.program.toString() !== assignedProgramId
                ) {
                    throw Object.assign(
                        new Error("Student is not eligible for this class."),
                        { statusCode: 400 }
                    )
                }
                fencedStudents.set(studentId, student)
            }

            const enrolledStudentIds = new Set(
                (await StudentEnrollment.find(
                    qualifyingEnrollmentFilter(
                        studentIds,
                        classId,
                        academicSession._id,
                        attendanceDate
                    )
                )
                    .select("student")
                    .session(transactionSession))
                    .map((enrollment) => enrollment.student.toString())
            )
            if (studentIds.some((studentId) => !enrolledStudentIds.has(studentId))) {
                throw Object.assign(
                    new Error(
                        "Student does not have a valid enrollment in this class and academic session for the attendance date."
                    ),
                    { statusCode: 400 }
                )
            }

            const existing = await Attendance.find({
                teacher: teacherId,
                classSection: classId,
                subject: subjectId,
                session,
                date: { $gte: start, $lte: end },
            }).session(transactionSession)
            if (existing.length > 0) {
                throw Object.assign(
                    new Error(
                        "Attendance already submitted for this class, subject, and date."
                    ),
                    { statusCode: 400, alreadySubmitted: true }
                )
            }

            const attendanceDocs = records.map((record) => ({
                student: fencedStudents.get(record.studentId.toString())._id,
                teacher: teacherId,
                subject: subjectId,
                classSection: classId,
                session,
                date: attendanceDate,
                status: record.status || "present",
                remarks: record.remarks || "",
            }))

            await Attendance.insertMany(attendanceDocs, {
                session: transactionSession,
                ordered: true,
            })
        })

        const presentCount = records.filter(record => record.status === "present").length
        const absentCount  = records.filter(record => record.status === "absent").length
        const lateCount    = records.filter(record => record.status === "late").length

        res.status(201).json({
            message: "Attendance submitted successfully.",
            summary: {
                total:   records.length,
                present: presentCount,
                absent:  absentCount,
                late:    lateCount,
                pct:     Math.round((presentCount / records.length) * 100),
            },
        })
    } catch (error) {
        res.status(
            error.statusCode || (isTransactionWriteConflict(error) ? 409 : 500)
        ).json({
            message: error.message || "Server Error",
            ...(error.alreadySubmitted ? { alreadySubmitted: true } : {}),
        })
    } finally {
        if (transactionSession) await transactionSession.endSession()
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  UPDATE ATTENDANCE — senior teacher only, edit existing records
// ══════════════════════════════════════════════════════════════════════════════

export const updateAttendance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        // ── role check: only senior teachers can edit ──────────────────────────
        const teacher = await Teacher.findById(teacherId).select("role")
        if (!teacher) return res.status(404).json({ message: "Teacher profile not found." })
        if (teacher.role !== "senior") {
            return res.status(403).json({
                message: "Only senior teachers can edit submitted attendance."
            })
        }

        const { classId, subjectId, session, date, records } = req.body
        // records: [{ studentId, status, remarks }]

        if (!classId || !subjectId || !session || !date || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: "classId, subjectId, session, date, and records are required." })
        }
        if (records.some((record) =>
            !record ||
            typeof record !== "object" ||
            !mongoose.isValidObjectId(record.studentId) ||
            !["present", "absent", "late"].includes(record.status) ||
            (record.remarks !== undefined && typeof record.remarks !== "string")
        )) {
            return res.status(400).json({
                message: "Every attendance record must contain a valid student ID and status.",
            })
        }

        const assignment = await getActiveAssignment(teacherId, classId, subjectId, session)
        if (!assignment) return res.status(403).json({ message: "Assignment not found or inactive." })

        const bounds = dateBounds(date)
        if (!bounds) {
            return res.status(400).json({ message: "A valid attendance date in YYYY-MM-DD format is required." })
        }
        const { start, end } = bounds

        // ── update each record ─────────────────────────────────────────────────
        const updates = await Promise.all(records.map(r =>
            Attendance.findOneAndUpdate(
                {
                    teacher:      teacherId,
                    classSection: classId,
                    subject:      subjectId,
                    session,
                    student:      r.studentId,
                    date:         { $gte: start, $lte: end },
                },
                {
                    $set: {
                        status: r.status,
                        ...(r.remarks === undefined ? {} : { remarks: r.remarks }),
                    },
                },
                { new: true, upsert: false, runValidators: true }
            )
        ))

        const updated = updates.filter(Boolean)

        res.status(200).json({
            message:      `${updated.length} attendance record(s) updated successfully.`,
            updatedCount: updated.length,
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  GET ATTENDANCE HISTORY — paginated list of past sessions
// ══════════════════════════════════════════════════════════════════════════════

export const getAttendanceHistory = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, page = 1, limit = 10 } = req.query

        const matchStage = { teacher: teacherId }
        if (classId   && classId   !== "All") matchStage.classSection = classId
        if (subjectId && subjectId !== "All") matchStage.subject      = subjectId

        // ── group by class + subject + date ────────────────────────────────────
        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        classSection: "$classSection",
                        subject:      "$subject",
                        session:      "$session",
                        date:         { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    },
                    date:         { $first: "$date" },
                    classSection: { $first: "$classSection" },
                    subject:      { $first: "$subject" },
                    session:      { $first: "$session" },
                    submittedAt:  { $first: "$createdAt" },
                    totalCount:   { $sum: 1 },
                    presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
                    absentCount:  { $sum: { $cond: [{ $eq: ["$status", "absent"]  }, 1, 0] } },
                    lateCount:    { $sum: { $cond: [{ $eq: ["$status", "late"]    }, 1, 0] } },
                }
            },
            { $sort: { date: -1 } },
            { $skip:  (Number(page) - 1) * Number(limit) },
            { $limit: Number(limit) },
        ]

        const countPipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        classSection: "$classSection",
                        subject:      "$subject",
                        session:      "$session",
                        date:         { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
                    }
                }
            },
            { $count: "total" },
        ]

        const [sessions, countResult] = await Promise.all([
            Attendance.aggregate(pipeline),
            Attendance.aggregate(countPipeline),
        ])

        // ── populate classSection + subject names ──────────────────────────────
        await ClassSection.populate(sessions, { path: "classSection", select: "name section" })

        // populate subject from Subject model
        const Subject = (await import("../models/Subject.js")).default
        await Subject.populate(sessions, { path: "subject", select: "name code" })

        const total = countResult[0]?.total || 0

        res.status(200).json({
            sessions: sessions.map(s => ({
                classId:      s.classSection?._id,
                className:    s.classSection?.name,
                section:      s.classSection?.section,
                subjectId:    s.subject?._id,
                subjectName:  s.subject?.name,
                date:         s.date,
                session:      s.session,
                submittedAt:  s.submittedAt,
                totalCount:   s.totalCount,
                presentCount: s.presentCount,
                absentCount:  s.absentCount,
                lateCount:    s.lateCount,
                pct:          s.totalCount > 0
                    ? Math.round((s.presentCount / s.totalCount) * 100) : 0,
            })),
            pagination: {
                total,
                page:  Number(page),
                pages: Math.ceil(total / Number(limit)),
            },
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  GET SESSION DETAIL — full student list for a specific session
// ══════════════════════════════════════════════════════════════════════════════

export const getSessionDetail = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, session, date } = req.query
        if (!classId || !subjectId || !session || !date) {
            return res.status(400).json({ message: "classId, subjectId, session, and date are required." })
        }

        const bounds = dateBounds(date)
        if (!bounds) {
            return res.status(400).json({ message: "A valid attendance date in YYYY-MM-DD format is required." })
        }
        const { start, end } = bounds

        const records = await Attendance.find({
            teacher:      teacherId,
            classSection: classId,
            subject:      subjectId,
            session,
            date:         { $gte: start, $lte: end },
        }).populate("student", "name rollNo image email")

        if (records.length === 0) {
            return res.status(404).json({ message: "No attendance records found for this session." })
        }

        const presentCount = records.filter(r => r.status === "present").length
        const absentCount  = records.filter(r => r.status === "absent").length
        const lateCount    = records.filter(r => r.status === "late").length

        res.status(200).json({
            records: records.map(r => ({
                recordId: r._id,
                student:  { _id: r.student?._id, name: r.student?.name, rollNo: r.student?.rollNo, image: r.student?.image },
                status:   r.status,
                remarks:  r.remarks || "",
                date:     r.date,
            })),
            summary: {
                total:   records.length,
                present: presentCount,
                absent:  absentCount,
                late:    lateCount,
                pct:     Math.round((presentCount / records.length) * 100),
            },
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}