import { useState, useEffect } from "react"
import { useNavigate }         from "react-router-dom"
import { Drawer } from "../../../components/ui/Drawer.jsx"
import { Tabs }   from "../../../components/ui/Tabs.jsx"
import { Panel }  from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx"
import { getTeacherClasses } from "../../../services/teacherClassesService.js"

// ── helpers ────────────────────────────────────────────────────────────────────

const CLASS_STATUS_CLASS = {
    "Active": "status-active",
    "Completed Today": "status-info",
    "Marks Pending": "status-pending",
    "Attendance Pending": "status-error",
}

const RESULT_STATUS_CLASS = {
    Published: "status-success",
    Pending: "status-pending",
    "Not Published": "status-neutral",
}

const NOTICE_STYLE = {
    warning: { bg:"#fffbeb", border:"#fde68a", color:"#92400e" },
    info:    { bg:"#eff6ff", border:"#bfdbfe", color:"#1e40af" },
    danger:  { bg:"#fef2f2", border:"#fecaca", color:"#991b1b" },
}

// ── sub-components ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, urgent }) => (
    <SharedSummaryCard
        title={label}
        value={value ?? "N/A"}
        supporting={sub}
        variant={urgent ? "warning" : "default"}
    />
)

const ClassStatusBadge = ({ status }) => {
    return <span className={`status ${CLASS_STATUS_CLASS[status] || "status-active"}`}>{status}</span>
}

const ResultBadge = ({ status }) => {
    const label = status ?? "N/A"
    const className = RESULT_STATUS_CLASS[status] || "status-neutral"
    return <span className={`status ${className}`}>{label}</span>
}

// ── component ──────────────────────────────────────────────────────────────────

export default function TeacherClasses() {
    const navigate = useNavigate()

    const [data,           setData]           = useState(null)
    const [loading,        setLoading]        = useState(true)
    const [error,          setError]          = useState(null)

    // ── search ─────────────────────────────────────────────────────────────────
    const [search,         setSearch]         = useState("")
    const [viewMode,       setViewMode]       = useState("cards")  // "cards" | "table"

    // ── drawer ─────────────────────────────────────────────────────────────────
    const [drawerOpen,     setDrawerOpen]     = useState(false)
    const [selectedClass,  setSelectedClass]  = useState(null)
    const [drawerTab,      setDrawerTab]      = useState("overview")

    useEffect(() => {
        getTeacherClasses()
            .then(r => setData(r.data))
            .catch(e => { setError("Failed to load classes."); console.error(e) })
            .finally(() => setLoading(false))
    }, [])

    const refresh = () => {
        setLoading(true)
        getTeacherClasses()
            .then(r => setData(r.data))
            .catch(() => setError("Failed to refresh."))
            .finally(() => setLoading(false))
    }

    if (loading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p><p>Loading your classes...</p>
        </div>
    )
    if (error) return <div style={{ padding:"2rem", color:"#ef4444" }}>{error}</div>

    const stats = data?.stats || {}
    const classCards = Array.isArray(data?.classCards) ? data.classCards : []
    const reminders = Array.isArray(data?.reminders) ? data.reminders : []

    // ── filtered classes ───────────────────────────────────────────────────────
    const filtered = classCards.filter(c => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            c.name?.toLowerCase().includes(q) ||
            c.section?.toLowerCase().includes(q) ||
            c.program?.toLowerCase().includes(q) ||
            (Array.isArray(c.subjects) ? c.subjects : []).some(s => s.name?.toLowerCase().includes(q))
        )
    })

    const openDrawer = (cls) => {
        setSelectedClass(cls)
        setDrawerTab("overview")
        setDrawerOpen(true)
    }

    return (
        <div className="dashboard-page admin-page teacher-page">

            {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
            <PageHeader
                title="My Classes"
                description="Manage your assigned classes and daily teaching activities."
                action={
                    <>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "cards" ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setViewMode("cards")}
                        >
                            Cards
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setViewMode("table")}
                        >
                            Table
                        </button>
                        <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
                    </>
                }
            />

            {/* ══════════════════════════════════════════════
                REMINDERS (top, urgent)
            ══════════════════════════════════════════════ */}
            {reminders.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"0.375rem" }}>
                    {reminders.slice(0, 4).map((r, i) => {
                        const s = NOTICE_STYLE[r.level] || NOTICE_STYLE.info
                        return (
                            <div key={i} style={{
                                display:"flex", alignItems:"center", gap:"0.625rem",
                                padding:"0.6rem 0.875rem", borderRadius:"0.375rem",
                                fontSize:"0.8rem", fontWeight:500,
                                background:s.bg, border:`1px solid ${s.border}`, color:s.color
                            }}>
                                <span>{r.icon}</span>
                                <span style={{ flex:1 }}>{r.message}</span>
                                {r.classId && (
                                    <button
                                        onClick={() => {
                                            const cls = classCards.find(c => c._id === r.classId)
                                            if (cls) openDrawer(cls)
                                        }}
                                        style={{ fontSize:"0.72rem", background:"transparent", border:`1px solid ${s.color}`, borderRadius:"0.25rem", padding:"0.15rem 0.5rem", color:s.color, cursor:"pointer", fontWeight:600 }}
                                    >
                                        Open →
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ══════════════════════════════════════════════
                SUMMARY CARDS
            ══════════════════════════════════════════════ */}
            <div className="summary-card-grid">
                <SummaryCard icon="🏫" label="Classes"           value={stats.totalClasses}      sub="Assigned to you"       valueColor={stats.totalClasses == null ? "#6B7C78" : "#3b82f6"} />
                <SummaryCard icon="👨‍🎓" label="Students"        value={stats.totalStudents}     sub="Across all classes"    valueColor={stats.totalStudents == null ? "#6B7C78" : "#10b981"} />
                <SummaryCard icon="📚" label="Subjects"          value={stats.totalSubjects}     sub="Unique subjects"        valueColor={stats.totalSubjects == null ? "#6B7C78" : "#8b5cf6"} />
                <SummaryCard icon="⏳" label="Attendance Pending" value={stats.pendingAttendance} sub="Classes needing today's entry"
                    valueColor={stats.pendingAttendance == null ? "#6B7C78" : stats.pendingAttendance > 0 ? "#ef4444" : "#16a34a"}
                    urgent={stats.pendingAttendance != null && stats.pendingAttendance > 0}
                />
                <SummaryCard icon="📝" label="Marks Pending"    value={stats.totalPendingMarks} sub="Students without marks"
                    valueColor={stats.totalPendingMarks == null ? "#6B7C78" : stats.totalPendingMarks > 0 ? "#f59e0b" : "#16a34a"}
                />
            </div>

            {/* ══════════════════════════════════════════════
                SEARCH + VIEW TOGGLE
            ══════════════════════════════════════════════ */}
            <SearchFilters
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search classes, sections, programs, or subjects..."
                onReset={search ? () => setSearch("") : undefined}
            />

            {/* ══════════════════════════════════════════════
                NO CLASSES STATE
            ══════════════════════════════════════════════ */}
            {classCards.length === 0 ? (
                <div className="card" style={{ padding:"3rem", textAlign:"center", color:"#6B7C78" }}>
                    <p style={{ fontSize:"2.5rem" }}>🏫</p>
                    <p style={{ fontWeight:600, marginTop:"0.5rem" }}>No Classes Assigned Yet</p>
                    <p style={{ fontSize:"0.875rem" }}>Contact the admin to assign classes to your profile.</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                    <p style={{ fontSize:"1.5rem" }}>🔍</p>
                    <p style={{ fontSize:"0.875rem" }}>No classes match your search.</p>
                </div>
            ) : viewMode === "cards" ? (

                /* ══════════════════════════════════════════════
                    CARD VIEW
                ══════════════════════════════════════════════ */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(cls => (
                        <div key={cls._id} className="card" style={{ padding:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                            {/* Card header */}
                            <div style={{
                                padding:"var(--space-3) var(--space-4)",
                                background:"var(--color-surface-subtle)",
                                display:"flex", justifyContent:"space-between", alignItems:"flex-start"
                            }}>
                                <div>
                                    <h3 style={{ color:"var(--color-text-primary)", fontWeight:700, fontSize:"1rem", margin:0 }}>
                                        {cls.name} — {cls.section}
                                    </h3>
                                    <p style={{ color:"var(--color-text-secondary)", fontSize:"var(--font-size-xs)", margin:"0.25rem 0 0" }}>
                                        {cls.program} · Semester {cls.semester}
                                    </p>
                                </div>
                                <ClassStatusBadge status={cls.classStatus} />
                            </div>

                            {/* Card body */}
                            <div style={{ padding:"1rem 1.25rem", flex:1 }}>

                                {/* Stats row */}
                                <div style={{ display:"flex", gap:"1rem", marginBottom:"0.875rem" }}>
                                    <div style={{ textAlign:"center" }}>
                                        <p style={{ fontWeight:700, fontSize:"1.25rem", color:cls.studentCount == null ? "#6B7C78" : "#3b82f6", margin:0 }}>{cls.studentCount ?? "N/A"}</p>
                                        <p style={{ fontSize:"0.68rem", color:"#6B7C78", margin:0 }}>Students</p>
                                    </div>
                                    <div style={{ textAlign:"center" }}>
                                        <p style={{ fontWeight:700, fontSize:"1.25rem", color: cls.classAttPct == null ? "#6B7C78" : cls.classAttPct < 75 ? "#ef4444" : "#16a34a", margin:0 }}>
                                            {cls.classAttPct != null ? `${cls.classAttPct}%` : "N/A"}
                                        </p>
                                        <p style={{ fontSize:"0.68rem", color:"#6B7C78", margin:0 }}>Attendance</p>
                                    </div>
                                    <div style={{ textAlign:"center" }}>
                                        <p style={{ fontWeight:700, fontSize:"1.25rem", color: cls.pendingMarksCount == null ? "#6B7C78" : cls.pendingMarksCount > 0 ? "#f59e0b" : "#16a34a", margin:0 }}>{cls.pendingMarksCount ?? "N/A"}</p>
                                        <p style={{ fontSize:"0.68rem", color:"#6B7C78", margin:0 }}>Marks Pending</p>
                                    </div>
                                    <div style={{ textAlign:"center" }}>
                                        <ResultBadge status={cls.resultStatus} />
                                        <p style={{ fontSize:"0.68rem", color:"#6B7C78", margin:"0.25rem 0 0" }}>Result</p>
                                    </div>
                                </div>

                                {/* Subjects */}
                                {Array.isArray(cls.subjects) && cls.subjects.length > 0 && (
                                    <div style={{ marginBottom:"0.875rem" }}>
                                        <p style={{ fontSize:"0.68rem", fontWeight:600, color:"#6B7C78", margin:"0 0 0.375rem", textTransform:"uppercase" }}>Subjects</p>
                                        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                                            {cls.subjects.map(s => (
                                                <span key={s._id} style={{
                                                    fontSize:"0.7rem", background:"#eff6ff", color:"#1e40af",
                                                    border:"1px solid #bfdbfe", padding:"0.15rem 0.5rem", borderRadius:"9999px"
                                                }}>
                                                    {s.code}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Today attendance status */}
                                <div style={{
                                    padding:"0.5rem 0.75rem", borderRadius:"0.375rem", marginBottom:"0.875rem",
                                    background: cls.attendanceTodayDone == null ? "#f8fafc" : cls.attendanceTodayDone ? "#f0fdf4" : "#fef2f2",
                                    border:`1px solid ${cls.attendanceTodayDone == null ? "#e2e8f0" : cls.attendanceTodayDone ? "#bbf7d0" : "#fecaca"}`,
                                    fontSize:"0.78rem", fontWeight:600,
                                    color: cls.attendanceTodayDone == null ? "#6B7C78" : cls.attendanceTodayDone ? "#166534" : "#991b1b"
                                }}>
                                    {cls.attendanceTodayDone == null
                                        ? "N/A"
                                        : cls.attendanceTodayDone ? "✅ Today's attendance submitted" : "⚠️ Today's attendance pending"}
                                </div>

                            </div>

                            {/* Action buttons */}
                            <div style={{ padding:"0.75rem 1.25rem", borderTop:"1px solid #e2e8f0", display:"flex", gap:"0.375rem", flexWrap:"wrap" }}>
                                <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem", minWidth:"60px" }}
                                    onClick={() => navigate(`/teacher/students?class=${cls._id}`)}>
                                    👨‍🎓
                                </button>
                                <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem", minWidth:"60px" }}
                                    onClick={() => navigate(`/teacher/attendance?class=${cls._id}`)}>
                                    📅
                                </button>
                                <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem", minWidth:"60px" }}
                                    onClick={() => navigate(`/teacher/dashboard/teacher-records?class=${cls._id}`)}>
                                    📝
                                </button>
                                <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem", minWidth:"60px" }}
                                    onClick={() => navigate(`/teacher/results?class=${cls._id}`)}>
                                    📄
                                </button>
                                <button className="btn btn-primary" style={{ flex:2, fontSize:"0.72rem" }}
                                    onClick={() => openDrawer(cls)}>
                                    Details →
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

            ) : (

                /* ══════════════════════════════════════════════
                    TABLE VIEW
                ══════════════════════════════════════════════ */
                <Panel title="All Classes">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Program</th>
                                    <th style={{ textAlign:"center" }}>Semester</th>
                                    <th style={{ textAlign:"center" }}>Students</th>
                                    <th style={{ textAlign:"center" }}>Attendance</th>
                                    <th style={{ textAlign:"center" }}>Marks Pending</th>
                                    <th>Result</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(cls => (
                                    <tr key={cls._id}>
                                        <td>
                                            <p style={{ fontWeight:600, margin:0 }}>{cls.name} — {cls.section}</p>
                                            <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>{cls.department}</p>
                                        </td>
                                        <td style={{ fontSize:"0.85rem" }}>{cls.program}</td>
                                        <td style={{ textAlign:"center" }}>{cls.semester}</td>
                                        <td style={{ textAlign:"center", fontWeight:600, color:cls.studentCount == null ? "#6B7C78" : "#3b82f6" }}>{cls.studentCount ?? "N/A"}</td>
                                        <td style={{ textAlign:"center" }}>
                                            {cls.classAttPct != null ? (
                                                <span style={{ fontWeight:700, color: cls.classAttPct < 75 ? "#ef4444" : "#16a34a" }}>
                                                    {cls.classAttPct}%
                                                </span>
                                            ) : <span style={{ color:"#6B7C78" }}>N/A</span>}
                                        </td>
                                        <td style={{ textAlign:"center" }}>
                                            <span style={{ fontWeight:600, color: cls.pendingMarksCount == null ? "#6B7C78" : cls.pendingMarksCount > 0 ? "#f59e0b" : "#16a34a" }}>
                                                {cls.pendingMarksCount ?? "N/A"}
                                            </span>
                                        </td>
                                        <td><ResultBadge status={cls.resultStatus} /></td>
                                        <td><ClassStatusBadge status={cls.classStatus} /></td>
                                        <td>
                                            <div style={{ display:"flex", gap:"0.25rem" }}>
                                                <button className="btn btn-secondary" style={{ fontSize:"0.7rem" }} onClick={() => openDrawer(cls)}>View</button>
                                                <button className="btn btn-secondary" style={{ fontSize:"0.7rem" }} onClick={() => navigate(`/teacher/attendance?class=${cls._id}`)}>📅</button>
                                                <button className="btn btn-secondary" style={{ fontSize:"0.7rem" }} onClick={() => navigate(`/teacher/dashboard/teacher-records?class=${cls._id}`)}>📝</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            {/* ══════════════════════════════════════════════
                CLASS DETAIL DRAWER
            ══════════════════════════════════════════════ */}
            <Drawer
                isOpen={drawerOpen}
                title={selectedClass ? `${selectedClass.name} — ${selectedClass.section}` : "Class Detail"}
                onClose={() => setDrawerOpen(false)}
                width="540px"
                footer={<button className="btn btn-danger" onClick={() => setDrawerOpen(false)}>Close</button>}
            >
                {selectedClass && (
                    <>
                        <Tabs
                            tabs={[
                                { id:"overview",  label:"Overview"      },
                                { id:"subjects",  label:"Subjects"      },
                                { id:"actions",   label:"Quick Actions" },
                            ]}
                            activeTab={drawerTab}
                            onChange={setDrawerTab}
                        />

                        {/* ── OVERVIEW TAB ── */}
                        {drawerTab === "overview" && (
                            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

                                {/* Class info */}
                                <Panel title="Class Information">
                                    <div className="detail-grid">
                                        {[
                                            ["Class Name",  selectedClass.name],
                                            ["Section",     selectedClass.section],
                                            ["Semester",    selectedClass.semester],
                                            ["Program",     selectedClass.program],
                                            ["Department",  selectedClass.department],
                                            ["Dept. Code",  selectedClass.departmentCode],
                                        ].map(([label, val]) => (
                                            <div key={label} className="detail-row">
                                                <span className="detail-label">{label}</span>
                                                <span className="detail-value">{val ?? "—"}</span>
                                            </div>
                                        ))}
                                        <div className="detail-row">
                                            <span className="detail-label">Status</span>
                                            <ClassStatusBadge status={selectedClass.classStatus} />
                                        </div>
                                    </div>
                                </Panel>

                                {/* Stats */}
                                <Panel title="Class Overview">
                                    <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
                                        {[
                                            { icon:"👨‍🎓", label:"Students",       val: selectedClass.studentCount ?? "N/A",    color:selectedClass.studentCount == null ? "#6B7C78" : "#3b82f6" },
                                            { icon:"📅", label:"Attendance",      val: selectedClass.classAttPct != null ? `${selectedClass.classAttPct}%` : "N/A",
                                                color: selectedClass.classAttPct == null ? "#6B7C78" : selectedClass.classAttPct < 75 ? "#ef4444" : "#16a34a" },
                                            { icon:"📝", label:"Marks Pending",  val: selectedClass.pendingMarksCount ?? "N/A", color: selectedClass.pendingMarksCount == null ? "#6B7C78" : selectedClass.pendingMarksCount > 0 ? "#f59e0b" : "#16a34a" },
                                            { icon:"📊", label:"Records",         val: selectedClass.totalRecords ?? "N/A", color:selectedClass.totalRecords == null ? "#6B7C78" : "#8b5cf6" },
                                        ].map(item => (
                                            <div key={item.label} style={{ flex:1, minWidth:"80px", textAlign:"center", padding:"0.75rem 0.5rem", background:"#f8fafc", borderRadius:"0.375rem" }}>
                                                <p style={{ fontSize:"1.1rem", margin:0 }}>{item.icon}</p>
                                                <p style={{ fontWeight:700, fontSize:"1.1rem", color:item.color, margin:"0.25rem 0 0" }}>{item.val}</p>
                                                <p style={{ fontSize:"0.65rem", color:"#6B7C78", margin:0 }}>{item.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginTop:"0.875rem" }}>
                                        <div className="detail-row">
                                            <span className="detail-label">Result Status</span>
                                            <ResultBadge status={selectedClass.resultStatus} />
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Today's Attendance</span>
                                            {selectedClass.attendanceTodayDone == null
                                                ? <span style={{ color:"#6B7C78" }}>N/A</span>
                                                : <span className={selectedClass.attendanceTodayDone ? "status-active" : "status-suspended"}>
                                                    {selectedClass.attendanceTodayDone ? "✅ Submitted" : "⚠️ Pending"}
                                                </span>}
                                        </div>
                                    </div>
                                </Panel>

                                {/* Timetable note */}
                                <div style={{ padding:"0.75rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"0.375rem", fontSize:"0.8rem", color:"#1e40af" }}>
                                    ℹ️ Class timetable is not yet configured in the system. Contact admin to set up schedules.
                                </div>
                            </div>
                        )}

                        {/* ── SUBJECTS TAB ── */}
                        {drawerTab === "subjects" && (
                            <Panel title="Assigned Subjects">
                                {selectedClass.subjects?.length === 0 ? (
                                    <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>No subjects assigned to this class.</p>
                                ) : (
                                    <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                                        {(Array.isArray(selectedClass.subjects) ? selectedClass.subjects : []).map(s => (
                                            <div key={s._id} style={{
                                                padding:"0.875rem 1rem",
                                                border:"1px solid #e2e8f0", borderRadius:"0.375rem",
                                                display:"flex", justifyContent:"space-between", alignItems:"center"
                                            }}>
                                                <div>
                                                    <p style={{ fontWeight:600, fontSize:"0.875rem", margin:0 }}>{s.name}</p>
                                                    <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:"0.125rem 0 0" }}>
                                                        {s.code} · {s.creditHours} credit hr{s.creditHours !== 1 ? "s" : ""}
                                                    </p>
                                                </div>
                                                <div style={{ display:"flex", gap:"0.375rem" }}>
                                                    <button className="btn btn-secondary" style={{ fontSize:"0.72rem" }}
                                                        onClick={() => navigate(`/teacher/dashboard/teacher-records?class=${selectedClass._id}&subject=${s._id}`)}>
                                                        📝 Marks
                                                    </button>
                                                    <button className="btn btn-secondary" style={{ fontSize:"0.72rem" }}
                                                        onClick={() => navigate(`/teacher/attendance?class=${selectedClass._id}&subject=${s._id}`)}>
                                                        📅 Attend.
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Panel>
                        )}

                        {/* ── QUICK ACTIONS TAB ── */}
                        {drawerTab === "actions" && (
                            <Panel title="Quick Actions">
                                <div style={{ display:"flex", flexDirection:"column", gap:"0.625rem" }}>
                                    {[
                                        { icon:"👨‍🎓", label:"View Students",      sub:"See all enrolled students",            path:`/teacher/students?class=${selectedClass._id}`,   color:"#3b82f6" },
                                        { icon:"📅", label:"Mark Attendance",     sub:"Submit today's attendance",             path:`/teacher/attendance?class=${selectedClass._id}`,  color:"#10b981" },
                                        { icon:"📝", label:"Enter Marks",         sub:"Add quiz, midterm, or final marks",     path:`/teacher/dashboard/teacher-records?class=${selectedClass._id}`,       color:"#8b5cf6" },
                                        { icon:"📊", label:"View Academic Records",sub:"See submitted marks and records",      path:`/teacher/records?class=${selectedClass._id}`,     color:"#f59e0b" },
                                        { icon:"📄", label:"View Results",        sub:"Check published semester results",      path:`/teacher/results?class=${selectedClass._id}`,     color:"#ef4444" },
                                    ].map(action => (
                                        <button
                                            key={action.label}
                                            onClick={() => navigate(action.path)}
                                            style={{
                                                display:"flex", alignItems:"center", gap:"1rem",
                                                padding:"0.875rem 1rem",
                                                background:`${action.color}08`,
                                                border:`1px solid ${action.color}20`,
                                                borderRadius:"0.5rem", cursor:"pointer", textAlign:"left"
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background=`${action.color}15`}
                                            onMouseLeave={e => e.currentTarget.style.background=`${action.color}08`}
                                        >
                                            <span style={{ fontSize:"1.5rem", flexShrink:0 }}>{action.icon}</span>
                                            <div>
                                                <p style={{ fontWeight:600, fontSize:"0.875rem", color:"#1F2D2C", margin:0 }}>{action.label}</p>
                                                <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>{action.sub}</p>
                                            </div>
                                            <span style={{ marginLeft:"auto", color:"#6B7C78", fontSize:"1rem" }}>→</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Class reminders */}
                                {(reminders.filter(r => r.classId?.toString() === selectedClass._id?.toString())).length > 0 && (
                                    <div style={{ marginTop:"1rem" }}>
                                        <p style={{ fontSize:"0.7rem", fontWeight:600, color:"#6B7C78", textTransform:"uppercase", marginBottom:"0.5rem" }}>Class Reminders</p>
                                        <div style={{ display:"flex", flexDirection:"column", gap:"0.375rem" }}>
                                            {reminders
                                                .filter(r => r.classId?.toString() === selectedClass._id?.toString())
                                                .map((r, i) => {
                                                    const s = NOTICE_STYLE[r.level] || NOTICE_STYLE.info
                                                    return (
                                                        <div key={i} style={{ display:"flex", gap:"0.5rem", padding:"0.5rem 0.75rem", background:s.bg, border:`1px solid ${s.border}`, borderRadius:"0.375rem", fontSize:"0.8rem", color:s.color }}>
                                                            <span>{r.icon}</span><span>{r.message}</span>
                                                        </div>
                                                    )
                                                })
                                            }
                                        </div>
                                    </div>
                                )}
                            </Panel>
                        )}
                    </>
                )}
            </Drawer>

        </div>
    )
}
