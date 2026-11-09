import User from "../models/User.js"
import Teacher from "../models/Teacher.js"
import Student from "../models/Student.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import AcademicSession from "../models/AcademicSession.js"
import StudentEnrollment from "../models/StudentEnrollment.js"
import Attendance from "../models/Attendance.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Result from "../models/Result.js"

const assignmentKey = (classSectionId, subjectId, session) =>
    JSON.stringify([String(classSectionId), String(subjectId), session])

const assignmentFilter = ({ classSection, subject, session }) => ({
    classSection,
    subject,
    session,
})

const utcToday = () => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    return today
}

const getAssignmentContext = async teacherId => {
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
    const tuplesByKey = new Map()

    for (const assignment of assignments) {
        const cls = assignment.classSection
        const subject = assignment.subject
        if (!cls?._id || !subject?._id) continue

        const classId = String(cls._id)
        const subjectId = String(subject._id)
        const key = assignmentKey(cls._id, subject._id, assignment.session)
        tuplesByKey.set(key, {
            classSection: cls._id,
            subject: subject._id,
            session: assignment.session,
        })

        if (!classesById.has(classId)) {
            classesById.set(classId, {
                _id: cls._id,
                name: cls.name,
                section: cls.section,
                semester: cls.semester,
                programId: cls.program?._id || null,
            })
        }
        if (!subjectsById.has(subjectId)) {
            subjectsById.set(subjectId, {
                _id: subject._id,
                name: subject.name,
                code: subject.code,
            })
        }
    }

    return {
        classes: [...classesById.values()],
        subjects: [...subjectsById.values()],
        tuples: [...tuplesByKey.values()],
        tupleKeys: new Set(tuplesByKey.keys()),
    }
}

const getCurrentlyEnrolledStudentIds = async (tuples, classes) => {
    if (tuples.length === 0) return new Set()

    const today = utcToday()
    const academicSessions = await AcademicSession.find({
        name: { $in: [...new Set(tuples.map(tuple => tuple.session))] },
        status: "active",
        startDate: { $lte: today },
        endDate: { $gte: today },
    })
        .select("_id name")
        .lean()
    const sessionIdsByName = new Map(
        academicSessions.map(session => [session.name, session._id])
    )
    const enrollmentTuples = tuples.flatMap(tuple => {
        const academicSession = sessionIdsByName.get(tuple.session)
        return academicSession
            ? [{ classSection: tuple.classSection, academicSession }]
            : []
    })
    if (enrollmentTuples.length === 0) return new Set()

    const enrollments = await StudentEnrollment.find({
        $or: enrollmentTuples,
        status: "active",
        startDate: { $lte: today },
        $and: [
            { $or: [{ endDate: null }, { endDate: { $gte: today } }] },
        ],
    })
        .select("student classSection")
        .lean()
    if (enrollments.length === 0) return new Set()

    const classPrograms = new Map(
        classes.map(cls => [String(cls._id), cls.programId?.toString()])
    )
    const students = await Student.find({
        _id: { $in: [...new Set(enrollments.map(enrollment => enrollment.student))] },
        status: "active",
    })
        .select("_id program")
        .lean()
    const studentPrograms = new Map(
        students.map(student => [String(student._id), String(student.program)])
    )

    return new Set(enrollments
        .filter(enrollment =>
            studentPrograms.get(String(enrollment.student)) ===
            classPrograms.get(String(enrollment.classSection))
        )
        .map(enrollment => String(enrollment.student)))
}

const getTupleStudentRecords = async (teacherId, classIds) => {
    if (classIds.length === 0) return { attendance: [], academicRecords: [] }

    const [attendance, academicRecords] = await Promise.all([
        Attendance.find({ teacher: teacherId, classSection: { $in: classIds } })
            .select("student classSection subject session status")
            .lean(),
        AcademicRecord.find({ teacher: teacherId, classSection: { $in: classIds } })
            .select("student classSection subject session")
            .lean(),
    ])

    return { attendance, academicRecords }
}

const recordMatchesTuples = (record, tupleKeys) =>
    tupleKeys.has(assignmentKey(record.classSection, record.subject, record.session))

export const getTeacherStudents = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("teacherId")
        if (!user) return res.status(404).json({ message: "User not found." })
        if (!user.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })

        const teacher = await Teacher.findById(user.teacherId)
        if (!teacher) return res.status(404).json({ message: "Teacher not found." })

        const { search, classId, subjectId, attStatus, page = 1, limit = 15 } = req.query
        const context = await getAssignmentContext(teacher._id)
        const classes = context.classes
        const subjects = context.subjects
        const selectedClass = classId && classId !== "All"
            ? classes.find(cls => String(cls._id) === classId)
            : null
        const selectedSubject = subjectId && subjectId !== "All"
            ? subjects.find(subject => String(subject._id) === subjectId)
            : null
        const invalidClassFilter = classId && classId !== "All" && !selectedClass
        const invalidSubjectFilter = subjectId && subjectId !== "All" && !selectedSubject

        const targetTuples = context.tuples.filter(tuple =>
            !invalidClassFilter &&
            (!selectedClass || String(tuple.classSection) === String(selectedClass._id)) &&
            !invalidSubjectFilter &&
            (!selectedSubject || String(tuple.subject) === String(selectedSubject._id))
        )
        const targetTupleKeys = new Set(targetTuples.map(tuple =>
            assignmentKey(tuple.classSection, tuple.subject, tuple.session)
        ))
        const targetClassIds = [...new Set(targetTuples.map(tuple => String(tuple.classSection)))]
        const targetTupleFilters = targetTuples.map(assignmentFilter)
        const { attendance, academicRecords } = await getTupleStudentRecords(
            teacher._id,
            targetClassIds
        )
        const matchingAttendance = attendance.filter(record =>
            recordMatchesTuples(record, targetTupleKeys)
        )
        const matchingAcademicRecords = academicRecords.filter(record =>
            recordMatchesTuples(record, targetTupleKeys)
        )
        const accessibleStudentIds = await getCurrentlyEnrolledStudentIds(
            targetTuples,
            classes.filter(cls => targetClassIds.includes(String(cls._id)))
        )

        const studentQuery = {
            _id: { $in: [...accessibleStudentIds] },
            status: "active",
        }
        if (search) {
            studentQuery.$or = [
                { name: { $regex: search, $options: "i" } },
                { rollNo: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ]
        }

        const students = await Student.find(studentQuery)
            .select("name rollNo email contact image status feeStatus program")
            .populate("program", "name")
            .sort({ name: 1 })

        const attendanceByStudent = new Map()
        for (const record of matchingAttendance) {
            const studentId = String(record.student)
            const totals = attendanceByStudent.get(studentId) || { total: 0, present: 0 }
            totals.total += 1
            if (record.status === "present") totals.present += 1
            attendanceByStudent.set(studentId, totals)
        }

        const recordsByStudent = new Map()
        for (const record of matchingAcademicRecords) {
            const studentId = String(record.student)
            recordsByStudent.set(studentId, (recordsByStudent.get(studentId) || 0) + 1)
        }

        const resultsByStudent = new Map()
        if (students.length > 0 && targetTupleFilters.length > 0) {
            const results = await Result.find({
                student: { $in: students.map(student => student._id) },
                $or: targetTupleFilters,
            })
                .select("student classSection subject session grade status createdAt")
                .sort({ createdAt: -1 })
                .lean()
            for (const result of results) {
                const studentId = String(result.student)
                if (!resultsByStudent.has(studentId) &&
                    targetTupleKeys.has(assignmentKey(
                        result.classSection,
                        result.subject,
                        result.session
                    ))) {
                    resultsByStudent.set(studentId, result)
                }
            }
        }

        const enriched = students.map(student => {
            const studentId = String(student._id)
            const attendanceTotals = attendanceByStudent.get(studentId) || {
                total: 0,
                present: 0,
            }
            const recordCount = recordsByStudent.get(studentId) || 0
            const result = resultsByStudent.get(studentId)
            const attPct = attendanceTotals.total > 0
                ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100)
                : null
            const latestGrade = result?.grade || null
            const latestStatus = result?.status || null
            const hasMarks = recordCount > 0
            const academicStatus =
                latestGrade === "A" ? "Excellent" :
                latestGrade === "B" ? "Good" :
                latestGrade === "C" ? "Average" :
                latestGrade === "F" ? "Needs Attention" :
                hasMarks ? "In Progress" : "No Records"

            return {
                _id: student._id,
                name: student.name,
                rollNo: student.rollNo,
                email: student.email,
                contact: student.contact,
                image: student.image,
                status: student.status,
                feeStatus: student.feeStatus,
                program: student.program?.name,
                programId: student.program?._id,
                attPct,
                totalAtt: attendanceTotals.total,
                presentAtt: attendanceTotals.present,
                recordCount,
                hasMarks,
                latestGrade,
                latestStatus,
                academicStatus,
            }
        })

        let finalList = enriched
        if (attStatus === "low") {
            finalList = finalList.filter(student =>
                student.attPct != null && student.attPct < 75
            )
        }
        if (attStatus === "good") {
            finalList = finalList.filter(student =>
                student.attPct != null && student.attPct >= 75
            )
        }
        const pageNumber = Number(page)
        const pageSize = Number(limit)
        const skip = (pageNumber - 1) * pageSize
        const total = finalList.length
        const paginated = finalList.slice(skip, skip + pageSize)

        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)
        const allClassIds = classes.map(cls => cls._id)
        const attendanceToday = allClassIds.length
            ? await Attendance.find({
                teacher: teacher._id,
                classSection: { $in: allClassIds },
                date: { $gte: todayStart, $lte: todayEnd },
            })
                .select("classSection subject session")
                .lean()
            : []
        const attendanceTupleKeys = new Set(attendanceToday
            .map(record => assignmentKey(record.classSection, record.subject, record.session))
            .filter(key => context.tupleKeys.has(key)))
        const classKeys = new Map()
        for (const tuple of context.tuples) {
            const classKey = String(tuple.classSection)
            if (!classKeys.has(classKey)) classKeys.set(classKey, new Set())
            classKeys.get(classKey).add(assignmentKey(
                tuple.classSection,
                tuple.subject,
                tuple.session
            ))
        }
        const attendancePending = [...classKeys.values()].filter(keys =>
            [...keys].some(key => !attendanceTupleKeys.has(key))
        ).length

        return res.status(200).json({
            stats: {
                totalStudents: students.length,
                totalClasses: classes.length,
                totalSubjects: subjects.length,
                attendancePending,
                marksPending: null,
                resultsPending: null,
            },
            students: paginated,
            pagination: {
                total,
                page: pageNumber,
                pages: Math.ceil(total / pageSize),
            },
            classes,
            subjects,
        })
    } catch (error) {
        return res.status(500).json({ message: "Server Error", error: error.message })
    }
}

export const getStudentProfileForTeacher = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("teacherId")
        if (!user) return res.status(404).json({ message: "User not found." })
        if (!user.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })

        const teacher = await Teacher.findById(user.teacherId)
        if (!teacher) return res.status(404).json({ message: "Teacher not found." })

        const context = await getAssignmentContext(teacher._id)
        const classIds = context.classes.map(cls => cls._id)
        const tupleFilters = context.tuples.map(assignmentFilter)
        const tupleKeys = context.tupleKeys
        const { studentId } = req.params
        const studentActivity = classIds.length && tupleFilters.length
            ? await getTupleStudentRecords(teacher._id, classIds)
            : { attendance: [], academicRecords: [] }
        const accessibleStudentIds = await getCurrentlyEnrolledStudentIds(
            context.tuples,
            context.classes
        )

        if (!accessibleStudentIds.has(String(studentId))) {
            return res.status(403).json({ message: "Student not found in your assigned classes." })
        }

        const student = await Student.findOne({
            _id: studentId,
            status: "active",
        })
            .select("name rollNo email contact image status feeStatus program dateOfAdmission documentsVerified")
            .populate("program", "name")

        if (!student) {
            return res.status(403).json({ message: "Student not found in your assigned classes." })
        }

        const attendanceRecords = studentActivity.attendance.filter(record =>
            String(record.student) === String(student._id) &&
            recordMatchesTuples(record, tupleKeys)
        )
        const totalAtt = attendanceRecords.length
        const presentAtt = attendanceRecords.filter(record => record.status === "present").length
        const lateAtt = attendanceRecords.filter(record => record.status === "late").length
        const absentAtt = totalAtt - presentAtt - lateAtt
        const attPct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null

        const records = await AcademicRecord.find({
            teacher: teacher._id,
            student: student._id,
            $or: tupleFilters,
            status: "verified",
        })
            .populate("subject", "name code")
            .sort({ createdAt: -1 })
        const avgMarks = records.length
            ? Math.round(records.reduce((sum, record) => sum + record.marks, 0) / records.length)
            : null

        const latestResults = tupleFilters.length
            ? await Result.find({ student: student._id, $or: tupleFilters })
                .sort({ createdAt: -1 })
                .populate("subject", "name code")
                .select("grade status marksPercentage subject session classSection")
            : []
        const latestResult = latestResults.find(result =>
            tupleKeys.has(assignmentKey(
                result.classSection,
                result.subject?._id || result.subject,
                result.session
            ))
        ) || null

        const sessionNames = [...new Set(context.tuples.map(tuple => tuple.session))]
        const academicSessions = await AcademicSession.find({
            name: { $in: sessionNames },
        })
            .select("_id name")
            .lean()
        const sessionIdsByName = new Map(
            academicSessions.map(session => [session.name, session._id])
        )
        const enrollmentTuples = [...new Map(context.tuples
            .flatMap(tuple => {
                const academicSession = sessionIdsByName.get(tuple.session)
                if (!academicSession) return []
                const key = JSON.stringify([String(tuple.classSection), String(academicSession)])
                return [[key, {
                    classSection: tuple.classSection,
                    academicSession,
                }]]
            })).values()]
        const today = utcToday()
        const currentEnrollments = enrollmentTuples.length
            ? await StudentEnrollment.find({
                student: student._id,
                status: "active",
                startDate: { $lte: today },
                $and: [
                    { $or: [{ endDate: null }, { endDate: { $gte: today } }] },
                    { $or: enrollmentTuples },
                ],
            })
                .select("classSection academicSession")
                .lean()
            : []
        const classPrograms = new Map(
            context.classes.map(cls => [String(cls._id), cls.programId?.toString()])
        )
        const studentProgramId = student.program?._id?.toString()
        const enrolledClassSessions = new Set(currentEnrollments
            .filter(enrollment =>
                classPrograms.get(String(enrollment.classSection)) === studentProgramId
            )
            .map(enrollment => {
                const sessionName = academicSessions.find(session =>
                    String(session._id) === String(enrollment.academicSession)
                )?.name
                return JSON.stringify([String(enrollment.classSection), sessionName])
            }))
        const eligibleAssignmentFilters = context.tuples
            .filter(tuple => enrolledClassSessions.has(JSON.stringify([
                String(tuple.classSection),
                tuple.session,
            ])))
            .map(assignmentFilter)

        const subjectMap = new Map()
        const assignments = eligibleAssignmentFilters.length
            ? await AcademicAssignment.find({
                teacher: teacher._id,
                isActive: true,
                $or: eligibleAssignmentFilters,
            })
                .populate("classSection", "name section")
                .populate("subject", "name code creditHours")
                .lean()
            : []
        for (const assignment of assignments) {
            const cls = assignment.classSection
            const subject = assignment.subject
            if (!cls?._id || !subject?._id) continue
            const subjectId = String(subject._id)
            if (!subjectMap.has(subjectId)) {
                subjectMap.set(subjectId, {
                    _id: subject._id,
                    name: subject.name,
                    code: subject.code,
                    creditHours: subject.creditHours,
                    classes: new Map(),
                })
            }
            subjectMap.get(subjectId).classes.set(String(cls._id), `${cls.name} — ${cls.section}`)
        }
        const enrolledSubjects = [...subjectMap.values()].map(subject => ({
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            creditHours: subject.creditHours,
            classes: [...subject.classes.values()],
        }))

        const [recentRecords, recentAttendance] = await Promise.all([
            AcademicRecord.find({
                teacher: teacher._id,
                student: student._id,
                $or: tupleFilters,
            })
                .sort({ createdAt: -1 }).limit(5)
                .populate("subject", "name code")
                .populate("classSection", "name section"),
            Attendance.find({
                teacher: teacher._id,
                student: student._id,
                $or: tupleFilters,
            })
                .sort({ date: -1 }).limit(5)
                .populate("subject", "name")
                .populate("classSection", "name section"),
        ])
        const recentActivity = [
            ...recentRecords.map(record => ({
                icon: "📝",
                message: `${record.examType} marks entered`,
                meta: `${record.subject?.name || ""} · ${record.marks} marks · ${record.classSection?.name || ""} ${record.classSection?.section || ""}`,
                time: record.createdAt,
            })),
            ...recentAttendance.map(record => ({
                icon: record.status === "present" ? "✅" : record.status === "late" ? "🕐" : "❌",
                message: `Attendance: ${record.status}`,
                meta: `${record.subject?.name || ""} · ${record.classSection?.name || ""} ${record.classSection?.section || ""} · ${new Date(record.date).toLocaleDateString()}`,
                time: record.createdAt,
            })),
        ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)

        return res.status(200).json({
            student: {
                _id: student._id,
                name: student.name,
                rollNo: student.rollNo,
                email: student.email,
                contact: student.contact,
                image: student.image,
                status: student.status,
                feeStatus: student.feeStatus,
                program: student.program?.name,
                dateOfAdmission: student.dateOfAdmission,
                documentsVerified: student.documentsVerified,
            },
            attendance: { totalAtt, presentAtt, lateAtt, absentAtt, attPct },
            academic: {
                totalRecords: records.length,
                avgMarks,
                latestGrade: latestResult?.grade || null,
                latestStatus: latestResult?.status || null,
                latestSubject: latestResult?.subject?.name || null,
                latestSession: latestResult?.session || null,
            },
            enrolledSubjects,
            recentActivity,
        })
    } catch (error) {
        return res.status(500).json({ message: "Server Error", error: error.message })
    }
}
