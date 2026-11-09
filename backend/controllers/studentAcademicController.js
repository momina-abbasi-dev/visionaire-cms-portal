import User           from "../models/User.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Result         from "../models/Result.js"

export const getStudentAcademicRecords = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })
        const studentId = user.studentId

        // ── all verified academic records for this student ─────────────────────
        const records = await AcademicRecord.find({ student: studentId, status: "verified" })
            .populate("subject",      "name code creditHours")
            .populate("teacher",      "name registrationNo")
            .populate("classSection", "name section semester")
            .sort({ session: 1, createdAt: 1 })

        // ── all results for this student ───────────────────────────────────────
        const results = await Result.find({ student: studentId })
            .populate("subject",      "name code creditHours")
            .populate("classSection", "name section semester")
            .sort({ session: 1 })

        // ── group records by session → subjectId ───────────────────────────────
        // Structure: { [session]: { [subjectId]: { subjectName, code, teacher, examTypes: { quiz:[], midterm:[], ... } } } }
        const sessionMap = {}

        for (const r of records) {
            const session   = r.session || "Unknown"
            const subjectId = r.subject?._id?.toString() || "unknown"

            if (!sessionMap[session]) sessionMap[session] = {}
            if (!sessionMap[session][subjectId]) {
                sessionMap[session][subjectId] = {
                    subjectId,
                    subjectName:  r.subject?.name,
                    subjectCode:  r.subject?.code,
                    creditHours:  r.subject?.creditHours,
                    teacherName:  r.teacher?.name,
                    classSection: r.classSection ? `${r.classSection.name} — ${r.classSection.section}` : "—",
                    semester:     r.classSection?.semester,
                    examTypes:    {},
                    totalObtained: 0,
                }
            }

            // group by examType
            const et = r.examType
            if (!sessionMap[session][subjectId].examTypes[et]) {
                sessionMap[session][subjectId].examTypes[et] = []
            }
            sessionMap[session][subjectId].examTypes[et].push({
                _id:     r._id,
                marks:   r.marks,
                remarks: r.remarks,
                date:    r.createdAt,
            })

            sessionMap[session][subjectId].totalObtained += r.marks
        }

        // ── attach result data to each subject in session ──────────────────────
        for (const result of results) {
            const session   = result.session
            const subjectId = result.subject?._id?.toString()
            if (sessionMap[session]?.[subjectId]) {
                sessionMap[session][subjectId].result = {
                    obtainedMarks:       result.obtainedMarks,
                    totalMarks:          result.totalMarks,
                    marksPercentage:     result.marksPercentage,
                    attendancePercentage:result.attendancePercentage,
                    grade:               result.grade,
                    status:              result.status,
                    remarks:             result.remarks,
                }
            }
        }

        // ── flatten to array format per session ────────────────────────────────
        const sessions = Object.entries(sessionMap).map(([session, subjects]) => {
            const subjectList = Object.values(subjects)

            // session-level stats
            const withResults  = subjectList.filter(s => s.result)
            const avgPct       = withResults.length
                ? Math.round(withResults.reduce((sum, s) => sum + s.result.marksPercentage, 0) / withResults.length)
                : null
            const passed       = withResults.filter(s => s.result.status === "pass").length
            const failed       = withResults.filter(s => s.result.status === "fail").length
            const highest      = withResults.length
                ? withResults.reduce((best, s) => s.result.marksPercentage > best.result.marksPercentage ? s : best)
                : null
            const lowest       = withResults.length
                ? withResults.reduce((worst, s) => s.result.marksPercentage < worst.result.marksPercentage ? s : worst)
                : null

            return {
                session,
                subjects: subjectList,
                stats: { avgPct, passed, failed, highest, lowest, totalSubjects: subjectList.length },
            }
        }).sort((a, b) => a.session.localeCompare(b.session))

        // ── overall summary across all sessions ────────────────────────────────
        const allSubjectsWithResult = sessions.flatMap(s => s.subjects.filter(sub => sub.result))
        const overallAvg = allSubjectsWithResult.length
            ? Math.round(allSubjectsWithResult.reduce((sum, s) => sum + s.result.marksPercentage, 0) / allSubjectsWithResult.length)
            : null
        const overallHighest = allSubjectsWithResult.length
            ? allSubjectsWithResult.reduce((best, s) => s.result.marksPercentage > best.result.marksPercentage ? s : best)
            : null
        const overallLowest  = allSubjectsWithResult.length
            ? allSubjectsWithResult.reduce((worst, s) => s.result.marksPercentage < worst.result.marksPercentage ? s : worst)
            : null
        const totalPassed  = allSubjectsWithResult.filter(s => s.result.status === "pass").length
        const totalFailed  = allSubjectsWithResult.filter(s => s.result.status === "fail").length

        // academic standing
        const standing = overallAvg == null ? "No Records"
            : overallAvg >= 80 ? "Good Standing"
            : overallAvg >= 60 ? "Satisfactory"
            : overallAvg >= 50 ? "Academic Warning"
            : "Academic Probation"

        res.status(200).json({
            sessions,
            overall: {
                totalSubjects: allSubjectsWithResult.length,
                avgPercentage: overallAvg,
                highestSubject: overallHighest ? { name: overallHighest.subjectName, pct: overallHighest.result.marksPercentage } : null,
                lowestSubject:  overallLowest  ? { name: overallLowest.subjectName,  pct: overallLowest.result.marksPercentage  } : null,
                totalPassed,
                totalFailed,
                standing,
            },
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}
