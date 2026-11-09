import mongoose from "mongoose"
import User           from "../models/User.js"
import Teacher        from "../models/Teacher.js"
import Student        from "../models/Student.js"
import ClassSection   from "../models/ClassSection.js"
import Department     from "../models/Department.js"
import Program        from "../models/Program.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Subject        from "../models/Subject.js"
import Result         from "../models/Result.js"
import {
    acquireStudentWriteFence,
    isTransactionWriteConflict,
} from "../utils/studentWriteFence.js"

// ── exam type max marks config ─────────────────────────────────────────────────
export const EXAM_MAX_MARKS = {
    quiz:       10,
    assignment: 20,
    practical:  25,
    midterm:    30,
    final:      50,
}

// ── helpers ────────────────────────────────────────────────────────────────────
const assignmentRecordFilter = (teacherId, assignments, extra = {}) => ({
    teacher: teacherId,
    ...(assignments.length
        ? {
            $or: assignments.map(assignment => ({
                classSection: assignment.classSection,
                subject: assignment.subject,
                session: assignment.session,
            })),
        }
        : { _id: { $in: [] } }),
    ...extra,
})


// ══════════════════════════════════════════════════════════════════════════════
//  GET ACADEMIC RECORDS PAGE DATA — summary cards + classes + subjects
// ══════════════════════════════════════════════════════════════════════════════

export const getAcademicRecordsPageData = async (req, res) => {
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
        const subjectMap = new Map()
        const assignmentTuples = []
        for (const assignment of assignments) {
            const cls = assignment.classSection
            const subject = assignment.subject
            if (!cls?._id || !subject?._id) continue

            const tuple = {
                classSection: cls._id,
                subject: subject._id,
                session: assignment.session,
            }
            assignmentTuples.push(tuple)

            const classId = cls._id.toString()
            const subjectId = subject._id.toString()
            if (!classesById.has(classId)) {
                classesById.set(classId, {
                    _id: cls._id,
                    name: cls.name,
                    section: cls.section,
                    semester: cls.semester,
                    program: cls.program?.name,
                    programId: cls.program?._id,
                    subjects: new Map(),
                })
            }
            const subjectInfo = {
                _id: subject._id,
                name: subject.name,
                code: subject.code,
            }
            classesById.get(classId).subjects.set(subjectId, subjectInfo)
            subjectMap.set(subjectId, subjectInfo)
        }
        const classes = [...classesById.values()].map(cls => ({
            ...cls,
            subjects: [...cls.subjects.values()],
        }))
        const allSubjects = [...subjectMap.values()]
        const classIds = classes.map(cls => cls._id)

        // ── stats ──────────────────────────────────────────────────────────────
        const [submittedCount, draftCount] = await Promise.all([
            AcademicRecord.countDocuments(assignmentRecordFilter(
                teacherId,
                assignmentTuples,
                { status: "verified" }
            )),
            AcademicRecord.countDocuments(assignmentRecordFilter(
                teacherId,
                assignmentTuples,
                { status: "pending" }
            )),
        ])

        // total students across all classes
        const programIds = [...new Set(
            classes.map(cls => cls.programId?.toString()).filter(Boolean)
        )]
        const totalStudents = await Student.countDocuments({
            program: { $in: programIds }, status: "active"
        })

        // classes ready for result generation
        // (all students in class have at least one verified midterm + final record)
        let readyForResult = 0
        for (const cls of classes) {
            const programStudents = await Student.countDocuments({
                program: cls.programId, status: "active"
            })
            const classAssignments = assignmentTuples.filter(
                assignment =>
                    assignment.classSection.toString() === cls._id.toString()
            )
            const studentsWithFinal = await AcademicRecord.distinct(
                "student",
                assignmentRecordFilter(teacherId, classAssignments, {
                    examType: "final",
                    status: "verified",
                })
            )
            if (programStudents > 0 && studentsWithFinal.length >= programStudents) {
                readyForResult++
            }
        }

        // pending records — students with no records at all from this teacher
        const recordedStudents = await AcademicRecord.distinct(
            "student",
            assignmentRecordFilter(teacherId, assignmentTuples)
        )
        const pendingRecords = Math.max(0, totalStudents - recordedStudents.length)

        // ── recent submitted records ───────────────────────────────────────────
        const recentRecords = await AcademicRecord.find(
            assignmentRecordFilter(teacherId, assignmentTuples)
        )
            .sort({ createdAt: -1 }).limit(20)
            .populate("student",      "name rollNo")
            .populate("subject",      "name code")
            .populate("classSection", "name section")

        res.status(200).json({
            teacher: {
                _id:  teacher._id,
                name: teacher.name,
                role: teacher.role,
            },
            stats: {
                totalClasses:    classIds.length,
                totalSubjects:   allSubjects.length,
                totalStudents,
                submittedCount,
                draftCount,
                pendingRecords,
                readyForResult,
            },
            classes,
            subjects:     allSubjects,
            examMaxMarks: EXAM_MAX_MARKS,
            recentRecords: recentRecords.map(r => ({
                _id:         r._id,
                studentName: r.student?.name,
                studentRoll: r.student?.rollNo,
                subjectName: r.subject?.name,
                subjectCode: r.subject?.code,
                className:   r.classSection?.name,
                section:     r.classSection?.section,
                examType:    r.examType,
                marks:       r.marks,
                status:      r.status,
                remarks:     r.remarks,
                createdAt:   r.createdAt,
            })),
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  LOAD STUDENTS FOR MARKS ENTRY
// ══════════════════════════════════════════════════════════════════════════════

export const loadStudentsForMarks = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, examType, session } = req.query
        if (!classId || !subjectId || !examType || !session) {
            return res.status(400).json({ message: "classId, subjectId, examType, and session are required." })
        }
        if (
            !mongoose.Types.ObjectId.isValid(classId) ||
            !mongoose.Types.ObjectId.isValid(subjectId) ||
            typeof session !== "string" ||
            !session.trim() ||
            session.trim().length > 100
        ) {
            return res.status(400).json({ message: "A valid classId, subjectId, and session are required." })
        }
        if (EXAM_MAX_MARKS[examType] === undefined) {
            return res.status(400).json({ message: "Invalid exam type." })
        }

        const assignment = await AcademicAssignment.findOne({
            teacher: teacherId,
            classSection: classId,
            subject: subjectId,
            session: session.trim(),
            isActive: true,
        })
        if (!assignment) {
            return res.status(403).json({ message: "Active academic assignment not found." })
        }

        const cls = await ClassSection.findById(classId).select("program")
        if (!cls?.program) {
            return res.status(404).json({ message: "Class or its Program was not found." })
        }

        // ── get students ───────────────────────────────────────────────────────
        const students = await Student.find({
            program: cls.program, status: "active"
        }).select("name rollNo email image").sort({ name: 1 })

        // ── get existing records for this class + subject + examType ───────────
        const existingRecords = await AcademicRecord.find({
            teacher:      teacherId,
            classSection: classId,
            subject:      subjectId,
            examType,
            session:      session.trim(),
        }).select("student marks remarks status")

        const recordMap = {}
        for (const r of existingRecords) {
            const sid = r.student.toString()
            recordMap[sid] = {
                recordId: r._id,
                marks:    r.marks,
                remarks:  r.remarks || "",
                status:   r.status,
            }
        }

        const maxMarks = EXAM_MAX_MARKS[examType] || 100

        res.status(200).json({
            students: students.map(s => ({
                _id:      s._id,
                name:     s.name,
                rollNo:   s.rollNo,
                image:    s.image,
                // pre-fill if record exists
                recordId: recordMap[s._id.toString()]?.recordId || null,
                marks:    recordMap[s._id.toString()]?.marks    ?? "",
                remarks:  recordMap[s._id.toString()]?.remarks  || "",
                status:   recordMap[s._id.toString()]?.status   || "new",
            })),
            maxMarks,
            examType,
            hasExisting: existingRecords.length > 0,
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  SAVE / SUBMIT ACADEMIC RECORDS — upsert per student
// ══════════════════════════════════════════════════════════════════════════════

export const saveAcademicRecords = async (req, res) => {
    let transactionSession

    try {
        const { classId, subjectId, examType, session, records, submitMode } = req.body

        if (
            !classId ||
            !subjectId ||
            !examType ||
            typeof session !== "string" ||
            !session.trim() ||
            session.trim().length > 100 ||
            !Array.isArray(records) ||
            records.length === 0
        ) {
            return res.status(400).json({
                message: "classId, subjectId, examType, session, and records are required."
            })
        }

        if (
            !mongoose.Types.ObjectId.isValid(classId) ||
            !mongoose.Types.ObjectId.isValid(subjectId)
        ) {
            return res.status(400).json({ message: "classId or subjectId is invalid." })
        }

        const maxMarks = EXAM_MAX_MARKS[examType]
        if (maxMarks === undefined) {
            return res.status(400).json({ message: "Invalid exam type." })
        }

        const studentIds = []
        const seenStudentIds = new Set()
        const invalidMarks = []
        for (const record of records) {
            if (!record || typeof record !== "object" || Array.isArray(record)) {
                return res.status(400).json({ message: "Each record must be an object." })
            }
            if (
                typeof record.studentId !== "string" ||
                !mongoose.Types.ObjectId.isValid(record.studentId)
            ) {
                return res.status(400).json({
                    message: "Each record must contain a valid studentId.",
                })
            }
            const studentId = new mongoose.Types.ObjectId(record.studentId).toString()
            if (seenStudentIds.has(studentId)) {
                return res.status(400).json({
                    message: "Duplicate Student IDs are not allowed in a batch.",
                })
            }
            seenStudentIds.add(studentId)
            studentIds.push(studentId)

            const marks = Number(record.marks)
            if (
                record.marks === undefined ||
                record.marks === null ||
                record.marks === "" ||
                !Number.isFinite(marks) ||
                marks < 0 ||
                marks > maxMarks
            ) {
                invalidMarks.push(record.studentId)
            }
            if (
                record.remarks !== undefined &&
                (typeof record.remarks !== "string" || record.remarks.length > 1000)
            ) {
                return res.status(400).json({
                    message: "Remarks must be text of no more than 1000 characters.",
                })
            }
        }

        if (invalidMarks.length > 0) {
            return res.status(400).json({
                message: `Invalid marks detected. Maximum allowed for ${examType} is ${maxMarks}.`,
                invalidStudents: invalidMarks,
            })
        }

        const normalizedSession = session.trim()
        const sortedStudentIds = [...studentIds].sort()
        const targetStatus = submitMode === "submit" ? "verified" : "pending"
        let savedCount = 0

        transactionSession = await mongoose.startSession()
        await transactionSession.withTransaction(async () => {
            savedCount = 0
            const user = await User.findById(req.user.id).session(transactionSession)
            if (!user?.teacherId) {
                throw Object.assign(new Error("Teacher profile not linked."), {
                    statusCode: 404,
                })
            }
            const teacherId = user.teacherId
            const teacher = await Teacher.findById(teacherId)
                .session(transactionSession)
            if (!teacher) {
                throw Object.assign(new Error("Teacher profile not found."), {
                    statusCode: 404,
                })
            }

            const classSection = await ClassSection.findById(classId)
                .session(transactionSession)
            if (
                !classSection ||
                !classSection.program ||
                !classSection.department
            ) {
                throw Object.assign(
                    new Error("Class or its required references were not found."),
                    { statusCode: 404 }
                )
            }

            const program = await Program.findById(classSection.program)
                .session(transactionSession)
            const department = await Department.findById(classSection.department)
                .session(transactionSession)
            if (!program || !department) {
                throw Object.assign(
                    new Error("Class or its required references were not found."),
                    { statusCode: 404 }
                )
            }
            const subject = await Subject.findById(subjectId)
                .session(transactionSession)
            if (!subject) {
                throw Object.assign(new Error("Subject not found."), {
                    statusCode: 404,
                })
            }

            const assignment = await AcademicAssignment.findOne({
                teacher: teacherId,
                subject: subjectId,
                classSection: classId,
                session: normalizedSession,
                isActive: true,
            }).session(transactionSession)
            if (!assignment) {
                throw Object.assign(
                    new Error("Class or active academic assignment not found."),
                    { statusCode: 403 }
                )
            }

            const requestedStudents = await Student.find({
                _id: { $in: sortedStudentIds },
            }).session(transactionSession)
            if (requestedStudents.length !== sortedStudentIds.length) {
                throw Object.assign(new Error("One or more Students were not found."), {
                    statusCode: 404,
                })
            }
            const requestedStudentMap = new Map(
                requestedStudents.map(student => [student._id.toString(), student])
            )
            for (const studentId of sortedStudentIds) {
                const student = requestedStudentMap.get(studentId)
                if (
                    student.status !== "active" ||
                    !student.program ||
                    student.program.toString() !== classSection.program.toString()
                ) {
                    throw Object.assign(
                        new Error("One or more Students are not eligible for this class."),
                        { statusCode: 400 }
                    )
                }
            }

            const lockedRecords = await AcademicRecord.find({
                teacher: teacherId,
                classSection: classId,
                subject: subjectId,
                examType,
                session: normalizedSession,
                student: { $in: sortedStudentIds },
                status: "verified",
            }).session(transactionSession)
            if (teacher.role !== "senior" && lockedRecords.length > 0) {
                throw Object.assign(
                    new Error("Only senior teachers can edit submitted records."),
                    {
                        statusCode: 403,
                        lockedCount: lockedRecords.length,
                    }
                )
            }

            for (const studentId of sortedStudentIds) {
                const student = await acquireStudentWriteFence(
                    studentId,
                    transactionSession
                )
                if (!student) {
                    throw Object.assign(
                        new Error("One or more Students were not found."),
                        { statusCode: 404 }
                    )
                }
                if (
                    student.status !== "active" ||
                    !student.program ||
                    student.program.toString() !== classSection.program.toString()
                ) {
                    throw Object.assign(
                        new Error("One or more Students are not eligible for this class."),
                        { statusCode: 400 }
                    )
                }
            }

            for (const record of records) {
                const filter = {
                    teacher: teacherId,
                    student: record.studentId,
                    classSection: classId,
                    subject: subjectId,
                    examType,
                    session: normalizedSession,
                }
                await AcademicRecord.findOneAndUpdate(
                    filter,
                    {
                        $set: {
                            marks: Number(record.marks),
                            remarks: record.remarks || "",
                            status: targetStatus,
                        },
                        $setOnInsert: {
                            teacher: teacherId,
                            student: record.studentId,
                            classSection: classId,
                            subject: subjectId,
                            examType,
                            session: normalizedSession,
                            createdBy: user._id,
                        },
                    },
                    {
                        upsert: true,
                        returnDocument: "after",
                        runValidators: true,
                        setDefaultsOnInsert: true,
                        session: transactionSession,
                    }
                )
                savedCount++
            }
        })

        const submittedCount = targetStatus === "verified" ? savedCount : 0
        return res.status(200).json({
            message: submitMode === "submit"
                ? `${savedCount} records submitted successfully.`
                : `${savedCount} records saved as draft.`,
            savedCount,
            submittedCount,
            status: targetStatus,
        })
    } catch (error) {
        const statusCode =
            error.statusCode ||
            (isTransactionWriteConflict(error) ? 409 : 500)
        const response = { message: error.statusCode ? error.message : "Server Error" }
        if (error.lockedCount !== undefined) {
            response.lockedCount = error.lockedCount
        }
        if (!error.statusCode) response.error = error.message
        return res.status(statusCode).json(response)
    } finally {
        if (transactionSession) await transactionSession.endSession()
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  GET SUBMITTED RECORDS — paginated history grouped by class+subject+examType
// ══════════════════════════════════════════════════════════════════════════════

export const getSubmittedRecords = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, examType, status, page = 1, limit = 10 } = req.query
        if (
            (classId && classId !== "All" && !mongoose.Types.ObjectId.isValid(classId)) ||
            (subjectId && subjectId !== "All" && !mongoose.Types.ObjectId.isValid(subjectId))
        ) {
            return res.status(400).json({ message: "Invalid classId or subjectId filter." })
        }

        const activeAssignments = await AcademicAssignment.find({
            teacher: teacherId,
            isActive: true,
        }).select("classSection subject session").lean()
        const assignments = activeAssignments.filter(assignment =>
            (!classId || classId === "All" ||
                assignment.classSection.toString() === classId) &&
            (!subjectId || subjectId === "All" ||
                assignment.subject.toString() === subjectId)
        )
        const matchStage = assignmentRecordFilter(teacherId, assignments)
        if (examType && examType !== "All") matchStage.examType = examType
        if (status && status !== "All") matchStage.status = status

        // ── group by class + subject + examType ────────────────────────────────
        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        classSection: "$classSection",
                        subject:      "$subject",
                        examType:     "$examType",
                        session:      "$session",
                    },
                    classSection:  { $first: "$classSection" },
                    subject:       { $first: "$subject" },
                    examType:      { $first: "$examType" },
                    session:       { $first: "$session" },
                    status:        { $first: "$status" },
                    submittedAt:   { $max:   "$createdAt" },
                    updatedAt:     { $max:   "$updatedAt" },
                    totalCount:    { $sum: 1 },
                    avgMarks:      { $avg: "$marks" },
                    maxMarks:      { $max: "$marks" },
                    minMarks:      { $min: "$marks" },
                }
            },
            { $sort: { submittedAt: -1 } },
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
                        examType:     "$examType",
                        session:      "$session",
                    }
                }
            },
            { $count: "total" },
        ]

        const [groups, countResult] = await Promise.all([
            AcademicRecord.aggregate(pipeline),
            AcademicRecord.aggregate(countPipeline),
        ])

        // ── populate ───────────────────────────────────────────────────────────
        await ClassSection.populate(groups, { path:"classSection", select:"name section" })
        const Subject = (await import("../models/Subject.js")).default
        await Subject.populate(groups, { path:"subject", select:"name code" })

        const total = countResult[0]?.total || 0

        res.status(200).json({
            groups: groups.map(g => ({
                classId:     g.classSection?._id,
                className:   g.classSection?.name,
                section:     g.classSection?.section,
                subjectId:   g.subject?._id,
                subjectName: g.subject?.name,
                subjectCode: g.subject?.code,
                examType:    g.examType,
                session:     g.session,
                status:      g.status,
                submittedAt: g.submittedAt,
                totalCount:  g.totalCount,
                avgMarks:    g.avgMarks ? Math.round(g.avgMarks * 10) / 10 : null,
                maxMarks:    g.maxMarks,
                minMarks:    g.minMarks,
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
//  GET RECORD GROUP DETAIL — all student marks for one class+subject+examType
// ══════════════════════════════════════════════════════════════════════════════

export const getRecordGroupDetail = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { classId, subjectId, examType, session } = req.query
        if (!classId || !subjectId || !examType || !session) {
            return res.status(400).json({ message: "classId, subjectId, examType, and session are required." })
        }
        if (
            !mongoose.Types.ObjectId.isValid(classId) ||
            !mongoose.Types.ObjectId.isValid(subjectId) ||
            typeof session !== "string" ||
            !session.trim() ||
            session.trim().length > 100
        ) {
            return res.status(400).json({ message: "A valid classId, subjectId, and session are required." })
        }
        if (EXAM_MAX_MARKS[examType] === undefined) {
            return res.status(400).json({ message: "Invalid exam type." })
        }

        const assignment = await AcademicAssignment.findOne({
            teacher: teacherId,
            classSection: classId,
            subject: subjectId,
            session: session.trim(),
            isActive: true,
        })
        if (!assignment) {
            return res.status(403).json({ message: "Active academic assignment not found." })
        }

        const records = await AcademicRecord.find({
            teacher:      teacherId,
            classSection: classId,
            subject:      subjectId,
            examType,
            session:      session.trim(),
        })
            .populate("student",      "name rollNo image")
            .populate("classSection", "name section")
            .populate("subject",      "name code")
            .sort({ "student.name": 1 })

        if (records.length === 0) {
            return res.status(404).json({ message: "No records found for this group." })
        }

        const maxAllowed = EXAM_MAX_MARKS[examType] || 100
        const totalMarks = records.reduce((s, r) => s + r.marks, 0)
        const avgMarks   = records.length > 0
            ? Math.round((totalMarks / records.length) * 10) / 10 : 0

        res.status(200).json({
            records: records.map(r => ({
                recordId:   r._id,
                student: {
                    _id:    r.student?._id,
                    name:   r.student?.name,
                    rollNo: r.student?.rollNo,
                    image:  r.student?.image,
                },
                marks:      r.marks,
                maxMarks:   maxAllowed,
                percentage: maxAllowed > 0
                    ? Math.round((r.marks / maxAllowed) * 100) : 0,
                remarks:    r.remarks || "",
                status:     r.status,
                createdAt:  r.createdAt,
                updatedAt:  r.updatedAt,
            })),
            summary: {
                totalStudents: records.length,
                avgMarks,
                maxMarks:     Math.max(...records.map(r => r.marks)),
                minMarks:     Math.min(...records.map(r => r.marks)),
                maxAllowed,
                examType,
                className:    records[0]?.classSection?.name,
                section:      records[0]?.classSection?.section,
                subjectName:  records[0]?.subject?.name,
                subjectCode:  records[0]?.subject?.code,
                status:       records[0]?.status,
            },
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}