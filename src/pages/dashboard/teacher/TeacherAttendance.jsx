import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Panel } from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx"
import {
    getAttendancePageData,
    loadStudentsForAttendance,
    submitAttendance,
    updateAttendance,
    getAttendanceHistory,
    getSessionDetail,
} from "../../../services/teacherAttendanceService.js"

// ── helpers ────────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split("T")[0]

const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", {
        day:"2-digit", month:"short", year:"numeric"
    }) : "—"

const pctColor = (p) =>
    p >= 80 ? "#16a34a" : p >= 60 ? "#f59e0b" : "#ef4444"

const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)
    if (diff < 60)    return `${diff}s ago`
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

// ── style maps ─────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
    present: { color:"#166534", bg:"#f0fdf4", border:"#bbf7d0", icon:"✅", label:"Present" },
    absent:  { color:"#991b1b", bg:"#fef2f2", border:"#fecaca", icon:"❌", label:"Absent"  },
    late:    { color:"#92400e", bg:"#fffbeb", border:"#fde68a", icon:"🕐", label:"Late"    },
}

// ── sub-components ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, urgent }) => (
    <SharedSummaryCard
        title={label}
        value={value ?? "—"}
        supporting={sub}
        variant={urgent ? "warning" : "default"}
    />
)

const StatusToggle = ({ status, onChange, disabled }) => (
    <div style={{ display:"flex", gap:"0.25rem" }}>
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
            <button
                key={key}
                disabled={disabled}
                onClick={() => onChange(key)}
                style={{
                    padding:"0.25rem 0.625rem",
                    borderRadius:"9999px", fontSize:"0.72rem",
                    fontWeight:600, cursor: disabled ? "not-allowed" : "pointer",
                    border:`1px solid ${status === key ? s.border : "#e2e8f0"}`,
                    background: status === key ? s.bg : "#fff",
                    color:      status === key ? s.color : "#6B7C78",
                    opacity:    disabled ? 0.6 : 1,
                    transition:"all 0.12s",
                }}
            >
                {s.icon} {s.label}
            </button>
        ))}
    </div>
)

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function TeacherAttendance() {
    const [searchParams] = useSearchParams()

    // ── page bootstrap ─────────────────────────────────────────────────────────
    const [pageData,      setPageData]      = useState(null)
    const [pageLoading,   setPageLoading]   = useState(true)
    const [pageError,     setPageError]     = useState(null)

    // ── controls ───────────────────────────────────────────────────────────────
    const [selClassId,   setSelClassId]     = useState(searchParams.get("class")   || "")
    const [selSubjectId, setSelSubjectId]   = useState(searchParams.get("subject") || "")
    const [selDate,      setSelDate]        = useState(todayStr())
    const [selSession,   setSelSession]     = useState(searchParams.get("session") || "")

    // ── student list ───────────────────────────────────────────────────────────
    const [students,        setStudents]        = useState([])
    const [studentsLoading, setStudentsLoading] = useState(false)
    const [studentsError,   setStudentsError]   = useState(null)
    const [loadedSelectionKey, setLoadedSelectionKey] = useState(null)
    const studentLoadRequestRef = useRef(0)
    const [alreadySubmitted,setAlreadySubmitted]= useState(false)
    const [submittedSession,setSubmittedSession]= useState(null)
    const [isEditMode,      setIsEditMode]      = useState(false)
    const [hasUnsaved,      setHasUnsaved]      = useState(false)

    // ── submit ─────────────────────────────────────────────────────────────────
    const [submitting,   setSubmitting]   = useState(false)
    const [submitError,  setSubmitError]  = useState(null)
    const [submitSuccess,setSubmitSuccess]= useState(null)

    // ── history ────────────────────────────────────────────────────────────────
    const [history,     setHistory]     = useState([])
    const [histPage,    setHistPage]    = useState(1)
    const [histPagination,setHistPagination] = useState(null)
    const [histLoading, setHistLoading] = useState(false)
    const [histError, setHistError] = useState(null)
    const [histClassId, setHistClassId] = useState("All")
    const [histSubjectId,setHistSubjectId] = useState("All")

    // ── session detail drawer ──────────────────────────────────────────────────
    const [detailOpen,    setDetailOpen]    = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailData,    setDetailData]    = useState(null)
    const [detailSession, setDetailSession] = useState(null)

    // ── unsaved warning ────────────────────────────────────────────────────────
    const hasUnsavedRef = useRef(false)
    useEffect(() => { hasUnsavedRef.current = hasUnsaved }, [hasUnsaved])
    useEffect(() => {
        const handler = (e) => {
            if (hasUnsavedRef.current) {
                e.preventDefault()
                e.returnValue = ""
            }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [])

    // ── fetch page bootstrap ───────────────────────────────────────────────────

    const fetchPageData = useCallback(() => {
        setPageLoading(true); setPageError(null)
        getAttendancePageData()
            .then(r  => {
                setPageData(r.data)
                // pre-select first class/subject from URL params or first available
                if (!selClassId && r.data.classes?.length > 0) {
                    setSelClassId(r.data.classes[0]._id)
                }
            })
            .catch(() => setPageError("Failed to load page data."))
            .finally(() => setPageLoading(false))
    }, [])

    useEffect(() => { fetchPageData() }, [fetchPageData])

    // ── auto-load available subjects when class changes ────────────────────────
    const availableSubjects = pageData?.classes?.find(
        c => c._id.toString() === selClassId
    )?.subjects || []
    const availableSessions = [...new Set(
        (pageData?.assignments || [])
            .filter(assignment =>
                String(assignment.classId) === selClassId &&
                String(assignment.subjectId) === selSubjectId
            )
            .map(assignment => assignment.session)
    )]
    const selectedSession = availableSessions.includes(selSession)
        ? selSession
        : availableSessions[0] || ""
    const selectionKey = JSON.stringify([selClassId, selSubjectId, selectedSession, selDate])
    const selectionKeyRef = useRef(selectionKey)
    selectionKeyRef.current = selectionKey
    const rosterMatchesSelection = loadedSelectionKey === selectionKey

    const invalidateStudentRoster = () => {
        studentLoadRequestRef.current += 1
        setStudents([])
        setLoadedSelectionKey(null)
        setStudentsLoading(false)
        setStudentsError(null)
        setAlreadySubmitted(false)
        setSubmittedSession(null)
        setIsEditMode(false)
        setHasUnsaved(false)
    }

    useEffect(() => {
        // reset subject selection when class changes
        if (selClassId && availableSubjects.length > 0 && !selSubjectId) {
            setSelSubjectId(availableSubjects[0]._id)
        }
    }, [selClassId, availableSubjects])

    // ── fetch history ──────────────────────────────────────────────────────────

    const fetchHistory = useCallback(() => {
        setHistLoading(true)
        setHistError(null)
        const params = { page: histPage, limit: 10 }
        if (histClassId   !== "All") params.classId   = histClassId
        if (histSubjectId !== "All") params.subjectId = histSubjectId

        getAttendanceHistory(params)
            .then(r  => {
                setHistory(r.data.sessions || [])
                setHistPagination(r.data.pagination)
            })
            .catch(e => setHistError(
                e.response?.data?.message || "Failed to load attendance history."
            ))
            .finally(() => setHistLoading(false))
    }, [histPage, histClassId, histSubjectId])

    useEffect(() => { fetchHistory() }, [fetchHistory])

    // ── load students ──────────────────────────────────────────────────────────

    const handleLoadStudents = () => {
        if (!selClassId || !selSubjectId || !selectedSession || !selDate) {
            setStudentsError("Please select class, subject, session, and date.")
            return
        }
        const requestId = ++studentLoadRequestRef.current
        const requestSelectionKey = selectionKey
        setStudents([])
        setLoadedSelectionKey(null)
        setStudentsLoading(true)
        setStudentsError(null)
        setSubmitError(null)
        setSubmitSuccess(null)
        setIsEditMode(false)
        setHasUnsaved(false)

        loadStudentsForAttendance({
            classId: selClassId,
            subjectId: selSubjectId,
            session: selectedSession,
            date: selDate,
        })
            .then(r => {
                if (
                    requestId !== studentLoadRequestRef.current ||
                    requestSelectionKey !== selectionKeyRef.current
                ) return
                setStudents(r.data.students || [])
                setLoadedSelectionKey(requestSelectionKey)
                setAlreadySubmitted(r.data.alreadySubmitted)
                setSubmittedSession(r.data.session || null)
            })
            .catch(e => {
                if (
                    requestId === studentLoadRequestRef.current &&
                    requestSelectionKey === selectionKeyRef.current
                ) {
                    setStudentsError(e.response?.data?.message || "Failed to load students.")
                }
            })
            .finally(() => {
                if (
                    requestId === studentLoadRequestRef.current &&
                    requestSelectionKey === selectionKeyRef.current
                ) {
                    setStudentsLoading(false)
                }
            })
    }

    // auto-load when all assignment and date controls are set
    useEffect(() => {
        if (selClassId && selSubjectId && selectedSession && selDate) handleLoadStudents()
    }, [selClassId, selSubjectId, selectedSession, selDate])

    // ── attendance change ──────────────────────────────────────────────────────

    const handleStatusChange = (studentId, newStatus) => {
        setStudents(prev => prev.map(s =>
            s._id === studentId ? { ...s, status: newStatus } : s
        ))
        setHasUnsaved(true)
    }

    const handleRemarksChange = (studentId, remarks) => {
        setStudents(prev => prev.map(s =>
            s._id === studentId ? { ...s, remarks } : s
        ))
        setHasUnsaved(true)
    }

    // ── bulk actions ───────────────────────────────────────────────────────────

    const markAll = (status) => {
        setStudents(prev => prev.map(s => ({ ...s, status })))
        setHasUnsaved(true)
    }

    const resetAttendance = () => {
        setStudents(prev => prev.map(s => ({ ...s, status:"present", remarks:"" })))
        setHasUnsaved(true)
    }

    // ── submit ─────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (studentsLoading || !rosterMatchesSelection || students.length === 0) return
        setSubmitting(true); setSubmitError(null); setSubmitSuccess(null)

        const records = students.map(s => ({
            studentId: s._id,
            status:    s.status,
            remarks:   s.remarks || "",
        }))

        try {
            const r = await submitAttendance({
                classId:   selClassId,
                subjectId: selSubjectId,
                date:      selDate,
                session:   selectedSession,
                records,
            })
            setHasUnsaved(false)
            setAlreadySubmitted(true)
            setSubmittedSession(r.data.summary)
            setSubmitSuccess(r.data.summary)
            fetchHistory()
            fetchPageData()
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to submit attendance."
            const isdup = err.response?.data?.alreadySubmitted
            setSubmitError(isdup
                ? "Attendance already submitted for this session."
                : msg
            )
            if (isdup) { setAlreadySubmitted(true); handleLoadStudents() }
        } finally { setSubmitting(false) }
    }

    // ── update (senior only) ───────────────────────────────────────────────────

    const handleUpdate = async () => {
        if (studentsLoading || !rosterMatchesSelection || students.length === 0) return
        setSubmitting(true); setSubmitError(null); setSubmitSuccess(null)

        const records = students.map(s => ({
            studentId: s._id,
            status:    s.status,
            remarks:   s.remarks || "",
        }))

        try {
            const r = await updateAttendance({
                classId:   selClassId,
                subjectId: selSubjectId,
                session:   selectedSession,
                date:      selDate,
                records,
            })
            setHasUnsaved(false)
            setIsEditMode(false)
            setSubmitSuccess({ message: r.data.message })
            fetchHistory()
        } catch (err) {
            setSubmitError(err.response?.data?.message || "Failed to update attendance.")
        } finally { setSubmitting(false) }
    }

    // ── session detail ─────────────────────────────────────────────────────────

    const openSessionDetail = (session) => {
        setDetailOpen(true)
        setDetailData(null)
        setDetailSession(session)
        setDetailLoading(true)

        getSessionDetail({
            classId:   session.classId,
            subjectId: session.subjectId,
            session:   session.session,
            date:      session.date,
        })
            .then(r  => setDetailData(r.data))
            .catch(e => console.error("Session detail error:", e))
            .finally(() => setDetailLoading(false))
    }

    // ── derived ────────────────────────────────────────────────────────────────

    const presentCount = students.filter(s => s.status === "present").length
    const absentCount  = students.filter(s => s.status === "absent").length
    const lateCount    = students.filter(s => s.status === "late").length
    const attPct       = students.length > 0
        ? Math.round((presentCount / students.length) * 100) : 0

    const isSenior    = pageData?.teacher?.role === "senior"
    const canEdit     = isSenior && alreadySubmitted
    const isReadOnly  = alreadySubmitted && !isEditMode

    // ── loading ────────────────────────────────────────────────────────────────

    if (pageLoading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p>
            <p>Loading attendance page...</p>
        </div>
    )
    if (pageError) return <div style={{ padding:"2rem", color:"#ef4444" }}>{pageError}</div>

    const { stats, classes, recentActivity } = pageData

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <div className="dashboard-page admin-page teacher-page">

            {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
            <PageHeader
                title="Attendance"
                description="Mark and manage attendance for your assigned classes and subjects."
                action={<div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" }}>
                    {isSenior && (
                        <span style={{
                            background:"#eff6ff", color:"#1e40af",
                            border:"1px solid #bfdbfe",
                            padding:"0.25rem 0.75rem", borderRadius:"9999px",
                            fontSize:"0.75rem", fontWeight:600
                        }}>
                            🎓 Senior Teacher — Edit Enabled
                        </span>
                    )}
                    <button className="btn btn-secondary" onClick={fetchPageData}>
                        Refresh
                    </button>
                </div>}
            />

            {/* ══════════════════════════════════════════════
                SUMMARY CARDS
            ══════════════════════════════════════════════ */}
            <div className="summary-card-grid">
                <SummaryCard icon="🏫" label="Classes"
                    value={stats.totalClasses}   sub="Assigned to you"      valueColor="#3b82f6" />
                <SummaryCard icon="📚" label="Subjects"
                    value={stats.totalSubjects}  sub="You teach"             valueColor="#8b5cf6" />
                <SummaryCard icon="✅" label="Submitted Today"
                    value={stats.submittedToday} sub="Sessions done"
                    valueColor="#16a34a" />
                <SummaryCard icon="⏳" label="Pending Today"
                    value={stats.pendingToday}   sub="Still need submission"
                    valueColor={stats.pendingToday > 0 ? "#ef4444" : "#16a34a"}
                    urgent={stats.pendingToday > 0} />
            </div>

            {/* ══════════════════════════════════════════════
                ATTENDANCE CONTROLS
            ══════════════════════════════════════════════ */}
            <Panel title="Attendance Controls">
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-end" }}>

                    {/* Class selector */}
                    <div className="form-group" style={{ flex:1, minWidth:"160px", margin:0 }}>
                        <label className="form-label">Select Class</label>
                        <select className="form-select" value={selClassId}
                            onChange={e => {
                                invalidateStudentRoster()
                                setSelClassId(e.target.value)
                                setSelSubjectId("")
                            }}>
                            <option value="">— Select Class —</option>
                            {classes.map(c => (
                                <option key={c._id} value={c._id}>
                                    {c.name} — {c.section}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subject selector */}
                    <div className="form-group" style={{ flex:1, minWidth:"160px", margin:0 }}>
                        <label className="form-label">Select Subject</label>
                        <select className="form-select" value={selSubjectId}
                            onChange={e => {
                                invalidateStudentRoster()
                                setSelSubjectId(e.target.value)
                            }}
                            disabled={!selClassId}>
                            <option value="">— Select Subject —</option>
                            {availableSubjects.map(s => (
                                <option key={s._id} value={s._id}>
                                    {s.name} ({s.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date picker */}
                    <div className="form-group" style={{ flex:1, minWidth:"140px", margin:0 }}>
                        <label className="form-label">Date</label>
                        <input className="form-input" type="date"
                            value={selDate}
                            max={todayStr()}
                            onChange={e => {
                                invalidateStudentRoster()
                                setSelDate(e.target.value)
                            }}
                        />
                    </div>

                    {/* Assignment session */}
                    <div className="form-group" style={{ flex:1, minWidth:"150px", margin:0 }}>
                        <label className="form-label">Session</label>
                        <select className="form-select"
                            value={selectedSession}
                            disabled={availableSessions.length === 0}
                            onChange={e => {
                                invalidateStudentRoster()
                                setSelSession(e.target.value)
                            }}
                        >
                            {availableSessions.length === 0
                                ? <option value="">— No assigned session —</option>
                                : availableSessions.map(session => (
                                    <option key={session} value={session}>{session}</option>
                                ))
                            }
                        </select>
                    </div>

                    {/* Load button */}
                    <button
                        className="btn btn-primary"
                        onClick={handleLoadStudents}
                        disabled={!selClassId || !selSubjectId || !selectedSession || !selDate || studentsLoading}
                        style={{ height:"38px", alignSelf:"flex-end" }}
                    >
                        {studentsLoading ? "Loading..." : "Load Students"}
                    </button>
                </div>

                {studentsError && (
                    <p style={{ color:"#ef4444", fontSize:"0.875rem", marginTop:"0.75rem" }}>
                        {studentsError}
                    </p>
                )}
            </Panel>

            {/* ══════════════════════════════════════════════
                ALREADY SUBMITTED BANNER
            ══════════════════════════════════════════════ */}
            {alreadySubmitted && !isEditMode && students.length > 0 && (
                <div style={{
                    display:"flex", alignItems:"center", gap:"1rem",
                    padding:"0.875rem 1.25rem",
                    background:"#eff6ff", border:"1.5px solid #bfdbfe",
                    borderRadius:"0.5rem", flexWrap:"wrap"
                }}>
                    <span style={{ fontSize:"1.5rem" }}>🔵</span>
                    <div style={{ flex:1 }}>
                        <p style={{ fontWeight:700, color:"#1e40af", margin:0 }}>
                            Attendance Already Submitted
                        </p>
                        <p style={{ fontSize:"0.8rem", color:"#1e40af", margin:"0.2rem 0 0", opacity:0.85 }}>
                            Attendance for this class, subject, and date has been recorded.
                            {submittedSession?.total && ` (${submittedSession.present || submittedSession.presentCount || 0}/${submittedSession.total || submittedSession.totalCount} present)`}
                        </p>
                    </div>
                    {canEdit && (
                        <button
                            className="btn btn-secondary"
                            style={{ fontSize:"0.8rem" }}
                            onClick={() => setIsEditMode(true)}
                        >
                            ✏️ Edit Attendance
                        </button>
                    )}
                    {!isSenior && (
                        <span style={{ fontSize:"0.78rem", color:"#6B7C78" }}>
                            Only senior teachers can edit submitted attendance.
                        </span>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════
                SUBMIT SUCCESS BANNER
            ══════════════════════════════════════════════ */}
            {submitSuccess && (
                <div style={{
                    padding:"0.875rem 1.25rem",
                    background:"#f0fdf4", border:"1.5px solid #bbf7d0",
                    borderRadius:"0.5rem"
                }}>
                    <p style={{ fontWeight:700, color:"#166534", margin:0 }}>
                        ✅ {submitSuccess.message || "Attendance submitted successfully!"}
                    </p>
                    {submitSuccess.total && (
                        <p style={{ fontSize:"0.8rem", color:"#166534", margin:"0.25rem 0 0" }}>
                            Present: {submitSuccess.present} &nbsp;|&nbsp;
                            Absent: {submitSuccess.absent} &nbsp;|&nbsp;
                            Late: {submitSuccess.late} &nbsp;|&nbsp;
                            Attendance: {submitSuccess.pct}%
                        </p>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════
                STUDENT ATTENDANCE TABLE
            ══════════════════════════════════════════════ */}
            {rosterMatchesSelection && students.length > 0 && (
                <Panel title={`Mark Attendance (${students.length} students)`}>

                    {/* Quick action buttons */}
                    {!isReadOnly && (
                        <div style={{
                            display:"flex", gap:"0.5rem", marginBottom:"1rem",
                            flexWrap:"wrap", alignItems:"center"
                        }}>
                            <span style={{ fontSize:"0.8rem", color:"#6B7C78", fontWeight:600 }}>
                                Quick:
                            </span>
                            <button className="btn btn-secondary" style={{ fontSize:"0.78rem" }}
                                onClick={() => markAll("present")}>
                                ✔ Mark All Present
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize:"0.78rem" }}
                                onClick={() => markAll("absent")}>
                                ✖ Mark All Absent
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize:"0.78rem" }}
                                onClick={resetAttendance}>
                                ↺ Reset
                            </button>
                            {hasUnsaved && (
                                <span style={{
                                    marginLeft:"auto", fontSize:"0.75rem",
                                    color:"#92400e", fontWeight:600,
                                    background:"#fffbeb", border:"1px solid #fde68a",
                                    padding:"0.2rem 0.625rem", borderRadius:"9999px"
                                }}>
                                    ⚠️ Unsaved changes
                                </span>
                            )}
                        </div>
                    )}

                    {/* Table */}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width:"40px" }}>#</th>
                                    <th>Student</th>
                                    <th>Roll No.</th>
                                    <th>Status</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((stu, idx) => {
                                    const ss = STATUS_STYLE[stu.status] || STATUS_STYLE.present
                                    return (
                                        <tr key={stu._id} style={{
                                            background: stu.status === "absent"
                                                ? "#fff5f5" : stu.status === "late"
                                                ? "#fffbeb" : undefined
                                        }}>
                                            <td style={{ color:"#9ca3af", fontSize:"0.8rem" }}>
                                                {idx + 1}
                                            </td>
                                            <td>
                                                <div style={{ display:"flex",
                                                    alignItems:"center", gap:"0.5rem" }}>
                                                    <div style={{
                                                        width:"30px", height:"30px",
                                                        borderRadius:"50%",
                                                        background:"#3b82f6", flexShrink:0,
                                                        display:"flex", alignItems:"center",
                                                        justifyContent:"center",
                                                        fontSize:"0.8rem", overflow:"hidden"
                                                    }}>
                                                        {stu.image
                                                            ? <img src={stu.image} alt={stu.name}
                                                                style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                                                            : "🎓"
                                                        }
                                                    </div>
                                                    <span style={{ fontWeight:500, fontSize:"0.875rem" }}>
                                                        {stu.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ fontFamily:"monospace",
                                                fontSize:"0.78rem", color:"#6B7C78" }}>
                                                {stu.rollNo}
                                            </td>
                                            <td>
                                                {isReadOnly ? (
                                                    <span style={{
                                                        background:ss.bg,
                                                        border:`1px solid ${ss.border}`,
                                                        color:ss.color,
                                                        padding:"0.2rem 0.625rem",
                                                        borderRadius:"9999px",
                                                        fontSize:"0.75rem", fontWeight:600
                                                    }}>
                                                        {ss.icon} {ss.label}
                                                    </span>
                                                ) : (
                                                    <StatusToggle
                                                        status={stu.status}
                                                        onChange={(s) => handleStatusChange(stu._id, s)}
                                                        disabled={false}
                                                    />
                                                )}
                                            </td>
                                            <td>
                                                {isReadOnly ? (
                                                    <span style={{ fontSize:"0.8rem", color:"#6B7C78",
                                                        fontStyle: stu.remarks ? "normal" : "italic" }}>
                                                        {stu.remarks || "—"}
                                                    </span>
                                                ) : (
                                                    <input
                                                        className="form-input"
                                                        style={{ fontSize:"0.8rem", padding:"0.25rem 0.5rem",
                                                            minWidth:"140px" }}
                                                        placeholder="Remarks (optional)"
                                                        value={stu.remarks || ""}
                                                        onChange={e =>
                                                            handleRemarksChange(stu._id, e.target.value)}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Attendance summary bar */}
                    <div style={{
                        display:"flex", gap:"1.5rem", flexWrap:"wrap",
                        marginTop:"1rem", padding:"0.75rem 1rem",
                        background:"#f8fafc", borderRadius:"0.375rem",
                        fontSize:"0.875rem", alignItems:"center"
                    }}>
                        <span>👨‍🎓 <strong>{students.length}</strong> Total</span>
                        <span style={{ color:"#16a34a" }}>✅ <strong>{presentCount}</strong> Present</span>
                        <span style={{ color:"#ef4444" }}>❌ <strong>{absentCount}</strong> Absent</span>
                        <span style={{ color:"#f59e0b" }}>🕐 <strong>{lateCount}</strong> Late</span>
                        <span style={{ marginLeft:"auto", fontWeight:700,
                            color: pctColor(attPct), fontSize:"1rem" }}>
                            {attPct}% Attendance
                        </span>
                    </div>

                    {/* Submit / Update / Cancel buttons */}
                    {!isReadOnly && (
                        <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem",
                            justifyContent:"flex-end" }}>
                            {submitError && (
                                <p style={{ color:"#ef4444", fontSize:"0.875rem",
                                    alignSelf:"center", margin:0 }}>
                                    {submitError}
                                </p>
                            )}
                            {isEditMode && (
                                <button className="btn btn-secondary"
                                    onClick={() => { setIsEditMode(false); setHasUnsaved(false) }}>
                                    Cancel
                                </button>
                            )}
                            <button
                                className="btn btn-primary"
                                onClick={isEditMode ? handleUpdate : handleSubmit}
                                disabled={submitting || studentsLoading || !rosterMatchesSelection}
                                style={{ minWidth:"140px" }}
                            >
                                {submitting
                                    ? (isEditMode ? "Updating..." : "Submitting...")
                                    : (isEditMode ? "💾 Update Attendance" : "✅ Submit Attendance")
                                }
                            </button>
                        </div>
                    )}
                </Panel>
            )}

             {/* ══════════════════════════════════════════════
                ATTENDANCE HISTORY + RECENT ACTIVITY
            ══════════════════════════════════════════════ */}
            <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-start" }}>

                {/* ── ATTENDANCE HISTORY ── */}
                <div style={{ flex:2, minWidth:"280px" }}>
                    <Panel title="Attendance History">

                        {/* History filters */}
                        <SearchFilters
                            showSearch={false}
                            filters={[
                                {
                                    id: "history-class",
                                    label: "Class:",
                                    value: histClassId,
                                    onChange: (value) => {
                                        setHistClassId(value);
                                        setHistPage(1);
                                    },
                                    options: [
                                        { value: "All", label: "All Classes" },
                                        ...classes.map((c) => ({
                                            value: c._id,
                                            label: `${c.name} — ${c.section}`,
                                        })),
                                    ],
                                },
                                {
                                    id: "history-subject",
                                    label: "Subject:",
                                    value: histSubjectId,
                                    onChange: (value) => {
                                        setHistSubjectId(value);
                                        setHistPage(1);
                                    },
                                    options: [
                                        { value: "All", label: "All Subjects" },
                                        ...(pageData?.subjects || []).map((s) => ({
                                            value: s._id,
                                            label: s.name,
                                        })),
                                    ],
                                },
                            ]}
                        />

                        {/* History table */}
                        {histLoading ? (
                            <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>
                                Loading history...
                            </p>
                        ) : histError ? (
                            <div role="alert" style={{ color:"#ef4444", fontSize:"0.875rem" }}>
                                {histError}
                            </div>
                        ) : history.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>📋</p>
                                <p style={{ fontSize:"0.875rem" }}>No attendance history yet.</p>
                            </div>
                        ) : (
                            <>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Class</th>
                                                <th>Subject</th>
                                                <th style={{ textAlign:"center" }}>Present</th>
                                                <th style={{ textAlign:"center" }}>Absent</th>
                                                <th style={{ textAlign:"center" }}>%</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map((sess, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontSize:"0.8rem",
                                                        whiteSpace:"nowrap" }}>
                                                        {fmt(sess.date)}
                                                    </td>
                                                    <td>
                                                        <span style={{ fontWeight:500,
                                                            fontSize:"0.875rem" }}>
                                                            {sess.className}
                                                        </span>
                                                        {sess.section && (
                                                            <span style={{ fontSize:"0.75rem",
                                                                color:"#6B7C78",
                                                                marginLeft:"0.25rem" }}>
                                                                — {sess.section}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize:"0.8rem",
                                                        color:"#6B7C78" }}>
                                                        {sess.subjectName || "—"}
                                                        {sess.session && (
                                                            <span style={{ marginLeft:"0.25rem" }}>
                                                                ({sess.session})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign:"center",
                                                        color:"#16a34a", fontWeight:600 }}>
                                                        {sess.presentCount}
                                                    </td>
                                                    <td style={{ textAlign:"center",
                                                        color:"#ef4444", fontWeight:600 }}>
                                                        {sess.absentCount}
                                                    </td>
                                                    <td style={{ textAlign:"center" }}>
                                                        <span style={{ fontWeight:700,
                                                            color: pctColor(sess.pct) }}>
                                                            {sess.pct}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display:"flex", gap:"0.25rem" }}>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ fontSize:"0.7rem" }}
                                                                onClick={() => openSessionDetail(sess)}
                                                            >
                                                                👁 View
                                                            </button>
                                                            {isSenior && (pageData.assignments || []).some(assignment =>
                                                                String(assignment.classId) === String(sess.classId) &&
                                                                String(assignment.subjectId) === String(sess.subjectId) &&
                                                                assignment.session === sess.session
                                                            ) && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ fontSize:"0.7rem" }}
                                                                    onClick={() => {
                                                                        invalidateStudentRoster()
                                                                        setSelClassId(sess.classId)
                                                                        setSelSubjectId(sess.subjectId)
                                                                        setSelSession(sess.session)
                                                                        setSelDate(
                                                                            new Date(sess.date)
                                                                                .toISOString()
                                                                                .split("T")[0]
                                                                        )
                                                                        window.scrollTo({ top:0, behavior:"smooth" })
                                                                    }}
                                                                >
                                                                    ✏️ Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {histPagination && histPagination.pages > 1 && (
                                    <div className="pagination">
                                        <button className="btn btn-secondary"
                                            disabled={histPage <= 1}
                                            onClick={() => setHistPage(p => p - 1)}>
                                            ← Prev
                                        </button>
                                        <span className="pagination-info">
                                            Page {histPagination.page} of {histPagination.pages}
                                        </span>
                                        <button className="btn btn-secondary"
                                            disabled={histPage >= histPagination.pages}
                                            onClick={() => setHistPage(p => p + 1)}>
                                            Next →
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </Panel>
                </div>

                {/* ── RECENT ACTIVITY ── */}
                <div style={{ flex:1, minWidth:"220px" }}>
                    <Panel title="Recent Activity">
                        {(recentActivity || []).length === 0 ? (
                            <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>
                                No recent activity.
                            </p>
                        ) : (
                            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                                {recentActivity.slice(0, 8).map((item, i) => (
                                    <div key={i} style={{
                                        display:"flex", gap:"0.625rem",
                                        padding:"0.625rem 0",
                                        borderBottom: i < Math.min(recentActivity.length, 8) - 1
                                            ? "1px solid #f1f5f9" : "none"
                                    }}>
                                        <div style={{ display:"flex",
                                            flexDirection:"column", alignItems:"center" }}>
                                            <span style={{ fontSize:"1rem", lineHeight:1 }}>📅</span>
                                            {i < Math.min(recentActivity.length, 8) - 1 && (
                                                <div style={{ width:"1px", flex:1,
                                                    background:"#e2e8f0", marginTop:"0.25rem" }} />
                                            )}
                                        </div>
                                        <div style={{ flex:1 }}>
                                            <p style={{ fontSize:"0.8rem", fontWeight:500,
                                                color:"#1F2D2C", margin:0 }}>
                                                Attendance submitted
                                            </p>
                                            <p style={{ fontSize:"0.72rem",
                                                color:"#6B7C78", margin:"0.125rem 0 0" }}>
                                                {item.presentCount}/{item.totalCount} present
                                                {item.submittedAt &&
                                                    ` · ${timeAgo(item.submittedAt)}`
                                                }
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                SESSION DETAIL DRAWER
            ══════════════════════════════════════════════ */}
            {detailOpen && (
                <div style={{
                    position:"fixed", top:0, right:0, bottom:0,
                    width:"480px", maxWidth:"100vw",
                    background:"#fff", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
                    zIndex:1000, display:"flex", flexDirection:"column",
                    overflowY:"auto"
                }}>
                    {/* Drawer header */}
                    <div style={{
                        padding:"1.25rem 1.5rem",
                        borderBottom:"1px solid #e2e8f0",
                        display:"flex", justifyContent:"space-between",
                        alignItems:"center", background:"#fff",
                        position:"sticky", top:0, zIndex:1
                    }}>
                        <div>
                            <p style={{ fontWeight:700, fontSize:"1rem",
                                color:"#1F2D2C", margin:0 }}>
                                Attendance Detail
                            </p>
                            {detailSession && (
                                <p style={{ fontSize:"0.78rem", color:"#6B7C78",
                                    margin:"0.2rem 0 0" }}>
                                    {detailSession.className} — {detailSession.section}
                                    &nbsp;·&nbsp;{detailSession.subjectName}
                                    &nbsp;·&nbsp;{fmt(detailSession.date)}
                                </p>
                            )}
                        </div>
                        <button
                            className="btn btn-danger"
                            onClick={() => setDetailOpen(false)}
                        >
                            Close
                        </button>
                    </div>

                    {/* Drawer body */}
                    <div style={{ padding:"1.25rem 1.5rem", flex:1 }}>
                        {detailLoading ? (
                            <div style={{ textAlign:"center", padding:"3rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>⏳</p>
                                <p style={{ fontSize:"0.875rem" }}>Loading session details...</p>
                            </div>
                        ) : detailData ? (
                            <>
                                {/* Summary boxes */}
                                <div style={{ display:"flex", gap:"0.625rem",
                                    marginBottom:"1.25rem" }}>
                                    {[
                                        { label:"Present", val: detailData.summary.present, color:"#16a34a" },
                                        { label:"Absent",  val: detailData.summary.absent,  color:"#ef4444" },
                                        { label:"Late",    val: detailData.summary.late,    color:"#f59e0b" },
                                        { label:"Total",   val: detailData.summary.total,   color:"#6B7C78" },
                                    ].map(item => (
                                        <div key={item.label} style={{
                                            flex:1, textAlign:"center",
                                            padding:"0.75rem 0.5rem",
                                            background:"#f8fafc",
                                            borderRadius:"0.375rem"
                                        }}>
                                            <p style={{ fontWeight:700, fontSize:"1.25rem",
                                                color:item.color, margin:0 }}>
                                                {item.val}
                                            </p>
                                            <p style={{ fontSize:"0.68rem",
                                                color:"#6B7C78", margin:0 }}>
                                                {item.label}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Attendance % bar */}
                                <div style={{ marginBottom:"1.25rem" }}>
                                    <div style={{ display:"flex", justifyContent:"space-between",
                                        fontSize:"0.75rem", color:"#6B7C78",
                                        marginBottom:"0.375rem" }}>
                                        <span>Attendance Rate</span>
                                        <span style={{ fontWeight:700,
                                            color: pctColor(detailData.summary.pct) }}>
                                            {detailData.summary.pct}%
                                        </span>
                                    </div>
                                    <div style={{ background:"#e2e8f0",
                                        borderRadius:"9999px", height:"8px" }}>
                                        <div style={{
                                            width:`${detailData.summary.pct}%`,
                                            height:"100%", borderRadius:"9999px",
                                            background: pctColor(detailData.summary.pct),
                                            transition:"width 0.5s"
                                        }} />
                                    </div>
                                </div>

                                {/* Student list */}
                                <p style={{ fontSize:"0.75rem", fontWeight:600,
                                    color:"#6B7C78", textTransform:"uppercase",
                                    letterSpacing:"0.04em", marginBottom:"0.75rem" }}>
                                    Student List
                                </p>
                                <div style={{ display:"flex", flexDirection:"column", gap:"0.375rem" }}>
                                    {detailData.records.map((rec, i) => {
                                        const ss = STATUS_STYLE[rec.status] || STATUS_STYLE.present
                                        return (
                                            <div key={rec.recordId || i} style={{
                                                display:"flex", alignItems:"center",
                                                gap:"0.75rem", padding:"0.625rem 0.875rem",
                                                background: ss.bg,
                                                border:`1px solid ${ss.border}`,
                                                borderRadius:"0.375rem"
                                            }}>
                                                {/* Avatar */}
                                                <div style={{
                                                    width:"28px", height:"28px",
                                                    borderRadius:"50%",
                                                    background:"#3b82f6", flexShrink:0,
                                                    display:"flex", alignItems:"center",
                                                    justifyContent:"center",
                                                    fontSize:"0.75rem", overflow:"hidden"
                                                }}>
                                                    {rec.student?.image
                                                        ? <img src={rec.student.image}
                                                            alt={rec.student.name}
                                                            style={{ width:"100%", height:"100%",
                                                                objectFit:"cover" }} />
                                                        : "🎓"
                                                    }
                                                </div>

                                                {/* Name + roll */}
                                                <div style={{ flex:1 }}>
                                                    <p style={{ fontWeight:500, fontSize:"0.8rem",
                                                        color:ss.color, margin:0 }}>
                                                        {rec.student?.name || "—"}
                                                    </p>
                                                    <p style={{ fontSize:"0.68rem",
                                                        color:"#6B7C78", margin:0,
                                                        fontFamily:"monospace" }}>
                                                        {rec.student?.rollNo || "—"}
                                                    </p>
                                                </div>

                                                {/* Status */}
                                                <span style={{ fontSize:"0.75rem",
                                                    fontWeight:600, color:ss.color,
                                                    whiteSpace:"nowrap" }}>
                                                    {ss.icon} {ss.label}
                                                </span>

                                                {/* Remarks */}
                                                {rec.remarks && (
                                                    <span style={{ fontSize:"0.68rem",
                                                        color:"#6B7C78", fontStyle:"italic" }}>
                                                        {rec.remarks}
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign:"center", padding:"3rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>⚠️</p>
                                <p style={{ fontSize:"0.875rem" }}>
                                    Could not load session details.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Drawer backdrop */}
            {detailOpen && (
                <div
                    style={{
                        position:"fixed", inset:0,
                        background:"rgba(0,0,0,0.3)",
                        zIndex:999
                    }}
                    onClick={() => setDetailOpen(false)}
                />
            )}

        </div>
    )
}