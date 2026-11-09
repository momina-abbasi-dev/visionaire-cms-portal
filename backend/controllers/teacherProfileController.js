import User           from "../models/User.js"
import Student        from "../models/Student.js"
import Teacher        from "../models/Teacher.js"
import ClassSection   from "../models/ClassSection.js"

export const getTeacherProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password")
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })

        const teacher = await Teacher.findById(user.teacherId)
            .populate("department", "name code")
        if (!teacher) return res.status(404).json({ message: "Teacher not found." })

        // ── assigned classes (where this teacher is classTeacher) ──────────────
        const classes = await ClassSection.find({ classTeacher: teacher._id })
            .populate("program",  "name")
            .populate("subjects", "name code creditHours")

        // ── student counts per class ───────────────────────────────────────────
        const classCards = await Promise.all(classes.map(async (cls) => {
            const studentCount = await Student.countDocuments({
                program: cls.program?._id, status: "active"
            })
            return {
                _id:          cls._id,
                name:         cls.name,
                section:      cls.section,
                semester:     cls.semester,
                program:      cls.program?.name,
                studentCount,
                subjects:     cls.subjects?.map(s => ({ _id:s._id, name:s.name, code:s.code, creditHours:s.creditHours })),
            }
        }))

        // ── unique subjects across all assigned classes ─────────────────────────
        const subjectMap = {}
        for (const cls of classes) {
            for (const s of (cls.subjects || [])) {
                if (s?._id && !subjectMap[s._id.toString()]) {
                    subjectMap[s._id.toString()] = {
                        _id: s._id, name: s.name, code: s.code, creditHours: s.creditHours,
                        classes: []
                    }
                }
                if (s?._id) {
                    subjectMap[s._id.toString()].classes.push(`${cls.name} — ${cls.section}`)
                }
            }
        }
        const assignedSubjects = Object.values(subjectMap)

        // ── total students across all classes ──────────────────────────────────
        const totalStudents = classCards.reduce((s, c) => s + c.studentCount, 0)

        // ── years of service ───────────────────────────────────────────────────
        const yearsOfService = Math.floor(
            (new Date() - new Date(teacher.createdAt)) / (1000 * 60 * 60 * 24 * 365)
        )

        res.status(200).json({
            teacher: {
                _id:                teacher._id,
                name:               teacher.name,
                registrationNo:     teacher.registrationNo,
                email:              teacher.email,
                cnic:               teacher.cnic,
                contact:            teacher.contact,
                dob:                teacher.dob,
                address:            teacher.address,
                city:               teacher.city,
                image:              teacher.image,
                education:          teacher.education,
                educationDocuments: teacher.educationDocuments,
                department:         teacher.department?.name,
                departmentCode:     teacher.department?.code,
                status:             teacher.status,
                role:               teacher.role,
                createdAt:          teacher.createdAt,
                yearsOfService,
            },
            account: {
                _id:       user._id,
                email:     user.email,
                role:      user.role,
                status:    user.status,
                createdAt: user.createdAt,
            },
            stats: {
                assignedClasses:  classCards.length,
                assignedSubjects: assignedSubjects.length,
                totalStudents,
                yearsOfService,
            },
            classCards,
            assignedSubjects,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}

export const updateTeacherProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.teacherId) return res.status(404).json({ message: "Teacher profile not linked." })

        // ONLY allow these fields
        const { contact, address, city, image } = req.body
        const allowed = {}
        if (contact !== undefined) allowed.contact = contact
        if (address !== undefined) allowed.address = address
        if (city    !== undefined) allowed.city    = city
        if (image   !== undefined) allowed.image   = image

        const updated = await Teacher.findByIdAndUpdate(user.teacherId, allowed, { new: true })
            .populate("department", "name code")
        if (!updated) return res.status(404).json({ message: "Teacher not found." })

        res.status(200).json({ message: "Profile updated successfully.", teacher: updated })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}

export const changeTeacherPassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body
        if (!currentPassword || !newPassword || !confirmPassword)
            return res.status(400).json({ message: "All password fields are required." })
        if (newPassword !== confirmPassword)
            return res.status(400).json({ message: "New password and confirm password do not match." })
        if (newPassword.length < 6)
            return res.status(400).json({ message: "Password must be at least 6 characters." })

        const user = await User.findById(req.user.id)
        const isMatch = await user.comparePassword(currentPassword)
        if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." })

        user.password = newPassword
        await user.save()

        res.status(200).json({ message: "Password changed successfully." })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}
