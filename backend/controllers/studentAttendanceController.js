import User           from "../models/User.js"
import Attendance     from "../models/Attendance.js"

export const getStudentAttendance = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })
        const studentId = user.studentId

        // ── all attendance records for this student ────────────────────────────
        const records = await Attendance.find({ student: studentId })
            .populate("subject",      "name code creditHours")
            .populate("teacher",      "name")
            .populate("classSection", "name section")
            .sort({ date: -1 })

        // ── group by subject, class section, and session ────────────────────────
        const subjectMap = new Map()

        for (const r of records) {
            const subjectId = r.subject?._id?.toString() || "unknown"
            const classSectionId = r.classSection?._id?.toString() || "unknown"
            const groupKey = JSON.stringify([subjectId, classSectionId, r.session ?? "unknown"])

            if (!subjectMap.has(groupKey)) {
                subjectMap.set(groupKey, {
                    subjectId,
                    subjectName:   r.subject?.name,
                    subjectCode:   r.subject?.code,
                    creditHours:   r.subject?.creditHours,
                    session:       r.session,
                    teacherName:   r.teacher?.name,
                    classSection:  r.classSection ? `${r.classSection.name} — ${r.classSection.section}` : "—",
                    total:   0,
                    present: 0,
                    absent:  0,
                    late:    0,
                    history: [],   // last 10 per subject, class, and session
                })
            }

            const subjectSummary = subjectMap.get(groupKey)
            subjectSummary.total++
            if (r.status === "present") subjectSummary.present++
            if (r.status === "absent")  subjectSummary.absent++
            if (r.status === "late")    subjectSummary.late++

            // keep only last 10 records per subject, class, and session
            if (subjectSummary.history.length < 10) {
                subjectSummary.history.push({
                    date:   r.date,
                    status: r.status,
                    session: r.session,
                })
            }
        }

        // ── compute percentage + status per subject ────────────────────────────
        const subjects = Array.from(subjectMap.values()).map(s => {
            // present + late both count toward attendance in most institutions
            const effectivePresent = s.present + s.late
            const pct = s.total > 0 ? Math.round((effectivePresent / s.total) * 100) : 0
            const attendanceStatus =
                pct >= 90 ? "Excellent" :
                pct >= 80 ? "Good"      :
                pct >= 75 ? "Average"   :
                pct >= 60 ? "Warning"   : "Critical"

            return { ...s, percentage: pct, attendanceStatus }
        }).sort((a, b) => a.percentage - b.percentage)   // worst first for easy spotting

        // ── overall stats ──────────────────────────────────────────────────────
        const totalClasses  = records.length
        const totalPresent  = records.filter(r => r.status === "present").length
        const totalAbsent   = records.filter(r => r.status === "absent").length
        const totalLate     = records.filter(r => r.status === "late").length
        const effectiveTotal = totalPresent + totalLate
        const overallPct    = totalClasses > 0 ? Math.round((effectiveTotal / totalClasses) * 100) : 0

        const eligibilityStatus =
            overallPct >= 85 ? "Excellent"  :
            overallPct >= 75 ? "Eligible"   :
            overallPct >= 65 ? "At Risk"    : "Ineligible"

        const bannerLevel =
            overallPct >= 75 ? "good"     :
            overallPct >= 65 ? "warning"  : "critical"

        // ── recent history (last 20 across all subjects, date desc) ───────────
        const recentHistory = records.slice(0, 20).map(r => ({
            date:        r.date,
            subjectName: r.subject?.name,
            subjectCode: r.subject?.code,
            status:      r.status,
            session:     r.session,
        }))

        // ── warnings: subjects below 75% ──────────────────────────────────────
        const warnings = subjects
            .filter(s => s.percentage < 75)
            .map(s => ({
                subjectName: s.subjectName,
                subjectCode: s.subjectCode,
                percentage:  s.percentage,
                absent:      s.absent,
                level:       s.percentage < 60 ? "critical" : "warning",
                message:     s.percentage < 60
                    ? `${s.subjectName} attendance is critically low (${s.percentage}%). Immediate improvement required.`
                    : `${s.subjectName} attendance is below the 75% requirement (${s.percentage}%).`,
            }))

        res.status(200).json({
            overall: {
                totalClasses, totalPresent, totalAbsent, totalLate,
                overallPercentage: overallPct,
                eligibilityStatus,
                bannerLevel,
            },
            subjects,
            recentHistory,
            warnings,
            minimumRequired: 75,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}
