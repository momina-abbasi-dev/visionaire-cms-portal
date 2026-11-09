import { useState, useEffect } from "react"
import { useNavigate }         from "react-router-dom"
import { Drawer } from "../../../components/ui/Drawer.jsx"
import { Tabs }   from "../../../components/ui/Tabs.jsx"
import { Panel }  from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx"
import { getTeacherSubjects } from "../../../services/teacherSubjectsService.js"

// ── style maps ─────────────────────────────────────────────────────────────────

const SUBJECT_STATUS_CLASS = {
    Active: "status-active",
    Completed: "status-info",
    "Marks Pending": "status-pending",
    "Attention Required": "status-error",
}

const RESULT_STATUS_CLASS = {
    Published: "status-success",
    Pending: "status-pending",
    "Not Published": "status-neutral",
}

// ── helpers ────────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)
    if (diff < 60)    return `${diff}s ago`
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

const pctColor = (p) =>
    p >= 80 ? "#16a34a" : p >= 65 ? "#1e40af" : p >= 50 ? "#f59e0b" : "#ef4444"

// ── reusable mini components ───────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, urgent }) => (
    <SharedSummaryCard
        title={label}
        value={value ?? "—"}
        supporting={sub}
        variant={urgent ? "warning" : "default"}
    />
)

const StatusBadge = ({ status }) => {
    return <span className={`status ${SUBJECT_STATUS_CLASS[status] || "status-active"}`}>{status}</span>
}

const ResultBadge = ({ status }) => {
    const recognizedStatus = Object.hasOwn(RESULT_STATUS_CLASS, status) ? status : null
    const label = recognizedStatus || "N/A"
    const className = RESULT_STATUS_CLASS[recognizedStatus] || "status-neutral"
    return <span className={`status ${className}`}>{label}</span>
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function TeacherSubjects() {
    const navigate = useNavigate()

    // ── data ──────────────────────────────────────────────────────────────────
    const [data,    setData]    = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    // ── filters ────────────────────────────────────────────────────────────────
    const [search,       setSearch]       = useState("")
    const [creditFilter, setCreditFilter] = useState("All")
    const [statusFilter, setStatusFilter] = useState("All")

    // ── drawer ─────────────────────────────────────────────────────────────────
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [selected,   setSelected]   = useState(null)
    const [drawerTab,  setDrawerTab]  = useState("info")

    // ── fetch ──────────────────────────────────────────────────────────────────

    const fetchSubjects = () => {
        setLoading(true)
        getTeacherSubjects()
            .then(r  => setData(r.data))
            .catch(e => { setError("Failed to load subjects."); console.error(e) })
            .finally(() => setLoading(false))
    }

    useEffect(() => { fetchSubjects() }, [])

    // ── loading / error states ─────────────────────────────────────────────────

    if (loading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p>
            <p>Loading your subjects...</p>
        </div>
    )
    if (error) return <div style={{ padding:"2rem", color:"#ef4444" }}>{error}</div>

    const { stats, subjects } = data

    // ── filter options ─────────────────────────────────────────────────────────
    const creditOptions = [
        "All",
        ...new Set(subjects.map(s => s.creditHours).filter(Boolean).sort((a, b) => a - b))
    ]

    // ── filtered subjects ──────────────────────────────────────────────────────
    const filtered = subjects.filter(s => {
        const q = search.toLowerCase()
        if (search &&
            !s.name?.toLowerCase().includes(q) &&
            !s.code?.toLowerCase().includes(q) &&
            !s.department?.toLowerCase().includes(q)
        ) return false
        if (creditFilter !== "All" && String(s.creditHours) !== String(creditFilter)) return false
        if (statusFilter !== "All" && s.subjectStatus !== statusFilter) return false
        return true
    })

    const openDrawer = (subj) => {
        setSelected(subj)
        setDrawerTab("info")
        setDrawerOpen(true)
    }

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <div className="dashboard-page admin-page teacher-page">

            {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
            <PageHeader
                title="My Subjects"
                description="Manage your assigned subjects and academic activities."
                action={<button className="btn btn-secondary" onClick={fetchSubjects}>Refresh</button>}
            />

            {/* ══════════════════════════════════════════════
                SUMMARY CARDS
            ══════════════════════════════════════════════ */}
            <div className="summary-card-grid">
                <SummaryCard icon="📚" label="Subjects"
                    value={stats.totalSubjects}
                    sub="Assigned to you"
                    valueColor="#3b82f6"
                />
                <SummaryCard icon="🏫" label="Classes Covered"
                    value={stats.totalClasses}
                    sub="Across all subjects"
                    valueColor="#8b5cf6"
                />
                <SummaryCard icon="👨‍🎓" label="Total Students"
                    value={stats.totalStudents ?? "N/A"}
                    sub="Enrollment data unavailable"
                    valueColor={stats.totalStudents != null ? "#10b981" : "#6B7C78"}
                />
                <SummaryCard icon="📝" label="Pending Marks"
                    value={stats.totalPendingMarks ?? "N/A"}
                    sub="Students without marks"
                    valueColor={stats.totalPendingMarks == null
                        ? "#6B7C78"
                        : stats.totalPendingMarks > 0 ? "#f59e0b" : "#16a34a"}
                    urgent={stats.totalPendingMarks != null && stats.totalPendingMarks > 0}
                />
                <SummaryCard icon="📅" label="Attendance Pending"
                    value={stats.totalAttPending}
                    sub="Classes needing entry"
                    valueColor={stats.totalAttPending > 0 ? "#ef4444" : "#16a34a"}
                    urgent={stats.totalAttPending > 0}
                />
                <SummaryCard icon="📄" label="Results Pending"
                    value={stats.resultsPending ?? "N/A"}
                    sub="Subjects not published"
                    valueColor={stats.resultsPending == null
                        ? "#6B7C78"
                        : stats.resultsPending > 0 ? "#92400e" : "#16a34a"}
                />
            </div>

            {/* ══════════════════════════════════════════════
                SEARCH & FILTERS
            ══════════════════════════════════════════════ */}
            <SearchFilters
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search subjects, codes, or departments..."
                filters={[
                    {
                        id: "credit-hours",
                        label: "Credit Hrs:",
                        value: creditFilter,
                        onChange: setCreditFilter,
                        options: creditOptions,
                    },
                    {
                        id: "status",
                        label: "Status:",
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: ["All", ...Object.keys(SUBJECT_STATUS_CLASS)],
                    },
                ]}
                onReset={search || creditFilter !== "All" || statusFilter !== "All"
                    ? () => {
                        setSearch("");
                        setCreditFilter("All");
                        setStatusFilter("All");
                    }
                    : undefined}
            />

            {/* ══════════════════════════════════════════════
                EMPTY STATES
            ══════════════════════════════════════════════ */}
            {subjects.length === 0 ? (
                <div className="card" style={{ padding:"3rem", textAlign:"center", color:"#6B7C78" }}>
                    <p style={{ fontSize:"2.5rem" }}>📚</p>
                    <p style={{ fontWeight:600, marginTop:"0.5rem" }}>No Subjects Assigned</p>
                    <p style={{ fontSize:"0.875rem" }}>
                        Contact admin to assign subjects to your classes.
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                    <p style={{ fontSize:"1.5rem" }}>🔍</p>
                    <p style={{ fontSize:"0.875rem" }}>No subjects match your filters.</p>
                </div>
            ) : (

            /* ══════════════════════════════════════════════
                SUBJECT CARDS GRID
            ══════════════════════════════════════════════ */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((subj) => {
                    return (
                        <div key={subj._id} className="card"
                            style={{ padding:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>

                            {/* Card header */}
                            <div style={{ padding:"var(--space-3) var(--space-4)", borderBottom:"1px solid var(--color-divider)" }}>
                                <div style={{ display:"flex", justifyContent:"space-between",
                                    alignItems:"flex-start", gap:"0.5rem" }}>
                                    <div style={{ flex:1 }}>
                                        <h3 style={{ fontWeight:700, fontSize:"1rem",
                                            margin:0, color:"#1F2D2C" }}>
                                            {subj.name}
                                        </h3>
                                        <div style={{ display:"flex", gap:"0.5rem",
                                            alignItems:"center", marginTop:"0.375rem", flexWrap:"wrap" }}>
                                            <span style={{ fontFamily:"monospace",
                                                fontSize:"0.78rem", color:"#6B7C78" }}>
                                                {subj.code}
                                            </span>
                                            <span style={{ width:"3px", height:"3px",
                                                borderRadius:"50%", background:"#d1d5db" }} />
                                            <span className="badge badge-primary badge-sm">
                                                {subj.creditHours} cr hr{subj.creditHours !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>
                                    <StatusBadge status={subj.subjectStatus} />
                                </div>
                            </div>

                            {/* Card body */}
                            <div style={{ padding:"0.875rem 1.25rem", flex:1 }}>

                                {/* Dept + program */}
                                <div style={{ display:"flex", flexDirection:"column",
                                    gap:"0.25rem", marginBottom:"0.75rem", fontSize:"0.8rem" }}>
                                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                                        <span style={{ color:"#6B7C78" }}>🏢 Department</span>
                                        <span style={{ fontWeight:500 }}>{subj.department || "—"}</span>
                                    </div>
                                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                                        <span style={{ color:"#6B7C78" }}>🎓 Program</span>
                                        <span style={{ fontWeight:500 }}>{subj.program || "—"}</span>
                                    </div>
                                </div>

                                {/* Stats chips */}
                                <div style={{ display:"flex", gap:"0.375rem",
                                    marginBottom:"0.75rem", flexWrap:"wrap" }}>
                                    {[
                                        { icon:"🏫", val:`${subj.classes.length} class${subj.classes.length !== 1 ? "es" : ""}`, color:"#8b5cf6" },
                                        { icon:"👨‍🎓", val:subj.totalStudents == null ? "Students: N/A" : `${subj.totalStudents} students`, color:subj.totalStudents == null ? "#6B7C78" : "#10b981" },
                                        { icon:"📝", val:subj.pendingMarks == null ? "Pending marks: N/A" : `${subj.pendingMarks} pending`, color:subj.pendingMarks == null ? "#6B7C78" : subj.pendingMarks > 0 ? "#f59e0b" : "#16a34a" },
                                    ].map(chip => (
                                        <span key={chip.val} style={{
                                            display:"flex", alignItems:"center", gap:"0.25rem",
                                            background:"#f8fafc", border:"1px solid #e2e8f0",
                                            padding:"0.25rem 0.625rem", borderRadius:"9999px",
                                            fontSize:"0.72rem", fontWeight:600, color: chip.color
                                        }}>
                                            {chip.icon} {chip.val}
                                        </span>
                                    ))}
                                </div>

                                {/* Class chips */}
                                <div style={{ marginBottom:"0.75rem" }}>
                                    <p style={{ fontSize:"0.68rem", fontWeight:600, color:"#6B7C78",
                                        margin:"0 0 0.375rem", textTransform:"uppercase" }}>
                                        Assigned Classes
                                    </p>
                                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                                        {subj.classes.map(cls => (
                                            <span key={cls.classId} style={{
                                                fontSize:"0.7rem", background:"#eff6ff",
                                                color:"#1e40af", border:"1px solid #bfdbfe",
                                                padding:"0.15rem 0.5rem", borderRadius:"9999px"
                                            }}>
                                                {cls.className} — {cls.section}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Attendance + result row */}
                                <div style={{ display:"flex", justifyContent:"space-between",
                                    alignItems:"center", fontSize:"0.78rem" }}>
                                    <div>
                                        <span style={{ color:"#6B7C78" }}>Avg Att: </span>
                                        <span style={{ fontWeight:700,
                                            color: subj.avgAttPct != null
                                                ? pctColor(subj.avgAttPct) : "#6B7C78" }}>
                                            {subj.avgAttPct != null ? `${subj.avgAttPct}%` : "N/A"}
                                        </span>
                                    </div>
                                    <ResultBadge status={subj.resultStatus} />
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div style={{ padding:"0.75rem 1.25rem", borderTop:"1px solid #e2e8f0",
                                display:"flex", gap:"0.375rem" }}>
                                <button className="btn btn-secondary"
                                    style={{ flex:1, fontSize:"0.7rem" }}
                                    onClick={() => navigate(`/teacher/students?subject=${subj._id}`)}>
                                    👨‍🎓
                                </button>
                                <button className="btn btn-secondary"
                                    style={{ flex:1, fontSize:"0.7rem" }}
                                    onClick={() => navigate(`/teacher/attendance?subject=${subj._id}`)}>
                                    📅
                                </button>
                                <button className="btn btn-secondary"
                                    style={{ flex:1, fontSize:"0.7rem" }}
                                    onClick={() => navigate(`/teacher/marks?subject=${subj._id}`)}>
                                    📝
                                </button>
                                <button className="btn btn-secondary"
                                    style={{ flex:1, fontSize:"0.7rem" }}
                                    onClick={() => navigate(`/teacher/results?subject=${subj._id}`)}>
                                    📄
                                </button>
                                <button className="btn btn-primary"
                                    style={{ flex:2, fontSize:"0.72rem" }}
                                    onClick={() => openDrawer(subj)}>
                                    Details →
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
            )}
            {/* ══════════════════════════════════════════════
                SUBJECT DETAIL DRAWER
            ══════════════════════════════════════════════ */}
            <Drawer
                isOpen={drawerOpen}
                title={selected ? `${selected.name} — ${selected.code}` : "Subject Detail"}
                onClose={() => setDrawerOpen(false)}
                width="560px"
                footer={
                    <button className="btn btn-danger" onClick={() => setDrawerOpen(false)}>
                        Close
                    </button>
                }
            >
                {selected && (
                    <>
                        <Tabs
                            tabs={[
                                { id:"info",     label:"Subject Info"    },
                                { id:"classes",  label:"Classes"         },
                                { id:"activity", label:"Recent Activity" },
                                { id:"actions",  label:"Quick Actions"   },
                            ]}
                            activeTab={drawerTab}
                            onChange={setDrawerTab}
                        />

                        {/* ── TAB: SUBJECT INFO ── */}
                        {drawerTab === "info" && (
                            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

                                <Panel title="Subject Information">
                                    <div className="detail-grid">
                                        {[
                                            ["Subject Name", selected.name],
                                            ["Subject Code", selected.code],
                                            ["Credit Hours", selected.creditHours],
                                            ["Department",   selected.department],
                                            ["Program",      selected.program],
                                        ].map(([label, val]) => (
                                            <div key={label} className="detail-row">
                                                <span className="detail-label">{label}</span>
                                                <span className="detail-value"
                                                    style={label === "Subject Code"
                                                        ? { fontFamily:"monospace" } : {}}>
                                                    {val ?? "—"}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="detail-row">
                                            <span className="detail-label">Status</span>
                                            <StatusBadge status={selected.subjectStatus} />
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Result</span>
                                            <ResultBadge status={selected.resultStatus} />
                                        </div>
                                    </div>
                                </Panel>

                                {/* Student summary stats */}
                                <Panel title="Student Summary">
                                    <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
                                        {[
                                            { icon:"👨‍🎓", label:"Total Students",
                                                val: selected.totalStudents ?? "N/A",
                                                color: selected.totalStudents != null ? "#10b981" : "#6B7C78" },
                                            { icon:"📅", label:"Avg Attendance",
                                                val: selected.avgAttPct != null
                                                    ? `${selected.avgAttPct}%` : "N/A",
                                                color: selected.avgAttPct != null
                                                    ? pctColor(selected.avgAttPct) : "#6B7C78" },
                                            { icon:"📝", label:"Records",
                                                val: selected.totalRecords,    color:"#8b5cf6" },
                                            { icon:"⏳", label:"Marks Pending",
                                                val: selected.pendingMarks ?? "N/A",
                                                color: selected.pendingMarks == null
                                                    ? "#6B7C78"
                                                    : selected.pendingMarks > 0 ? "#f59e0b" : "#16a34a" },
                                        ].map(item => (
                                            <div key={item.label} style={{
                                                flex:1, minWidth:"80px", textAlign:"center",
                                                padding:"0.75rem 0.5rem",
                                                background:"#f8fafc", borderRadius:"0.375rem"
                                            }}>
                                                <p style={{ fontSize:"1rem", margin:0 }}>{item.icon}</p>
                                                <p style={{ fontWeight:700, fontSize:"1.1rem",
                                                    color:item.color, margin:"0.25rem 0 0" }}>
                                                    {item.val}
                                                </p>
                                                <p style={{ fontSize:"0.65rem", color:"#6B7C78", margin:0 }}>
                                                    {item.label}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>

                                {/* Timetable note — no timetable model yet */}
                                <div style={{
                                    padding:"0.75rem 1rem",
                                    background:"#eff6ff", border:"1px solid #bfdbfe",
                                    borderRadius:"0.375rem", fontSize:"0.8rem", color:"#1e40af"
                                }}>
                                    ℹ️ Subject timetable is not yet configured in the system.
                                    Contact admin to set up class schedules.
                                </div>
                            </div>
                        )}

                        {/* ── TAB: CLASSES ── */}
                        {drawerTab === "classes" && (
                            <Panel title={`${selected.classes.length} Assigned Class${selected.classes.length !== 1 ? "es" : ""}`}>
                                {selected.classes.length === 0 ? (
                                    <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>
                                        No classes assigned to this subject.
                                    </p>
                                ) : (
                                    <div style={{ display:"flex", flexDirection:"column", gap:"0.625rem" }}>
                                        {selected.classes.map(cls => (
                                            <div key={cls.classId} style={{
                                                padding:"0.875rem 1rem",
                                                border:"1px solid #e2e8f0",
                                                borderRadius:"0.375rem",
                                                background:"#fafafa"
                                            }}>
                                                {/* Class header row */}
                                                <div style={{ display:"flex", justifyContent:"space-between",
                                                    alignItems:"flex-start", marginBottom:"0.625rem" }}>
                                                    <div>
                                                        <p style={{ fontWeight:700, fontSize:"0.95rem", margin:0 }}>
                                                            {cls.className} — {cls.section}
                                                        </p>
                                                        <p style={{ fontSize:"0.75rem", color:"#6B7C78",
                                                            margin:"0.125rem 0 0" }}>
                                                            {cls.program} · Semester {cls.semester}
                                                        </p>
                                                    </div>
                                                    <div style={{ textAlign:"right" }}>
                                                        <p style={{ fontWeight:700, fontSize:"1rem",
                                                            color:"#3b82f6", margin:0 }}>
                                                            {cls.studentCount ?? "N/A"}
                                                        </p>
                                                        <p style={{ fontSize:"0.68rem", color:"#6B7C78", margin:0 }}>
                                                            students
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Per-class action buttons */}
                                                <div style={{ display:"flex", gap:"0.375rem" }}>
                                                    <button className="btn btn-secondary"
                                                        style={{ flex:1, fontSize:"0.72rem" }}
                                                        onClick={() => navigate(
                                                            `/teacher/students?class=${cls.classId}&subject=${selected._id}`
                                                        )}>
                                                        👨‍🎓 Students
                                                    </button>
                                                    <button className="btn btn-secondary"
                                                        style={{ flex:1, fontSize:"0.72rem" }}
                                                        onClick={() => navigate(
                                                            `/teacher/attendance?class=${cls.classId}&subject=${selected._id}`
                                                        )}>
                                                        📅 Attendance
                                                    </button>
                                                    <button className="btn btn-secondary"
                                                        style={{ flex:1, fontSize:"0.72rem" }}
                                                        onClick={() => navigate(
                                                            `/teacher/marks?class=${cls.classId}&subject=${selected._id}`
                                                        )}>
                                                        📝 Marks
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        )}

                        {/* ── TAB: RECENT ACTIVITY ── */}
                        {drawerTab === "activity" && (
                            <Panel title="Recent Subject Activity">
                                {selected.recentActivity.length === 0 ? (
                                    <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                                        <p style={{ fontSize:"1.5rem" }}>📋</p>
                                        <p style={{ fontSize:"0.875rem" }}>
                                            No recent activity for this subject.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                                        {selected.recentActivity.map((item, i) => (
                                            <div key={i} style={{
                                                display:"flex", gap:"0.625rem",
                                                padding:"0.75rem 0",
                                                borderBottom: i < selected.recentActivity.length - 1
                                                    ? "1px solid #f1f5f9" : "none"
                                            }}>
                                                {/* Timeline icon + line */}
                                                <div style={{ display:"flex", flexDirection:"column",
                                                    alignItems:"center" }}>
                                                    <span style={{ fontSize:"1rem", lineHeight:1 }}>
                                                        {item.icon}
                                                    </span>
                                                    {i < selected.recentActivity.length - 1 && (
                                                        <div style={{ width:"1px", flex:1,
                                                            background:"#e2e8f0", marginTop:"0.25rem" }} />
                                                    )}
                                                </div>

                                                {/* Activity content */}
                                                <div style={{ flex:1 }}>
                                                    <p style={{ fontSize:"0.8rem", fontWeight:500,
                                                        color:"#1F2D2C", margin:0 }}>
                                                        {item.message}
                                                    </p>
                                                    {item.meta && (
                                                        <p style={{ fontSize:"0.72rem", color:"#6B7C78",
                                                            margin:"0.125rem 0 0" }}>
                                                            {item.meta}
                                                        </p>
                                                    )}
                                                    <p style={{ fontSize:"0.7rem", color:"#9ca3af",
                                                        margin:"0.125rem 0 0" }}>
                                                        {timeAgo(item.time)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        )}

                        {/* ── TAB: QUICK ACTIONS ── */}
                        {drawerTab === "actions" && (
                            <Panel title="Quick Actions">
                                <div style={{ display:"flex", flexDirection:"column", gap:"0.625rem" }}>
                                    {[
                                        {
                                            icon:"👨‍🎓",
                                            label:"View Students",
                                            sub: selected.totalStudents == null
                                                ? "Student count unavailable"
                                                : `${selected.totalStudents} record-linked students`,
                                            path:`/teacher/students?subject=${selected._id}`,
                                            color:"#3b82f6"
                                        },
                                        {
                                            icon:"📅",
                                            label:"Attendance",
                                            sub: selected.attendancePendingClasses > 0
                                                ? `${selected.attendancePendingClasses} class(es) pending today`
                                                : "All attendance submitted today",
                                            path:`/teacher/attendance?subject=${selected._id}`,
                                            color:"#10b981"
                                        },
                                        {
                                            icon:"📝",
                                            label:"Enter Marks",
                                            sub: selected.pendingMarks == null
                                                ? "Pending marks unavailable"
                                                : selected.pendingMarks > 0
                                                    ? `${selected.pendingMarks} student(s) need marks`
                                                    : "All marks submitted",
                                            path:`/teacher/marks?subject=${selected._id}`,
                                            color:"#8b5cf6"
                                        },
                                        {
                                            icon:"📊",
                                            label:"Academic Records",
                                            sub:`${selected.totalRecords} record(s) submitted`,
                                            path:`/teacher/records?subject=${selected._id}`,
                                            color:"#f59e0b"
                                        },
                                        {
                                            icon:"📄",
                                            label:"View Results",
                                            sub: selected.resultStatus == null
                                                ? "Result status: N/A"
                                                : `Result status: ${selected.resultStatus}`,
                                            path:`/teacher/results?subject=${selected._id}`,
                                            color:"#ef4444"
                                        },
                                    ].map(action => (
                                        <button
                                            key={action.label}
                                            onClick={() => navigate(action.path)}
                                            style={{
                                                display:"flex", alignItems:"center", gap:"1rem",
                                                padding:"0.875rem 1rem",
                                                background:`${action.color}08`,
                                                border:`1px solid ${action.color}20`,
                                                borderRadius:"0.5rem",
                                                cursor:"pointer", textAlign:"left",
                                                width:"100%"
                                            }}
                                            onMouseEnter={e =>
                                                e.currentTarget.style.background = `${action.color}15`}
                                            onMouseLeave={e =>
                                                e.currentTarget.style.background = `${action.color}08`}
                                        >
                                            <span style={{ fontSize:"1.5rem", flexShrink:0 }}>
                                                {action.icon}
                                            </span>
                                            <div style={{ flex:1 }}>
                                                <p style={{ fontWeight:600, fontSize:"0.875rem",
                                                    color:"#1F2D2C", margin:0 }}>
                                                    {action.label}
                                                </p>
                                                <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>
                                                    {action.sub}
                                                </p>
                                            </div>
                                            <span style={{ color:"#6B7C78", flexShrink:0 }}>→</span>
                                        </button>
                                    ))}
                                </div>
                            </Panel>
                        )}

                    </>
                )}
            </Drawer>

        </div>
    )
}