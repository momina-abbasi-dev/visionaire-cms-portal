import User           from "../models/User.js"
import Student        from "../models/Student.js"
import Teacher        from "../models/Teacher.js"
import Department     from "../models/Department.js"
import ClassSection   from "../models/ClassSection.js"
import Admission      from "../models/Admission.js"
import AcademicRecord from "../models/AcademicRecord.js"
import Result         from "../models/Result.js"
import Attendance     from "../models/Attendance.js"
import FeesFinance      from "../models/FeesFinance.js"
import AcademicAssignment from "../models/AcademicAssignment.js"
import StudentEnrollment from "../models/StudentEnrollment.js"
import AcademicSession from "../models/AcademicSession.js"

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

export const getStudentProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password")
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })

        const student = await Student.findById(user.studentId)
            .populate({ path: "program", populate: { path: "department", select: "name code" } })
        if (!student) return res.status(404).json({ message: "Student not found." })

        // attendance summary
        let attendance = null
        try {
            const total   = await Attendance.countDocuments({ student: student._id })
            const present = await Attendance.countDocuments({ student: student._id, status: "present" })
            const late    = await Attendance.countDocuments({ student: student._id, status: "late" })
            if (total > 0) attendance = {
                total, present, late,
                absent: total - present - late,
                percentage: Math.round(((present + late) / total) * 100),
            }
        } catch (_) {_}

        // latest result
        let latestResult = null
        try {
            latestResult = await Result.findOne({ student: student._id })
                .sort({ createdAt: -1 })
                .populate("subject", "name code")
                .select("grade status session marksPercentage subject")
        } catch (_) {_}

        // fee status
        let feeInfo = null
        try {
            const challan = await FeesFinance.findOne({
                student: student._id,
                status: { $in: ["unpaid", "partial", "overdue"] }
            }).sort({ dueDate: 1 }).select("challanId status totalFee paidAmount dueDate semester")
            if (challan) {
                feeInfo = {
                    status:     challan.status,
                    balance:    challan.totalFee - challan.paidAmount,
                    dueDate:    challan.dueDate,
                    semester:   challan.semester,
                    challanId:  challan.challanId,
                }
            } else {
                const paid = await FeesFinance.findOne({
                    student: student._id,
                    status: "paid",
                }).select("_id")
                if (paid) {
                    feeInfo = { status: "paid", balance: 0 }
                } else {
                    const hasFeeRecords = await FeesFinance.exists({ student: student._id })
                    feeInfo = {
                        status: hasFeeRecords ? "cancelled" : "no_records",
                        balance: 0,
                    }
                }
            }
        } catch (_) {_}

        // enrolled subjects count from current enrollments and their active assignments
        let enrolledSubjects = 0
        try {
            enrolledSubjects = await countCurrentlyEnrolledSubjects(
                student._id,
                student.program?._id
            )
        } catch (_) {_}

        res.status(200).json({
            student: {
                _id:                      student._id,
                name:                     student.name,
                rollNo:                   student.rollNo,
                email:                    student.email,
                cnic:                     student.cnic,
                dob:                      student.dob,
                contact:                  student.contact,
                address:                  student.address,
                city:                     student.city,
                image:                    student.image,
                status:                   student.status,
                feeStatus:                student.feeStatus,
                dateOfAdmission:          student.dateOfAdmission,
                documentsVerified:        student.documentsVerified,
                previousAcademicDocument: student.previousAcademicDocument,
                program:                  student.program?.name,
                programId:                student.program?._id,
                department:               student.program?.department?.name,
                departmentCode:           student.program?.department?.code,
            },
            account: {
                _id:       user._id,
                email:     user.email,
                role:      user.role,
                status:    user.status,
                createdAt: user.createdAt,
            },
            stats: {
                attendancePercent: attendance?.percentage ?? 0,
                attendanceTotal:   attendance?.total ?? 0,
                attendancePresent: attendance?.present ?? 0,
                latestGrade:       latestResult?.grade || null,
                latestResultStatus:latestResult?.status || null,
                latestSession:     latestResult?.session || null,
                feeStatus:         feeInfo?.status || "unavailable",
                feeBalance:        feeInfo?.balance || 0,
                enrolledSubjects,
            },
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}

export const updateStudentProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })

        // ONLY allow these fields — no academic/admin fields
        const { contact, address, city, image } = req.body
        const allowed = {}
        if (contact) allowed.contact = contact
        if (address) allowed.address = address
        if (city)    allowed.city    = city
        if (image)   allowed.image   = image

        const updated = await Student.findByIdAndUpdate(user.studentId, allowed, { new: true })
            .populate({ path: "program", populate: { path: "department", select: "name code" } })

        if (!updated) return res.status(404).json({ message: "Student not found." })

        res.status(200).json({ message: "Profile updated successfully.", student: updated })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}

export const changeStudentPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        if (!currentPassword || !newPassword || !confirmPassword)
            return res.status(400).json({ message: "All password fields are required." })
        if (newPassword !== confirmPassword)
            return res.status(400).json({ message: "New password and confirm password do not match." })
        if (newPassword.length < 6)
            return res.status(400).json({ message: "New password must be at least 6 characters." })

        const user = await User.findById(req.user.id)
        const isMatch = await user.comparePassword(currentPassword)
        if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." })

        user.password = newPassword   // pre-save hook will hash it
        await user.save()

        res.status(200).json({ message: "Password changed successfully." })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}