import User           from "../models/User.js"
import Student        from "../models/Student.js"
import FeesFinance     from "../models/FeesFinance.js"

export const getStudentFees = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
        if (!user?.studentId) return res.status(404).json({ message: "Student profile not linked." })
        const studentId = user.studentId

        const student = await Student.findById(studentId)
            .populate({ path: "program", populate: { path: "department", select: "name code" } })
        if (!student) return res.status(404).json({ message: "Student not found." })

        // ── all challans for this student ──────────────────────────────────────
        // auto-mark overdue first
        await FeesFinance.updateMany(
            { student: studentId, status: { $in: ["unpaid", "partial"] }, dueDate: { $lt: new Date() } },
            { $set: { status: "overdue" } }
        )

        const challans = await FeesFinance.find({ student: studentId })
            .populate("program",      "name")
            .populate("classSection", "name section")
            .populate("generatedBy",  "name")
            .sort({ createdAt: -1 })

        // ── fee summary ────────────────────────────────────────────────────────
        const activeChallans  = challans.filter(c => c.status !== "cancelled")
        const totalFee        = activeChallans.reduce((s, c) => s + c.totalFee, 0)
        const totalPaid       = activeChallans.reduce((s, c) => s + c.paidAmount, 0)
        const totalDiscount   = activeChallans.reduce((s, c) => s + (c.discount || 0), 0)
        const totalLateFee    = activeChallans.reduce((s, c) => s + (c.lateFee || 0), 0)
        const netPayable      = totalFee + totalLateFee - totalDiscount
        const outstandingBal  = Math.max(0, netPayable - totalPaid)

        const unpaidChallans  = challans.filter(c => ["unpaid", "partial", "overdue"].includes(c.status))
        const nextDue         = unpaidChallans.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null

        // overall payment status
        const overallStatus =
            challans.length === 0 ? "no_records" :
            outstandingBal === 0 && activeChallans.length > 0 ? "paid" :
            unpaidChallans.some(c => c.status === "overdue") ? "overdue" :
            unpaidChallans.length > 0 ? "pending" :
            activeChallans.length === 0 ? "cancelled" : "pending"

        // ── payment history: flatten all payments across challans ──────────────
        const paymentHistory = challans.flatMap(c =>
            (c.payments || []).map(p => ({
                _id:        p._id,
                challanId:  c.challanId,
                semester:   c.semester,
                amount:     p.amount,
                method:     p.method,
                reference:  p.reference,
                paidAt:     p.paidAt,
                status:     "completed",
            }))
        ).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))

        // ── upcoming payments (unpaid sorted by due date) ──────────────────────
        const upcoming = unpaidChallans
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .map(c => ({
                _id:       c._id,
                challanId: c.challanId,
                semester:  c.semester,
                session:   c.session,
                balance:   c.totalFee + (c.lateFee || 0) - (c.discount || 0) - c.paidAmount,
                dueDate:   c.dueDate,
                status:    c.status,
                daysLeft:  Math.ceil((new Date(c.dueDate) - new Date()) / (1000 * 60 * 60 * 24)),
            }))

        // ── payment notices ────────────────────────────────────────────────────
        const notices = []
        for (const c of challans.slice(0, 5)) {
            if (c.status === "overdue")
                notices.push({ level:"danger",  icon:"🚨", message:`${c.challanId} is overdue. Please pay immediately.`, date: c.dueDate })
            else if (c.status === "paid" && c.payments?.length)
                notices.push({ level:"success", icon:"✅", message:`Payment received for ${c.challanId} (${c.semester}).`, date: c.payments[c.payments.length-1]?.paidAt })
            else if (["unpaid","partial"].includes(c.status)) {
                const days = Math.ceil((new Date(c.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
                if (days <= 7)
                    notices.push({ level:"warning", icon:"⚠️", message:`Fee due in ${days} day(s) for ${c.semester}.`, date: c.dueDate })
                else
                    notices.push({ level:"info",    icon:"📄", message:`Challan ${c.challanId} generated for ${c.semester}.`, date: c.createdAt })
            }
        }

        // ── serialize challans for frontend ────────────────────────────────────
        const challanList = challans.map(c => ({
            _id:          c._id,
            challanId:    c.challanId,
            semester:     c.semester,
            session:      c.session,
            program:      c.program?.name,
            classSection: c.classSection ? `${c.classSection.name} — ${c.classSection.section}` : null,
            totalFee:     c.totalFee,
            discount:     c.discount || 0,
            lateFee:      c.lateFee  || 0,
            paidAmount:   c.paidAmount,
            netPayable:   c.totalFee + (c.lateFee || 0) - (c.discount || 0),
            balance:      c.totalFee + (c.lateFee || 0) - (c.discount || 0) - c.paidAmount,
            dueDate:      c.dueDate,
            paidAt:       c.paidAt,
            status:       c.status,
            notes:        c.notes,
            generatedBy:  c.generatedBy?.name,
            createdAt:    c.createdAt,
            payments:     (c.payments || []).map(p => ({
                _id: p._id, amount: p.amount, method: p.method,
                reference: p.reference, paidAt: p.paidAt,
            })),
        }))

        res.status(200).json({
            student: {
                name:       student.name,
                rollNo:     student.rollNo,
                program:    student.program?.name,
                department: student.program?.department?.name,
                image:      student.image,
            },
            summary: {
                totalFee, totalPaid, totalDiscount, totalLateFee,
                netPayable, outstandingBalance: outstandingBal,
                activeChallanCount: unpaidChallans.length,
                overallStatus,
                nextDueDate:   nextDue?.dueDate    || null,
                nextDueAmount: nextDue ? nextDue.totalFee + (nextDue.lateFee||0) - (nextDue.discount||0) - nextDue.paidAmount : 0,
                nextChallanId: nextDue?.challanId   || null,
            },
            challans:       challanList,
            paymentHistory,
            upcoming,
            notices,
        })
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message })
    }
}