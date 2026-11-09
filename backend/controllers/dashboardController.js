import User           from "../models/User.js"
import Student        from "../models/Student.js"
import Teacher        from "../models/Teacher.js"
import Department     from "../models/Department.js"
import ClassSection   from "../models/ClassSection.js"
import Admission      from "../models/Admission.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Result         from "../models/Result.js"
import Attendance     from "../models/Attendance.js"
import FeeRecord      from "../models/FeesFinance.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import StudentEnrollment from "../models/StudentEnrollment.js"

// ── helper ─────────────────────────────────────────────────────────────────────
const daysUntil = (date) => Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
const todayStart = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
const todayEnd   = () => { const d = new Date(); d.setHours(23,59,59,999); return d }
const loadDashboardMetric = async (name, query) => {
    try {
        return await query()
    } catch (error) {
        console.error(`Admin dashboard metric "${name}" failed:`, error)
        return null
    }
}
const countCurrentlyEnrolledSubjects = async (studentId, programId) => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const enrollments = await StudentEnrollment.find({
        student: studentId,
        status: "active",
        startDate: { $lte: today },
        $or: [{ endDate: null }, { endDate: { $gte: today } }],
    })
        .populate("academicSession", "name startDate endDate status")
        .populate("classSection", "program")
        .lean()

    const currentEnrollments = enrollments.filter(enrollment =>
        enrollment.academicSession?.name &&
        enrollment.academicSession.status === "active" &&
        enrollment.academicSession.startDate <= today &&
        enrollment.academicSession.endDate >= today &&
        enrollment.classSection?.program?.toString() === programId?.toString()
    )
    if (currentEnrollments.length === 0) return 0

    const assignments = await AcademicAssignment.distinct("subject", {
        isActive: true,
        $or: currentEnrollments.map(enrollment => ({
            classSection: enrollment.classSection._id,
            session: enrollment.academicSession.name,
        })),
    })
    return assignments.length
}


// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

export const getAdminOverview = async (req, res) => {
    try {
        const [
            totalStudents, totalTeachers, totalDepartments, totalClasses,
            pendingAdmissions, activeStudents, activeTeachers, suspendedUsers, totalUsers,
        ] = await Promise.all([
            Student.countDocuments(),
            Teacher.countDocuments(),
            Department.countDocuments(),
            ClassSection.countDocuments(),
            Admission.countDocuments({ status: "pending" }),
            Student.countDocuments({ status: "active" }),
            Teacher.countDocuments({ status: "active" }),
            User.countDocuments({ status: "suspended" }),
            User.countDocuments(),
        ])

        const [unpaidFees, overdueFees, studentsWithDues, pendingRecords] =
            await Promise.all([
                loadDashboardMetric("unpaidFees", () =>
                    FeeRecord.countDocuments({
                        status: { $in: ["unpaid", "partial"] },
                    })
                ),
                loadDashboardMetric("overdueFees", () =>
                    FeeRecord.countDocuments({ status: "overdue" })
                ),
                loadDashboardMetric("studentsWithDues", async () => {
                    const students = await FeeRecord.distinct("student", {
                        status: { $in: ["unpaid", "partial", "overdue"] },
                    })
                    return students.length
                }),
                loadDashboardMetric("pendingRecords", () =>
                    AcademicRecord.countDocuments({ status: "pending" })
                ),
            ])

        const [adminCount, teacherUserCount, studentUserCount, admissionStaffCount] = await Promise.all([
            User.countDocuments({ role: "admin" }),
            User.countDocuments({ role: "teacher" }),
            User.countDocuments({ role: "student" }),
            User.countDocuments({ role: "admission" }),
        ])

        const [recentStudents, recentTeachers, recentAdmissions] = await Promise.all([
            Student.find().sort({ createdAt: -1 }).limit(5)
                .populate("program", "name").select("name rollNo program status createdAt"),
            Teacher.find().sort({ createdAt: -1 }).limit(5)
                .populate("department", "name").select("name registrationNo department role status createdAt"),
            Admission.find().sort({ createdAt: -1 }).limit(5)
                .populate("program", "name").populate("department", "name")
                .select("name applicationId program department status appliedAt createdAt"),
        ])

        const activityFeed = [
            ...recentStudents.map(s => ({ type:"student", icon:"👨‍🎓", message:`New student enrolled: ${s.name}`, meta: s.rollNo, time: s.createdAt })),
            ...recentTeachers.map(t => ({ type:"teacher", icon:"👨‍🏫", message:`New teacher added: ${t.name}`,    meta: t.department?.name, time: t.createdAt })),
            ...recentAdmissions.map(a => ({ type:"admission", icon:"🧾", message:`Admission ${a.status}: ${a.name}`, meta: a.applicationId, time: a.createdAt })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10)

        const alerts = []
        if (pendingAdmissions > 0) alerts.push({ level:"warning", message:`${pendingAdmissions} admission application(s) pending review.` })
        if (overdueFees > 0)       alerts.push({ level:"danger",  message:`${overdueFees} challan(s) are overdue.` })
        if (studentsWithDues > 0)  alerts.push({ level:"warning", message:`${studentsWithDues} student(s) have unpaid fees.` })
        if (pendingRecords > 0)    alerts.push({ level:"info",    message:`${pendingRecords} academic record(s) pending verification.` })
        if (suspendedUsers > 0)    alerts.push({ level:"info",    message:`${suspendedUsers} user account(s) are suspended.` })

        res.status(200).json({
            summary: {
                totalStudents, totalTeachers, totalDepartments, totalClasses,
                pendingAdmissions, activeStudents, activeTeachers,
                unpaidFees, overdueFees, studentsWithDues,
                pendingRecords, totalUsers, suspendedUsers,
            },
            roleCounts: { adminCount, teacherUserCount, studentUserCount, admissionStaffCount },
            recentStudents, recentTeachers, recentAdmissions,
            activityFeed, alerts,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  STUDENT OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

export const getStudentOverview = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked to this account." })

        const studentId = user.studentId
        const student = await Student.findById(studentId)
            .populate({ path: "program", populate: { path: "department", select: "name code" } })
        if (!student) return res.status(404).json({ message: "Student not found." })

        // marks from verified academic records
        const records = await AcademicRecord.find({ student: studentId, status: "verified" })
            .populate("subject", "name code creditHours").sort({ createdAt: -1 })

        const subjectMap = {}
        for (const r of records) {
            const key = r.subject?._id?.toString()
            if (key && !subjectMap[key]) subjectMap[key] = r
        }
        const latestMarks = Object.values(subjectMap).slice(0, 6).map(r => ({
            subject: r.subject?.name, code: r.subject?.code,
            marks: r.marks, examType: r.examType, session: r.session,
        }))
        const percentage = records.length
            ? Math.round(records.reduce((s, r) => s + r.marks, 0) / records.length) : null
        const gpa = percentage == null ? null
            : percentage >= 90 ? 4.0 : percentage >= 85 ? 3.7 : percentage >= 80 ? 3.3
            : percentage >= 75 ? 3.0 : percentage >= 70 ? 2.7 : percentage >= 65 ? 2.3
            : percentage >= 60 ? 2.0 : percentage >= 55 ? 1.7 : percentage >= 50 ? 1.3 : 1.0
        const enrolledSubjects = await countCurrentlyEnrolledSubjects(
            studentId,
            student.program?._id
        )

        // latest result
        let latestResult = null
        try {
            const result = await Result.findOne({ student: studentId }).sort({ createdAt: -1 })
                .populate("subject", "name code").populate("classSection", "name section")
            if (result) latestResult = {
                subject: result.subject?.name, session: result.session,
                obtainedMarks: result.obtainedMarks, totalMarks: result.totalMarks,
                marksPercentage: result.marksPercentage, grade: result.grade,
                status: result.status, remarks: result.remarks,
            }
        } catch (_) {_}

        // attendance
        let attendance = null
        try {
            const total   = await Attendance.countDocuments({ student: studentId })
            const present = await Attendance.countDocuments({ student: studentId, status: "present" })
            const late    = await Attendance.countDocuments({ student: studentId, status: "late" })
            if (total > 0) attendance = {
                total, present, late,
                absent: total - present - late,
                percentage: Math.round(((present + late) / total) * 100),
            }
        } catch (_) {_}

        // fee
        let feeInfo = null
        try {
            const challan = await FeeRecord.findOne({
                student: studentId, status: { $in: ["unpaid", "partial", "overdue"] }
            }).sort({ dueDate: 1 })
            if (challan) {
                feeInfo = {
                    challanId: challan.challanId, status: challan.status,
                    totalFee: challan.totalFee, paidAmount: challan.paidAmount,
                    balance: challan.totalFee - challan.paidAmount,
                    dueDate: challan.dueDate, daysUntilDue: daysUntil(challan.dueDate),
                    semester: challan.semester, _id: challan._id,
                }
            } else {
                const paid = await FeeRecord.findOne({ student: studentId, status: "paid" })
                if (paid) {
                    feeInfo = { status: "paid", balance: 0 }
                } else {
                    const hasFeeRecords = await FeeRecord.exists({ student: studentId })
                    feeInfo = {
                        status: hasFeeRecords ? "cancelled" : "no_records",
                        balance: 0,
                    }
                }
            }
        } catch (_) {_}

        // pending actions
        const pendingActions = []
        if (feeInfo && feeInfo.status !== "paid") {
            if (feeInfo.status === "overdue")        pendingActions.push({ level:"danger",  icon:"🔴", message:"Fee is overdue. Please pay immediately.", type:"fee" })
            else if (feeInfo.daysUntilDue <= 7)      pendingActions.push({ level:"warning", icon:"⚠️", message:`Fee due in ${feeInfo.daysUntilDue} day(s).`, type:"fee" })
            else                                     pendingActions.push({ level:"info",    icon:"💳", message:`Fee due on ${new Date(feeInfo.dueDate).toLocaleDateString()}.`, type:"fee" })
        }
        if (latestResult) pendingActions.push({ level:"info",    icon:"📊", message:`Result published: ${latestResult.subject} — Grade ${latestResult.grade}.`, type:"result" })
        if (attendance?.percentage < 75) pendingActions.push({ level:"danger", icon:"📅", message:`Attendance below threshold: ${attendance.percentage}%. Minimum 75% required.`, type:"attendance" })
        if (!student.documentsVerified)  pendingActions.push({ level:"warning", icon:"📄", message:"Academic documents pending verification.", type:"documents" })

        res.status(200).json({
            student: {
                _id: student._id, name: student.name, rollNo: student.rollNo,
                email: student.email, contact: student.contact, image: student.image,
                status: student.status, program: student.program?.name,
                department: student.program?.department?.name,
                dateOfAdmission: student.dateOfAdmission,
                documentsVerified: student.documentsVerified, feeStatus: student.feeStatus,
            },
            stats: {
                gpa, percentage, attendancePercent: attendance?.percentage ?? 0,
                feeStatus: feeInfo?.status || "unavailable",
                enrolledSubjects, latestResultStatus: latestResult?.status || null,
            },
            latestMarks, attendance, latestResult, feeInfo, pendingActions,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}


// ══════════════════════════════════════════════════════════════════════════════
//  TEACHER OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════

export const getTeacherOverview = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user) return res.status(404).json({ message: "User not found." })
        if (!user.teacherId) return res.status(404).json({ message: "Teacher profile not linked to this account." })

        const teacher = await Teacher.findById(user.teacherId).populate("department", "name code")
        if (!teacher) return res.status(404).json({ message: "Teacher not found." })

        const assignments = await AcademicAssignment.find({
            teacher: teacher._id,
            isActive: true,
        })
            .populate({
                path: "classSection",
                select: "name section semester program department",
                populate: [
                    { path: "program", select: "name" },
                    { path: "department", select: "name" },
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
        const assignmentKey = (classSectionId, subjectId, session) =>
            JSON.stringify([String(classSectionId), String(subjectId), session])

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
                    department: cls.department?.name,
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
                subjectMap.set(subjectId, { ...subjectInfo, classes: new Map() })
            }
            subjectMap.get(subjectId).classes.set(classId, {
                _id: cls._id,
                name: cls.name,
                section: cls.section,
            })
        }

        const assignedClasses = [...classMap.values()]
        const classCardsBase = assignedClasses.map(cls => ({
            ...cls,
            subjects: [...cls.subjects.values()].map(({ _id, name, code }) => ({
                _id, name, code,
            })),
        }))
        const classIds = classCardsBase.map(cls => cls._id)
        const today = todayStart()
        const attendanceRecords = classIds.length
            ? await Attendance.find({
                teacher: teacher._id,
                classSection: { $in: classIds },
                date: { $gte: today, $lte: todayEnd() },
            })
                .select("classSection subject session")
                .lean()
            : []

        const attendanceAssignmentKeys = new Set()
        for (const record of attendanceRecords) {
            if (activeAssignmentKeys.has(
                assignmentKey(record.classSection, record.subject, record.session)
            )) {
                attendanceAssignmentKeys.add(
                    assignmentKey(record.classSection, record.subject, record.session)
                )
            }
        }

        const pendingTasks = []
        const classCards = classCardsBase.map(cls => {
            const assignmentKeys = assignmentKeysByClass.get(String(cls._id)) || new Set()
            const hasAttendanceToday = assignmentKeys.size > 0 &&
                [...assignmentKeys].every(key => attendanceAssignmentKeys.has(key))
            if (!hasAttendanceToday) {
                pendingTasks.push({
                    level: "warning",
                    icon: "📅",
                    message: `Attendance not submitted for ${cls.name} — ${cls.section}`,
                    type: "attendance",
                    classId: cls._id,
                })
            }
            return {
                ...cls,
                studentCount: null,
                attendanceToday: hasAttendanceToday,
            }
        })

        const [recentRecords, recentAttendance] = await Promise.all([
            AcademicRecord.find({ teacher: teacher._id })
                .sort({ createdAt: -1 }).limit(8)
                .populate("student", "name rollNo")
                .populate("subject", "name code")
                .populate("classSection", "name section"),
            Attendance.find({ teacher: teacher._id })
                .sort({ createdAt: -1 }).limit(5)
                .populate("classSection", "name section")
                .populate("subject", "name"),
        ])

        const recentActivity = [
            ...recentRecords.map(r => ({
                icon: "📝",
                message: `Marks entered: ${r.student?.name} — ${r.subject?.name}`,
                meta: `${r.classSection?.name} ${r.classSection?.section} · ${r.examType} · ${r.marks} marks`,
                time: r.createdAt,
            })),
            ...recentAttendance.map(a => ({
                icon: "📅",
                message: `Attendance marked: ${a.classSection?.name} ${a.classSection?.section}`,
                meta: `${a.subject?.name} · ${new Date(a.date).toLocaleDateString()}`,
                time: a.createdAt,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10)

        return res.status(200).json({
            teacher: {
                _id:            teacher._id,
                name:           teacher.name,
                registrationNo: teacher.registrationNo,
                email:          teacher.email,
                image:          teacher.image,
                role:           teacher.role,
                status:         teacher.status,
                education:      teacher.education,
                department:     teacher.department?.name,
                departmentCode: teacher.department?.code,
            },
            stats: {
                assignedClasses:   classCards.length,
                assignedSubjects:  subjectMap.size,
                totalStudents:     null,
                attendancePending: classCards.filter(cls => !cls.attendanceToday).length,
                marksPending:      null,
                resultsAwaiting:   null,
            },
            classCards,
            assignedSubjects: [...subjectMap.values()].map(subject => ({
                _id: subject._id,
                name: subject.name,
                code: subject.code,
                creditHours: subject.creditHours,
                classes: [...subject.classes.values()],
            })),
            pendingTasks,
            recentActivity,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}
