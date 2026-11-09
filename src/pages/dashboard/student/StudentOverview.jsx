import { useState, useEffect } from "react"
import { useNavigate }         from "react-router-dom"
import { getStudentOverview }  from "../../../services/dashboardService.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faBookOpen,
    faCalendarCheck,
    faChartLine,
    faCreditCard,
    faGraduationCap,
} from "@fortawesome/free-solid-svg-icons"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { Panel } from "../../../components/ui/Panel.jsx"

// ── helpers ────────────────────────────────────────────────────────────────────

const fmt = (d) => d ? new Date(d).toLocaleDateString() : "—"

const fmtPKR = (n) => n != null ? `PKR ${Number(n).toLocaleString()}` : "—"

const statusClass = (status) => {
    if (status === "active" || status === "pass" || status === "paid") return "status-success"
    if (status === "partial") return "status-pending"
    if (["pending", "overdue", "unpaid", "fail"].includes(status)) return "status-error"
    return "status-neutral"
}

// ── component ──────────────────────────────────────────────────────────────────

export default function StudentOverview() {
    const navigate = useNavigate()

    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await getStudentOverview()
                setData(res.data)
            } catch (e) {
                setError("Failed to load dashboard.")
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [])

    if (loading) return (
        <div className="dashboard-loading">
            <div className="dashboard-loading-icon">
                <FontAwesomeIcon icon={faGraduationCap} aria-hidden="true" />
            </div>
            <p>Loading your dashboard...</p>
        </div>
    )

    if (error) return (
        <div className="alert alert-error" role="alert">{error}</div>
    )

    const { student, stats, latestMarks, attendance, latestResult, feeInfo, pendingActions } = data
    const feeStatusLabel = (status) => {
        if (status === "no_records") return "No Fee Records"
        if (!status || status === "unavailable") return "Unavailable"
        return status.charAt(0).toUpperCase() + status.slice(1)
    }

    // ── quick access config ────────────────────────────────────────────────────
    const quickAccess = [
        { icon: faChartLine, label: "Academic Records", path: "/student/dashboard/student-academic-records" },
        { icon: faCalendarCheck, label: "View Attendance", path: "/student/dashboard/student-attendance" },
        { icon: faCreditCard, label: "Fees", path: "/student/dashboard/student-fees" },
    ]

    // ── render ─────────────────────────────────────────────────────────────────
    return (
        <div className="dashboard-page overview-dashboard">

            <PageHeader
                title={`Welcome, ${student.name}`}
                description="Your academic progress at a glance."
            />

            <div className="overview-kpi-grid">
                <SummaryCard
                    icon={faCalendarCheck}
                    title="Attendance"
                    value={stats.attendancePercent != null ? `${stats.attendancePercent}%` : "N/A"}
                    supporting={attendance ? `${attendance.present} / ${attendance.total} classes` : "Not recorded yet"}
                    variant={stats.attendancePercent != null && stats.attendancePercent < 75 ? "error" : "success"}
                />
                <SummaryCard
                    icon={faChartLine}
                    title="Academic Performance"
                    value={stats.gpa != null ? stats.gpa.toFixed(1) : "N/A"}
                    supporting={stats.percentage != null ? `${stats.percentage}% overall` : "No records yet"}
                />
                <SummaryCard
                    icon={faBookOpen}
                    title="Enrolled Subjects"
                    value={stats.enrolledSubjects ?? 0}
                    supporting="Current enrollment"
                />
                <SummaryCard
                    icon={faGraduationCap}
                    title="Latest Result"
                    value={latestResult?.grade || "N/A"}
                    supporting={latestResult ? `Semester ${latestResult.semester}` : "Not published yet"}
                    variant={latestResult?.status === "pass" ? "success" : latestResult ? "error" : "default"}
                />
            </div>

            {pendingActions?.length > 0 && (
                <div className="student-overview-alert-list">
                    {pendingActions.map((action, i) => {
                        const alertLevel = action.level === "danger"
                            ? "error"
                            : ["warning", "info"].includes(action.level)
                                ? action.level
                                : "info"
                        return (
                            <div key={i} className={`alert alert-${alertLevel} student-overview-alert`}>
                                <span className="alert-icon">{action.icon}</span>
                                <span>{action.message}</span>
                                {action.type === "fee" && feeInfo?._id && (
                                    <button
                                        type="button"
                                        className="btn btn-tertiary btn-sm"
                                        onClick={() => navigate("/student/dashboard/student-fees")}
                                    >
                                        Pay Now
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="dashboard-main-grid">
                <div className="dashboard-main-column">
                    <Panel title="Attendance Summary">
                        {attendance ? (
                            <>
                                <div className="student-overview-attendance">
                                    <strong>{attendance.percentage}%</strong>
                                    <span>Overall attendance</span>
                                </div>
                                <div
                                    className="student-overview-progress"
                                    role="progressbar"
                                    aria-label="Attendance percentage"
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                    aria-valuenow={attendance.percentage}
                                >
                                    <div
                                        className={`student-overview-progress-fill${attendance.percentage < 75 ? " is-below-target" : ""}`}
                                        style={{ width: `${attendance.percentage}%` }}
                                    />
                                </div>
                                <div className="student-overview-detail-list">
                                    {[
                                        ["Present", attendance.present],
                                        ["Absent", attendance.absent],
                                        ["Total", attendance.total],
                                    ].map(([label, value]) => (
                                        <div key={label} className="student-overview-detail-row">
                                            <span>{label}</span>
                                            <strong>{value}</strong>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="student-overview-empty">Attendance not recorded yet.</p>
                        )}
                    </Panel>

                    <Panel title="Recent Marks">
                        {latestMarks.length === 0 ? (
                            <p className="student-overview-empty">No verified marks yet.</p>
                        ) : (
                            <div className="student-overview-list">
                                {latestMarks.map((m, i) => (
                                    <div key={i} className="student-overview-list-row">
                                        <div className="student-overview-list-primary">
                                            {m.subject}
                                            <span className="student-overview-list-secondary">
                                                {m.code} · {m.examType}
                                            </span>
                                        </div>
                                        <span className={`status ${m.marks >= 80 ? "status-success" : m.marks >= 60 ? "status-pending" : "status-error"}`}>
                                            {m.marks}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>
                <div className="dashboard-side-column">
                    <Panel title="Current Enrollment">
                        <div className="student-overview-detail-list">
                            {[
                                ["Program", student.program],
                                ["Department", student.department],
                                ["Roll number", student.rollNo],
                            ].map(([label, value]) => (
                                <div key={label} className="student-overview-detail-row">
                                    <span>{label}</span>
                                    <strong>{value ?? "—"}</strong>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel title="Latest Result">
                        {latestResult ? (
                            <div className="student-overview-detail-list">
                                {[
                                    ["Grade", latestResult.grade],
                                    ["Semester", latestResult.semester],
                                    ["Session", latestResult.session],
                                    ["GPA", latestResult.gpa],
                                    ["Status", latestResult.status],
                                ].map(([label, value]) => (
                                    <div key={label} className="student-overview-detail-row">
                                        <span>{label}</span>
                                        <strong className={label === "Status" ? `status ${value === "pass" ? "status-success" : "status-error"}` : undefined}>
                                            {value ?? "—"}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="student-overview-empty">No result published yet.</p>
                        )}
                    </Panel>

                    <Panel title="Fee Status">
                        {feeInfo ? (
                            <div className="student-overview-detail-list">
                                <div className="student-overview-detail-row">
                                    <span>Status</span>
                                    <strong className={`status ${statusClass(feeInfo.status)}`}>
                                        {feeStatusLabel(feeInfo.status)}
                                    </strong>
                                </div>
                                {feeInfo.balance > 0 && (
                                    <div className="student-overview-detail-row">
                                        <span>Outstanding</span>
                                        <strong>{fmtPKR(feeInfo.balance)}</strong>
                                    </div>
                                )}
                                {feeInfo.dueDate && feeInfo.balance > 0 && (
                                    <div className="student-overview-detail-row">
                                        <span>Due date</span>
                                        <strong>{fmt(feeInfo.dueDate)}</strong>
                                    </div>
                                )}
                                {feeInfo.status === "paid" && (
                                    <p className="student-overview-empty">
                                        All fees paid. No pending dues.
                                    </p>
                                )}
                                {feeInfo.status === "no_records" && (
                                    <p className="student-overview-empty">
                                        No fee challans are recorded for your account.
                                    </p>
                                )}
                                {feeInfo.status === "cancelled" && (
                                    <p className="student-overview-empty">
                                        No active fee challans are recorded for your account.
                                    </p>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-tertiary btn-sm"
                                    onClick={() => navigate("/student/dashboard/student-fees")}
                                >
                                    View fees
                                </button>
                            </div>
                        ) : (
                            <p className="student-overview-empty">
                                Fee status could not be determined.
                            </p>
                        )}
                    </Panel>

                    <Panel title="Quick Access">
                        <div className="student-overview-quick-access">
                            {quickAccess.map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => navigate(item.path)}
                                    className="student-overview-quick-link"
                                >
                                    <span className="student-overview-quick-icon">
                                        <FontAwesomeIcon icon={item.icon} aria-hidden="true" />
                                    </span>
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>

        </div>
    )
}