import User         from "../models/User.js"
import Teacher      from "../models/Teacher.js"
import Student      from "../models/Student.js"
import ClassSection from "../models/ClassSection.js"
import Result       from "../models/Result.js"

// ══════════════════════════════════════════════════════════════════════════════
//  GET RESULTS PAGE DATA — summary cards + classes + subjects
// ══════════════════════════════════════════════════════════════════════════════

export const getResultsPageData = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const teacher = await Teacher.findById(teacherId).select("role name")

        // ── assigned classes ───────────────────────────────────────────────────
        const classes = await ClassSection.find({ classTeacher: teacherId })
            .populate("subjects",   "name code creditHours")
            .populate("program",    "name")
            .populate("department", "name code")

        const classIds   = classes.map(c => c._id)
        const programIds = [...new Set(
            classes.map(c => c.program?._id?.toString()).filter(Boolean)
        )]

        // ── unique subjects ────────────────────────────────────────────────────
        const subjectMap = {}
        for (const cls of classes) {
            for (const s of (cls.subjects || [])) {
                if (s?._id) subjectMap[s._id.toString()] = {
                    _id: s._id, name: s.name, code: s.code
                }
            }
        }
        const allSubjects = Object.values(subjectMap)

        // ── result stats ───────────────────────────────────────────────────────
        const allResults = await Result.find({
            classSection: { $in: classIds }
        }).select("status marksPercentage grade student classSection subject")

        const publishedCount  = allResults.filter(r => r.status === "pass" || r.status === "fail").length
        const passCount       = allResults.filter(r => r.status === "pass").length
        const passRate        = publishedCount > 0
            ? Math.round((passCount / publishedCount) * 100) : 0

        // pending verification — results with no generatedBy set or status pending
        const pendingVerification = await Result.countDocuments({
            classSection: { $in: classIds },
            generatedBy:  { $exists: false }
        })

        const totalStudents = await Student.countDocuments({
            program: { $in: programIds }, status: "active"
        })

        // distinct sessions available
        const sessions = await Result.distinct("session", {
            classSection: { $in: classIds }
        })

        res.status(200).json({
            teacher: {
                _id:  teacher._id,
                name: teacher.name,
                role: teacher.role,
            },
            stats: {
                totalClasses:       classIds.length,
                totalSubjects:      allSubjects.length,
                publishedCount,
                pendingVerification,
                totalStudents,
                passRate,
            },
            classes: classes.map(c => ({
                _id:      c._id,
                name:     c.name,
                section:  c.section,
                semester: c.semester,
                program:  c.program?.name,
                programId:c.program?._id,
                subjects: (c.subjects || []).map(s => ({
                    _id: s._id, name: s.name, code: s.code
                })),
            })),
            subjects: allSubjects,
            sessions: sessions.sort(),
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  GET RESULTS — filtered list for a class/subject/session
// ══════════════════════════════════════════════════════════════════════════════

export const getResults = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const {
            classId, subjectId, session,
            search, resultStatus,
            page = 1, limit = 20
        } = req.query

        // ── verify teacher's classes ───────────────────────────────────────────
        const classes = await ClassSection.find({ classTeacher: teacherId })
        const classIds = classes.map(c => c._id)

        if (classIds.length === 0) {
            return res.status(200).json({ results:[], pagination:{ total:0, page:1, pages:1 } })
        }

        // ── build match query ──────────────────────────────────────────────────
        const matchQuery = { classSection: { $in: classIds } }
        if (classId   && classId   !== "All") matchQuery.classSection = classId
        if (subjectId && subjectId !== "All") matchQuery.subject      = subjectId
        if (session   && session   !== "All") matchQuery.session      = session
        if (resultStatus === "pass")           matchQuery.status       = "pass"
        if (resultStatus === "fail")           matchQuery.status       = "fail"

        // ── fetch + populate ───────────────────────────────────────────────────
        let results = await Result.find(matchQuery)
            .populate("student",      "name rollNo email image program")
            .populate("subject",      "name code creditHours")
            .populate("classSection", "name section semester")
            .populate("generatedBy",  "name")
            .sort({ createdAt: -1 })

        // ── search filter (post-populate) ──────────────────────────────────────
        if (search) {
            const q = search.toLowerCase()
            results = results.filter(r =>
                r.student?.name?.toLowerCase().includes(q) ||
                r.student?.rollNo?.toLowerCase().includes(q)
            )
        }

        // ── paginate ───────────────────────────────────────────────────────────
        const total    = results.length
        const skip     = (Number(page) - 1) * Number(limit)
        const paginated = results.slice(skip, skip + Number(limit))

        res.status(200).json({
            results: paginated.map(r => ({
                _id:             r._id,
                student: {
                    _id:    r.student?._id,
                    name:   r.student?.name,
                    rollNo: r.student?.rollNo,
                    image:  r.student?.image,
                },
                subject: {
                    _id:  r.subject?._id,
                    name: r.subject?.name,
                    code: r.subject?.code,
                },
                classSection: {
                    _id:     r.classSection?._id,
                    name:    r.classSection?.name,
                    section: r.classSection?.section,
                },
                session:             r.session,
                obtainedMarks:       r.obtainedMarks,
                totalMarks:          r.totalMarks,
                marksPercentage:     r.marksPercentage,
                attendancePercentage:r.attendancePercentage,
                grade:               r.grade,
                status:              r.status,
                remarks:             r.remarks,
                generatedBy:         r.generatedBy?.name || null,
                createdAt:           r.createdAt,
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
//  GET SINGLE STUDENT FULL RESULT — all subjects for one student
// ══════════════════════════════════════════════════════════════════════════════

export const getStudentFullResult = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const { studentId } = req.params
        const { session }   = req.query

        const classes  = await ClassSection.find({ classTeacher: teacherId })
        const classIds = classes.map(c => c._id)

        // build query — scoped to teacher's classes
        const query = {
            student:      studentId,
            classSection: { $in: classIds },
        }
        if (session && session !== "All") query.session = session

        const results = await Result.find(query)
            .populate("subject",      "name code creditHours")
            .populate("classSection", "name section semester")
            .populate("generatedBy",  "name")
            .sort({ session: 1 })

        if (results.length === 0) {
            return res.status(404).json({
                message: "No results found for this student in your classes."
            })
        }

        const student = await Student.findById(studentId)
            .populate("program", "name")
            .select("name rollNo email image program")

        // ── compute overall ────────────────────────────────────────────────────
        const totalObtained = results.reduce((s, r) => s + r.obtainedMarks, 0)
        const totalMarks    = results.reduce((s, r) => s + r.totalMarks, 0)
        const avgPct        = totalMarks > 0
            ? Math.round((totalObtained / totalMarks) * 100) : 0
        const passCount     = results.filter(r => r.status === "pass").length
        const failCount     = results.filter(r => r.status === "fail").length
        const overallGrade  =
            avgPct >= 90 ? "A" : avgPct >= 80 ? "A" :
            avgPct >= 70 ? "B" : avgPct >= 60 ? "C" :
            avgPct >= 50 ? "D" : "F"
        const overallStatus = failCount === 0 ? "pass" : "fail"
        const overallRemarks =
            avgPct >= 90 ? "Outstanding Performance"  :
            avgPct >= 80 ? "Excellent Performance"    :
            avgPct >= 70 ? "Good Performance"         :
            avgPct >= 60 ? "Satisfactory Performance" :
            avgPct >= 50 ? "Needs Improvement"        : "Unsatisfactory"

        res.status(200).json({
            student: {
                _id:     student?._id,
                name:    student?.name,
                rollNo:  student?.rollNo,
                image:   student?.image,
                program: student?.program?.name,
            },
            results: results.map(r => ({
                _id:                 r._id,
                subjectName:         r.subject?.name,
                subjectCode:         r.subject?.code,
                creditHours:         r.subject?.creditHours,
                className:           r.classSection?.name,
                section:             r.classSection?.section,
                session:             r.session,
                obtainedMarks:       r.obtainedMarks,
                totalMarks:          r.totalMarks,
                marksPercentage:     r.marksPercentage,
                attendancePercentage:r.attendancePercentage,
                grade:               r.grade,
                status:              r.status,
                remarks:             r.remarks,
                generatedBy:         r.generatedBy?.name || null,
                createdAt:           r.createdAt,
            })),
            overall: {
                totalObtained,
                totalMarks,
                avgPct,
                overallGrade,
                overallStatus,
                overallRemarks,
                passCount,
                failCount,
                totalSubjects: results.length,
            },
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  VERIFY RESULT — senior teacher only
// ══════════════════════════════════════════════════════════════════════════════

export const verifyResult = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const teacher = await Teacher.findById(teacherId).select("role")
        if (teacher.role !== "senior") {
            return res.status(403).json({
                message: "Only senior teachers can verify results."
            })
        }

        const { resultId } = req.params

        // verify result is in teacher's class
        const classes  = await ClassSection.find({ classTeacher: teacherId })
        const classIds = classes.map(c => c._id)

        const result = await Result.findOne({
            _id:          resultId,
            classSection: { $in: classIds },
        })
        if (!result) return res.status(404).json({ message: "Result not found in your classes." })

        // set generatedBy to this teacher as verification stamp
        result.generatedBy = user._id
        await result.save()

        res.status(200).json({
            message:     "Result verified successfully.",
            resultId:    result._id,
            verifiedBy:  teacher._id,
            verifiedAt:  new Date(),
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  GET VERIFICATION QUEUE — results pending senior teacher review
// ══════════════════════════════════════════════════════════════════════════════

export const getVerificationQueue = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })
        const teacherId = user.teacherId

        const classes  = await ClassSection.find({ classTeacher: teacherId })
        const classIds = classes.map(c => c._id)

        // group by class + subject — find groups where generatedBy is missing
        const pending = await Result.aggregate([
            {
                $match: {
                    classSection: { $in: classIds },
                    generatedBy:  { $exists: false }
                }
            },
            {
                $group: {
                    _id: {
                        classSection: "$classSection",
                        subject:      "$subject",
                        session:      "$session",
                    },
                    classSection: { $first: "$classSection" },
                    subject:      { $first: "$subject" },
                    session:      { $first: "$session" },
                    totalCount:   { $sum: 1 },
                    passCount:    { $sum: { $cond: [{ $eq:["$status","pass"] }, 1, 0] } },
                    sampleIds:    { $push: "$_id" },
                }
            },
            { $sort: { "_id.session": -1 } },
        ])

        await ClassSection.populate(pending, { path:"classSection", select:"name section" })
        const Subject = (await import("../models/Subject.js")).default
        await Subject.populate(pending, { path:"subject", select:"name code" })

        res.status(200).json({
            queue: pending.map(p => ({
                classId:     p.classSection?._id,
                className:   p.classSection?.name,
                section:     p.classSection?.section,
                subjectId:   p.subject?._id,
                subjectName: p.subject?.name,
                subjectCode: p.subject?.code,
                session:     p.session,
                totalCount:  p.totalCount,
                passCount:   p.passCount,
                failCount:   p.totalCount - p.passCount,
                sampleIds:   p.sampleIds.slice(0, 5),
            })),
            totalPending: pending.length,
        })

    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}