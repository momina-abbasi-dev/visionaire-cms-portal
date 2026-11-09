import User           from "../models/User.js"
import Student        from "../models/Student.js"
import Result         from "../models/Result.js"

export const getStudentResults = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })
        const studentId = user.studentId

        // ── student profile for result card header ─────────────────────────────
        const student = await Student.findById(studentId)
            .populate({ path: "program", populate: { path: "department", select: "name code" } })
        if (!student) return res.status(404).json({ message: "Student not found." })

        // ── all results for this student ───────────────────────────────────────
        const results = await Result.find({ student: studentId })
            .populate("subject",      "name code creditHours")
            .populate("classSection", "name section semester")
            .populate("generatedBy",  "name")
            .sort({ session: 1, createdAt: 1 })

        // ── group results by session ───────────────────────────────────────────
        const sessionMap = {}

        for (const r of results) {
            const session = r.session || "Unknown"
            if (!sessionMap[session]) sessionMap[session] = []
            sessionMap[session].push(r)
        }

        // ── compute per-session summary ────────────────────────────────────────
        const sessions = Object.entries(sessionMap).map(([session, sessionResults]) => {
            const totalObtained = sessionResults.reduce((s, r) => s + r.obtainedMarks, 0)
            const totalMarks    = sessionResults.reduce((s, r) => s + r.totalMarks,    0)
            const avgPct        = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 100) : 0
            const passed        = sessionResults.filter(r => r.status === "pass").length
            const failed        = sessionResults.filter(r => r.status === "fail").length
            const overallStatus = failed === 0 ? "pass" : "fail"

            // overall grade from avg percentage
            const overallGrade =
                avgPct >= 90 ? "A" :
                avgPct >= 80 ? "A" :
                avgPct >= 70 ? "B" :
                avgPct >= 60 ? "C" :
                avgPct >= 50 ? "D" : "F"

            // GPA (4.0 scale)
            const gpa =
                avgPct >= 90 ? 4.0 : avgPct >= 85 ? 3.7 : avgPct >= 80 ? 3.3 :
                avgPct >= 75 ? 3.0 : avgPct >= 70 ? 2.7 : avgPct >= 65 ? 2.3 :
                avgPct >= 60 ? 2.0 : avgPct >= 55 ? 1.7 : avgPct >= 50 ? 1.3 : 1.0

            // semester number from classSection if available
            const semesterNo = sessionResults[0]?.classSection?.semester || null

            // published date = latest createdAt in this session
            const publishedAt = sessionResults.reduce((latest, r) =>
                new Date(r.createdAt) > new Date(latest) ? r.createdAt : latest,
                sessionResults[0].createdAt
            )

            // generatedBy
            const generatedBy = sessionResults[0]?.generatedBy?.name || "System"

            // overall remarks
            const overallRemarks =
                avgPct >= 90 ? "Outstanding Performance"  :
                avgPct >= 80 ? "Excellent Performance"    :
                avgPct >= 70 ? "Good Performance"         :
                avgPct >= 60 ? "Satisfactory Performance" :
                avgPct >= 50 ? "Needs Improvement"        : "Unsatisfactory Performance"

            const subjects = sessionResults.map(r => ({
                _id:                 r._id,
                subjectName:         r.subject?.name,
                subjectCode:         r.subject?.code,
                creditHours:         r.subject?.creditHours,
                classSection:        r.classSection ? `${r.classSection.name} — ${r.classSection.section}` : "—",
                obtainedMarks:       r.obtainedMarks,
                totalMarks:          r.totalMarks,
                marksPercentage:     r.marksPercentage,
                attendancePercentage:r.attendancePercentage,
                grade:               r.grade,
                status:              r.status,
                remarks:             r.remarks,
                generatedBy:         r.generatedBy?.name,
                publishedAt:         r.createdAt,
            }))

            return {
                session, semesterNo, subjects,
                summary: {
                    totalObtained, totalMarks, avgPct,
                    overallGrade, gpa, overallStatus,
                    passed, failed,
                    totalSubjects: sessionResults.length,
                    overallRemarks, publishedAt, generatedBy,
                },
            }
        }).sort((a, b) => a.session.localeCompare(b.session))

        // ── overall academic standing across all sessions ──────────────────────
        const allPassed  = sessions.reduce((s, sess) => s + sess.summary.passed,  0)
        const allFailed  = sessions.reduce((s, sess) => s + sess.summary.failed,  0)
        const allAvgPcts = sessions.map(s => s.summary.avgPct).filter(Boolean)
        const cumulativeAvg = allAvgPcts.length
            ? Math.round(allAvgPcts.reduce((s, p) => s + p, 0) / allAvgPcts.length) : null

        const academicStanding =
            cumulativeAvg == null ? "No Results" :
            cumulativeAvg >= 85   ? "Excellent Standing" :
            cumulativeAvg >= 70   ? "Good Standing"      :
            cumulativeAvg >= 60   ? "Satisfactory"       :
            cumulativeAvg >= 50   ? "Academic Warning"   : "Academic Probation"

        res.status(200).json({
            student: {
                name:       student.name,
                rollNo:     student.rollNo,
                program:    student.program?.name,
                department: student.program?.department?.name,
                image:      student.image,
            },
            sessions,
            overall: {
                cumulativeAvg,
                allPassed, allFailed,
                academicStanding,
                totalSessions: sessions.length,
            },
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}