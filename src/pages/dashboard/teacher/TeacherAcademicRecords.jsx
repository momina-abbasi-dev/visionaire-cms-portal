import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Panel } from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx"
import {
    getAcademicRecordsPageData,
    loadStudentsForMarks,
    saveAcademicRecords,
    getSubmittedRecords,
    getRecordGroupDetail,
} from "../../../services/teacherAcademicRecordsService.js"

// ── constants ──────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
    { value:"quiz",       label:"Quiz",        max:10  },
    { value:"assignment", label:"Assignment",  max:20  },
    { value:"practical",  label:"Practical",   max:25  },
    { value:"midterm",    label:"Mid-Term",    max:30  },
    { value:"final",      label:"Final Exam",  max:50  },
]

const STATUS_STYLE = {
    new:      { className:"status-neutral", label:"New" },
    pending:  { className:"status-pending", label:"Draft" },
    verified: { className:"status-success", label:"Submitted" },
}

const EXAM_COLORS = {
    quiz:       "#6366f1",
    assignment: "#3b82f6",
    practical:  "#10b981",
    midterm:    "#f59e0b",
    final:      "#ef4444",
}

// ── helpers ────────────────────────────────────────────────────────────────────

const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", {
        day:"2-digit", month:"short", year:"numeric"
    }) : "—"

const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)
    if (diff < 60)    return `${diff}s ago`
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

const pctColor = (p) =>
    p >= 80 ? "#16a34a" : p >= 60 ? "#f59e0b" : "#ef4444"

const marksColor = (marks, max) => {
    if (marks === "" || marks == null) return "#6B7C78"
    const pct = (marks / max) * 100
    return pctColor(pct)
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

const StatusBadge = ({ status }) => {
    const s = STATUS_STYLE[status] || STATUS_STYLE.new
    return <span className={`status ${s.className}`}>{s.label}</span>
}

const ExamBadge = ({ examType }) => {
    const color = EXAM_COLORS[examType] || "#6B7C78"
    const label = EXAM_TYPES.find(e => e.value === examType)?.label || examType
    return (
        <span style={{
            background:`${color}15`, border:`1px solid ${color}30`, color,
            padding:"0.2rem 0.625rem", borderRadius:"9999px",
            fontSize:"0.72rem", fontWeight:600, textTransform:"capitalize"
        }}>
            {label}
        </span>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function TeacherAcademicRecords() {
    const [searchParams] = useSearchParams()

    // ── page bootstrap ─────────────────────────────────────────────────────────
    const [pageData,    setPageData]    = useState(null)
    const [pageLoading, setPageLoading] = useState(true)
    const [pageError,   setPageError]   = useState(null)

    // ── record controls ────────────────────────────────────────────────────────
    const [selClassId,   setSelClassId]   = useState(searchParams.get("class")   || "")
    const [selSubjectId, setSelSubjectId] = useState(searchParams.get("subject") || "")
    const [selExamType,  setSelExamType]  = useState(searchParams.get("exam")    || "midterm")
    const [selSession,   setSelSession]   = useState(new Date().getFullYear().toString())

    // ── students / marks ───────────────────────────────────────────────────────
    const [students,       setStudents]       = useState([])
    const [studentsLoading,setStudentsLoading]= useState(false)
    const [studentsError,  setStudentsError]  = useState(null)
    const [maxMarks,       setMaxMarks]       = useState(50)
    const [hasExisting,    setHasExisting]    = useState(false)
    const [hasUnsaved,     setHasUnsaved]     = useState(false)

    // ── save / submit ──────────────────────────────────────────────────────────
    const [saving,       setSaving]       = useState(false)
    const [saveError,    setSaveError]    = useState(null)
    const [saveSuccess,  setSaveSuccess]  = useState(null)
    const [saveMode,     setSaveMode]     = useState(null) // "draft" | "submit"

    // ── submitted records ──────────────────────────────────────────────────────
    const [submitted,       setSubmitted]       = useState([])
    const [submittedLoading,setSubmittedLoading]= useState(false)
    const [subPage,         setSubPage]         = useState(1)
    const [subPagination,   setSubPagination]   = useState(null)
    const [subClassFilter,  setSubClassFilter]  = useState("All")
    const [subExamFilter,   setSubExamFilter]   = useState("All")
    const [subStatusFilter, setSubStatusFilter] = useState("All")

    // ── detail drawer ──────────────────────────────────────────────────────────
    const [detailOpen,    setDetailOpen]    = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailData,    setDetailData]    = useState(null)
    const [detailGroup,   setDetailGroup]   = useState(null)

    // ── unsaved warning ────────────────────────────────────────────────────────
    const hasUnsavedRef = useRef(false)
    useEffect(() => { hasUnsavedRef.current = hasUnsaved }, [hasUnsaved])
    useEffect(() => {
        const handler = (e) => {
            if (hasUnsavedRef.current) { e.preventDefault(); e.returnValue = "" }
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [])

    const selectedClassIdRef = useRef(selClassId)
    selectedClassIdRef.current = selClassId

    // ── fetch page bootstrap ───────────────────────────────────────────────────

    const fetchPageData = useCallback(() => {
        setPageLoading(true); setPageError(null)
        getAcademicRecordsPageData()
            .then(r => {
                setPageData(r.data)
                if (!selectedClassIdRef.current && r.data.classes?.length > 0) {
                    const first = r.data.classes[0]
                    setSelClassId(first._id)
                    if (first.subjects?.length > 0) setSelSubjectId(first.subjects[0]._id)
                }
            })
            .catch(() => setPageError("Failed to load page data."))
            .finally(() => setPageLoading(false))
    }, [])

    useEffect(() => { fetchPageData() }, [fetchPageData])

    // ── available subjects for selected class ──────────────────────────────────
    const availableSubjects = pageData?.classes?.find(
        c => c._id.toString() === selClassId
    )?.subjects || []

    // ── fetch submitted records ────────────────────────────────────────────────

    const fetchSubmitted = useCallback(() => {
        setSubmittedLoading(true)
        const params = { page: subPage, limit: 10 }
        if (subClassFilter  !== "All") params.classId   = subClassFilter
        if (subExamFilter   !== "All") params.examType  = subExamFilter
        if (subStatusFilter !== "All") params.status    = subStatusFilter

        getSubmittedRecords(params)
            .then(r => {
                setSubmitted(r.data.groups || [])
                setSubPagination(r.data.pagination)
            })
            .catch(e => console.error("Submitted records fetch error:", e))
            .finally(() => setSubmittedLoading(false))
    }, [subPage, subClassFilter, subExamFilter, subStatusFilter])

    useEffect(() => { fetchSubmitted() }, [fetchSubmitted])
    useEffect(() => { setSubPage(1) }, [subClassFilter, subExamFilter, subStatusFilter])

    // ── load students for marks entry ──────────────────────────────────────────

    const handleLoadStudents = useCallback(() => {
        if (!selClassId || !selSubjectId || !selExamType || !selSession.trim()) {
            setStudentsError("Please select class, subject, assessment type, and session.")
            return
        }
        setStudentsLoading(true)
        setStudentsError(null)
        setSaveError(null)
        setSaveSuccess(null)
        setHasUnsaved(false)

        loadStudentsForMarks({
            classId: selClassId,
            subjectId: selSubjectId,
            examType: selExamType,
            session: selSession.trim(),
        })
            .then(r => {
                setStudents(r.data.students || [])
                setMaxMarks(r.data.maxMarks || 50)
                setHasExisting(r.data.hasExisting || false)
            })
            .catch(e => setStudentsError(e.response?.data?.message || "Failed to load students."))
            .finally(() => setStudentsLoading(false))
    }, [selClassId, selSubjectId, selExamType, selSession])

    // auto-load when all 3 controls are ready
    useEffect(() => {
        if (selClassId && selSubjectId && selExamType && selSession.trim()) handleLoadStudents()
    }, [handleLoadStudents, selClassId, selSubjectId, selExamType, selSession])

    // ── marks change ───────────────────────────────────────────────────────────

    const handleMarksChange = (studentId, value) => {
        const parsed = value === "" ? "" : Number(value)
        setStudents(prev => prev.map(s =>
            s._id === studentId ? { ...s, marks: parsed, dirty: true } : s
        ))
        setHasUnsaved(true)
    }

    const handleRemarksChange = (studentId, remarks) => {
        setStudents(prev => prev.map(s =>
            s._id === studentId ? { ...s, remarks, dirty: true } : s
        ))
        setHasUnsaved(true)
    }

    // ── validation ─────────────────────────────────────────────────────────────

    const validateMarks = () => {
        const errors = []
        for (const s of students) {
            if (s.marks === "" || s.marks == null) continue
            if (Number(s.marks) > maxMarks) {
                errors.push(`${s.name}: ${s.marks} exceeds max (${maxMarks})`)
            }
            if (Number(s.marks) < 0) {
                errors.push(`${s.name}: marks cannot be negative`)
            }
        }
        return errors
    }

    // ── save / submit ──────────────────────────────────────────────────────────

    const handleSave = async (mode) => {
        const errors = validateMarks()
        if (errors.length > 0) {
            setSaveError(`Validation failed: ${errors[0]}`)
            return
        }

        const filled = students.filter(s => s.marks !== "" && s.marks != null)
        if (filled.length === 0) {
            setSaveError("Please enter marks for at least one student.")
            return
        }

        setSaving(true); setSaveError(null); setSaveSuccess(null); setSaveMode(mode)

        const records = filled.map(s => ({
            studentId: s._id,
            marks:     Number(s.marks),
            remarks:   s.remarks || "",
        }))

        try {
            const r = await saveAcademicRecords({
                classId:    selClassId,
                subjectId:  selSubjectId,
                examType:   selExamType,
                session:    selSession,
                records,
                submitMode: mode,
            })
            setHasUnsaved(false)
            setSaveSuccess(r.data)
            // mark students as saved
            setStudents(prev => prev.map(s => ({
                ...s,
                status: filled.find(f => f.studentId === s._id)
                    ? (mode === "submit" ? "verified" : "pending")
                    : s.status,
                dirty: false,
            })))
            setHasExisting(true)
            fetchSubmitted()
            fetchPageData()
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to save records."
            setSaveError(msg)
        } finally { setSaving(false); setSaveMode(null) }
    }

    // ── detail drawer ──────────────────────────────────────────────────────────

    const openDetail = (group) => {
        setDetailOpen(true)
        setDetailData(null)
        setDetailGroup(group)
        setDetailLoading(true)

        getRecordGroupDetail({
            classId:   group.classId,
            subjectId: group.subjectId,
            examType:  group.examType,
            session:   group.session,
        })
            .then(r  => setDetailData(r.data))
            .catch(e => console.error("Detail fetch error:", e))
            .finally(() => setDetailLoading(false))
    }

    // ── derived ────────────────────────────────────────────────────────────────

    const filledCount     = students.filter(s => s.marks !== "" && s.marks != null).length
    const remainingCount  = students.length - filledCount
    const avgMarksDisplay = filledCount > 0
        ? Math.round(students.filter(s => s.marks !== "").reduce((sum, s) => sum + Number(s.marks), 0) / filledCount)
        : null

    const isSenior   = pageData?.teacher?.role === "senior"
    const isReadOnly = hasExisting && !isSenior

    // ── loading / error ────────────────────────────────────────────────────────

    if (pageLoading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p>
            <p>Loading academic records...</p>
        </div>
    )
    if (pageError) return <div style={{ padding:"2rem", color:"#ef4444" }}>{pageError}</div>

    const { stats, classes, recentRecords } = pageData

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <div className="dashboard-page admin-page teacher-page">

            {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
            <PageHeader
                title="Academic Records"
                description="Manage assessments and marks for your students."
                action={<div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" }}>
                    {isSenior && (
                        <span style={{
                            background:"#eff6ff", color:"#1e40af",
                            border:"1px solid #bfdbfe",
                            padding:"0.25rem 0.75rem", borderRadius:"9999px",
                            fontSize:"0.75rem", fontWeight:600
                        }}>
                            🎓 Senior — Edit Enabled
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
                    value={stats.totalClasses}   sub="Assigned"            valueColor="#3b82f6" />
                <SummaryCard icon="📚" label="Subjects"
                    value={stats.totalSubjects}  sub="You teach"            valueColor="#8b5cf6" />
                <SummaryCard icon="👨‍🎓" label="Students"
                    value={stats.totalStudents}  sub="Active"               valueColor="#10b981" />
                <SummaryCard icon="📝" label="Pending"
                    value={stats.pendingRecords} sub="Students with no records"
                    valueColor={stats.pendingRecords > 0 ? "#f59e0b" : "#16a34a"}
                    urgent={stats.pendingRecords > 0} />
                <SummaryCard icon="✅" label="Submitted"
                    value={stats.submittedCount} sub="Verified records"     valueColor="#16a34a" />
                <SummaryCard icon="📄" label="Result Ready"
                    value={stats.readyForResult} sub="Classes"
                    valueColor={stats.readyForResult > 0 ? "#16a34a" : "#6B7C78"} />
            </div>

            {/* ══════════════════════════════════════════════
                RECORD CONTROLS
            ══════════════════════════════════════════════ */}
            <Panel title="Record Controls">
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-end" }}>

                    {/* Class */}
                    <div className="form-group" style={{ flex:1, minWidth:"150px", margin:0 }}>
                        <label className="form-label">Class</label>
                        <select className="form-select" value={selClassId}
                            onChange={e => {
                                setSelClassId(e.target.value)
                                setSelSubjectId("")
                                setStudents([])
                                setHasExisting(false)
                            }}>
                            <option value="">— Select Class —</option>
                            {classes.map(c => (
                                <option key={c._id} value={c._id}>
                                    {c.name} — {c.section}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subject */}
                    <div className="form-group" style={{ flex:1, minWidth:"150px", margin:0 }}>
                        <label className="form-label">Subject</label>
                        <select className="form-select" value={selSubjectId}
                            onChange={e => {
                                setSelSubjectId(e.target.value)
                                setStudents([])
                                setHasExisting(false)
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

                    {/* Assessment type */}
                    <div className="form-group" style={{ flex:1, minWidth:"140px", margin:0 }}>
                        <label className="form-label">Assessment Type</label>
                        <select className="form-select" value={selExamType}
                            onChange={e => {
                                setSelExamType(e.target.value)
                                setStudents([])
                                setHasExisting(false)
                            }}>
                            {EXAM_TYPES.map(e => (
                                <option key={e.value} value={e.value}>
                                    {e.label} (Max: {e.max})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Session */}
                    <div className="form-group" style={{ flex:1, minWidth:"110px", margin:0 }}>
                        <label className="form-label">Session</label>
                        <input className="form-input" type="text"
                            value={selSession}
                            placeholder="e.g. 2024-2025"
                            onChange={e => setSelSession(e.target.value)}
                        />
                    </div>

                    {/* Load button */}
                    <button
                        className="btn btn-primary"
                        onClick={handleLoadStudents}
                        disabled={!selClassId || !selSubjectId || !selExamType || studentsLoading}
                        style={{ height:"38px", alignSelf:"flex-end" }}
                    >
                        {studentsLoading ? "Loading..." : "Load Students"}
                    </button>
                </div>

                {/* Max marks info chip */}
                {selExamType && (
                    <div style={{ marginTop:"0.75rem", display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
                        <span style={{
                            background:`${EXAM_COLORS[selExamType] || "#6B7C78"}15`,
                            color: EXAM_COLORS[selExamType] || "#6B7C78",
                            border:`1px solid ${EXAM_COLORS[selExamType] || "#6B7C78"}30`,
                            padding:"0.2rem 0.75rem", borderRadius:"9999px",
                            fontSize:"0.78rem", fontWeight:600
                        }}>
                            {EXAM_TYPES.find(e => e.value === selExamType)?.label} — Max Marks: {maxMarks}
                        </span>
                        {hasExisting && (
                            <span style={{
                                background:"#eff6ff", color:"#1e40af",
                                border:"1px solid #bfdbfe",
                                padding:"0.2rem 0.75rem", borderRadius:"9999px",
                                fontSize:"0.78rem", fontWeight:600
                            }}>
                                ℹ️ Existing records found — editing{isSenior ? " enabled" : " requires senior teacher"}
                            </span>
                        )}
                    </div>
                )}

                {studentsError && (
                    <p style={{ color:"#ef4444", fontSize:"0.875rem", marginTop:"0.75rem" }}>
                        {studentsError}
                    </p>
                )}
            </Panel>

            {/* ══════════════════════════════════════════════
                SAVE SUCCESS / ERROR BANNER
            ══════════════════════════════════════════════ */}
            {saveSuccess && (
                <div style={{
                    padding:"0.875rem 1.25rem",
                    background:"#f0fdf4", border:"1.5px solid #bbf7d0",
                    borderRadius:"0.5rem"
                }}>
                    <p style={{ fontWeight:700, color:"#166534", margin:0 }}>
                        ✅ {saveSuccess.message}
                    </p>
                    <p style={{ fontSize:"0.8rem", color:"#166534", margin:"0.25rem 0 0" }}>
                        {saveSuccess.savedCount} record(s) saved · Status: {saveSuccess.status}
                    </p>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                STUDENT MARKS TABLE
            ══════════════════════════════════════════════ */}
            {students.length > 0 && (
                <Panel title={`Enter Marks — ${EXAM_TYPES.find(e => e.value === selExamType)?.label || selExamType} (Max: ${maxMarks})`}>

                    {/* Junior read-only warning */}
                    {isReadOnly && (
                        <div style={{
                            marginBottom:"1rem", padding:"0.75rem 1rem",
                            background:"#fffbeb", border:"1px solid #fde68a",
                            borderRadius:"0.375rem", fontSize:"0.8rem", color:"#92400e"
                        }}>
                            ⚠️ Records already submitted. Only senior teachers can edit submitted records.
                        </div>
                    )}

                    {/* Quick actions row */}
                    {!isReadOnly && (
                        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1rem",
                            flexWrap:"wrap", alignItems:"center" }}>
                            {hasUnsaved && (
                                <span style={{
                                    fontSize:"0.75rem", color:"#92400e", fontWeight:600,
                                    background:"#fffbeb", border:"1px solid #fde68a",
                                    padding:"0.2rem 0.625rem", borderRadius:"9999px"
                                }}>
                                    ⚠️ Unsaved changes
                                </span>
                            )}
                            <span style={{ marginLeft:"auto" }} />
                            <button className="btn btn-secondary" style={{ fontSize:"0.78rem" }}
                                onClick={() => {
                                    setStudents(prev => prev.map(s => ({ ...s, marks:"", remarks:"", dirty:false })))
                                    setHasUnsaved(false)
                                }}>
                                ↺ Clear Form
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ fontSize:"0.78rem" }}
                                onClick={() => handleSave("draft")}
                                disabled={saving}
                            >
                                {saving && saveMode === "draft" ? "Saving..." : "💾 Save Draft"}
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ fontSize:"0.78rem" }}
                                onClick={() => handleSave("submit")}
                                disabled={saving}
                            >
                                {saving && saveMode === "submit" ? "Submitting..." : "✅ Submit Records"}
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {saveError && (
                        <p style={{ color:"#ef4444", fontSize:"0.875rem", marginBottom:"0.75rem" }}>
                            {saveError}
                        </p>
                    )}

                    {/* Table */}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width:"36px" }}>#</th>
                                    <th>Student</th>
                                    <th>Roll No.</th>
                                    <th style={{ textAlign:"center" }}>
                                        Marks (Max: {maxMarks})
                                    </th>
                                    <th style={{ textAlign:"center" }}>%</th>
                                    <th>Remarks</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((stu, idx) => {
                                    const pct = stu.marks !== "" && stu.marks != null
                                        ? Math.round((Number(stu.marks) / maxMarks) * 100)
                                        : null
                                    const isOver = stu.marks !== "" && Number(stu.marks) > maxMarks

                                    return (
                                        <tr key={stu._id} style={{
                                            background: isOver ? "#fff5f5" : undefined
                                        }}>
                                            <td style={{ color:"#9ca3af", fontSize:"0.8rem" }}>
                                                {idx + 1}
                                            </td>

                                            {/* Student */}
                                            <td>
                                                <div style={{ display:"flex",
                                                    alignItems:"center", gap:"0.5rem" }}>
                                                    <div style={{
                                                        width:"30px", height:"30px",
                                                        borderRadius:"50%", background:"#3b82f6",
                                                        flexShrink:0, display:"flex",
                                                        alignItems:"center", justifyContent:"center",
                                                        fontSize:"0.8rem", overflow:"hidden"
                                                    }}>
                                                        {stu.image
                                                            ? <img src={stu.image} alt={stu.name}
                                                                style={{ width:"100%", height:"100%",
                                                                    objectFit:"cover" }} />
                                                            : "🎓"
                                                        }
                                                    </div>
                                                    <span style={{ fontWeight:500, fontSize:"0.875rem" }}>
                                                        {stu.name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Roll No */}
                                            <td style={{ fontFamily:"monospace",
                                                fontSize:"0.78rem", color:"#6B7C78" }}>
                                                {stu.rollNo}
                                            </td>

                                            {/* Marks input */}
                                            <td style={{ textAlign:"center" }}>
                                                {isReadOnly ? (
                                                    <span style={{
                                                        fontWeight:700, fontSize:"1rem",
                                                        color: marksColor(stu.marks, maxMarks)
                                                    }}>
                                                        {stu.marks ?? "—"}
                                                    </span>
                                                ) : (
                                                    <div style={{ display:"flex", flexDirection:"column",
                                                        alignItems:"center", gap:"0.2rem" }}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={maxMarks}
                                                            className="form-input"
                                                            style={{
                                                                width:"80px", textAlign:"center",
                                                                fontSize:"0.875rem",
                                                                border: isOver
                                                                    ? "1px solid #ef4444" : undefined,
                                                                fontWeight:600,
                                                                color: marksColor(stu.marks, maxMarks)
                                                            }}
                                                            value={stu.marks ?? ""}
                                                            onChange={e =>
                                                                handleMarksChange(stu._id, e.target.value)}
                                                            placeholder={`/ ${maxMarks}`}
                                                        />
                                                        {isOver && (
                                                            <span style={{ fontSize:"0.65rem",
                                                                color:"#ef4444", whiteSpace:"nowrap" }}>
                                                                Max: {maxMarks}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Percentage */}
                                            <td style={{ textAlign:"center" }}>
                                                {pct != null ? (
                                                    <span style={{ fontWeight:600,
                                                        fontSize:"0.8rem", color: pctColor(pct) }}>
                                                        {pct}%
                                                    </span>
                                                ) : (
                                                    <span style={{ color:"#d1d5db" }}>—</span>
                                                )}
                                            </td>

                                            {/* Remarks */}
                                            <td>
                                                {isReadOnly ? (
                                                    <span style={{ fontSize:"0.8rem",
                                                        color:"#6B7C78",
                                                        fontStyle: stu.remarks ? "normal" : "italic" }}>
                                                        {stu.remarks || "—"}
                                                    </span>
                                                ) : (
                                                    <input
                                                        className="form-input"
                                                        style={{ fontSize:"0.78rem",
                                                            padding:"0.25rem 0.5rem",
                                                            minWidth:"130px" }}
                                                        placeholder="Optional remarks"
                                                        value={stu.remarks || ""}
                                                        onChange={e =>
                                                            handleRemarksChange(stu._id, e.target.value)}
                                                    />
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td>
                                                {stu.dirty
                                                    ? <StatusBadge status="pending" />
                                                    : <StatusBadge status={stu.status} />
                                                }
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Record summary bar */}
                    <div style={{
                        display:"flex", gap:"1.5rem", flexWrap:"wrap",
                        marginTop:"1rem", padding:"0.75rem 1rem",
                        background:"#f8fafc", borderRadius:"0.375rem",
                        fontSize:"0.875rem", alignItems:"center"
                    }}>
                        <span>👨‍🎓 <strong>{students.length}</strong> Students</span>
                        <span style={{ color:"#16a34a" }}>
                            ✅ <strong>{filledCount}</strong> Records Filled
                        </span>
                        <span style={{ color: remainingCount > 0 ? "#f59e0b" : "#16a34a" }}>
                            ⏳ <strong>{remainingCount}</strong> Remaining
                        </span>
                        {avgMarksDisplay != null && (
                            <span style={{ marginLeft:"auto", fontWeight:700,
                                color: pctColor(Math.round((avgMarksDisplay / maxMarks) * 100)) }}>
                                Class Avg: {avgMarksDisplay} / {maxMarks}
                            </span>
                        )}
                    </div>
                </Panel>
            )}

             {/* ══════════════════════════════════════════════
                SUBMITTED RECORDS + RECENT ACTIVITY
            ══════════════════════════════════════════════ */}
            <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-start" }}>

                {/* ── SUBMITTED RECORDS ── */}
                <div style={{ flex:2, minWidth:"280px" }}>
                    <Panel title="Submitted Records">

                        {/* Filters */}
                        <SearchFilters
                            showSearch={false}
                            filters={[
                                {
                                    id: "submitted-class",
                                    label: "Class:",
                                    value: subClassFilter,
                                    onChange: setSubClassFilter,
                                    options: [
                                        { value: "All", label: "All Classes" },
                                        ...classes.map((c) => ({
                                            value: c._id,
                                            label: `${c.name} — ${c.section}`,
                                        })),
                                    ],
                                },
                                {
                                    id: "submitted-assessment",
                                    label: "Assessment:",
                                    value: subExamFilter,
                                    onChange: setSubExamFilter,
                                    options: [
                                        { value: "All", label: "All Types" },
                                        ...EXAM_TYPES.map((exam) => ({
                                            value: exam.value,
                                            label: exam.label,
                                        })),
                                    ],
                                },
                                {
                                    id: "submitted-status",
                                    label: "Status:",
                                    value: subStatusFilter,
                                    onChange: setSubStatusFilter,
                                    options: [
                                        { value: "All", label: "All" },
                                        { value: "pending", label: "Draft" },
                                        { value: "verified", label: "Submitted" },
                                    ],
                                },
                            ]}
                        />

                        {/* Table */}
                        {submittedLoading ? (
                            <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>
                                Loading records...
                            </p>
                        ) : submitted.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>📋</p>
                                <p style={{ fontSize:"0.875rem" }}>
                                    No submitted records yet.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Class</th>
                                                <th>Subject</th>
                                                <th>Assessment</th>
                                                <th style={{ textAlign:"center" }}>Students</th>
                                                <th style={{ textAlign:"center" }}>Avg Marks</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {submitted.map((grp, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <p style={{ fontWeight:500,
                                                            fontSize:"0.875rem", margin:0 }}>
                                                            {grp.className}
                                                        </p>
                                                        {grp.section && (
                                                            <p style={{ fontSize:"0.72rem",
                                                                color:"#6B7C78", margin:0 }}>
                                                                Section {grp.section}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td style={{ fontSize:"0.8rem" }}>
                                                        <p style={{ margin:0, fontWeight:500 }}>
                                                            {grp.subjectName}
                                                        </p>
                                                        <p style={{ margin:0, fontSize:"0.72rem",
                                                            color:"#6B7C78", fontFamily:"monospace" }}>
                                                            {grp.subjectCode}
                                                        </p>
                                                    </td>
                                                    <td>
                                                        <ExamBadge examType={grp.examType} />
                                                    </td>
                                                    <td style={{ textAlign:"center",
                                                        fontWeight:600, color:"#3b82f6" }}>
                                                        {grp.totalCount}
                                                    </td>
                                                    <td style={{ textAlign:"center" }}>
                                                        {grp.avgMarks != null ? (
                                                            <span style={{ fontWeight:700,
                                                                color: marksColor(
                                                                    grp.avgMarks,
                                                                    EXAM_TYPES.find(e => e.value === grp.examType)?.max || 100
                                                                )
                                                            }}>
                                                                {grp.avgMarks}
                                                            </span>
                                                        ) : "—"}
                                                    </td>
                                                    <td>
                                                        <StatusBadge status={grp.status} />
                                                    </td>
                                                    <td style={{ fontSize:"0.78rem",
                                                        color:"#6B7C78", whiteSpace:"nowrap" }}>
                                                        {fmt(grp.submittedAt)}
                                                    </td>
                                                    <td>
                                                        <div style={{ display:"flex", gap:"0.25rem" }}>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ fontSize:"0.7rem" }}
                                                                onClick={() => openDetail(grp)}
                                                            >
                                                                👁 View
                                                            </button>
                                                            {isSenior && (
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ fontSize:"0.7rem" }}
                                                                    onClick={() => {
                                                                        setSelClassId(grp.classId)
                                                                        setSelSubjectId(grp.subjectId)
                                                                        setSelExamType(grp.examType)
                                                                        setStudents([])
                                                                        setHasExisting(false)
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
                                {subPagination && subPagination.pages > 1 && (
                                    <div className="pagination">
                                        <button className="btn btn-secondary"
                                            disabled={subPage <= 1}
                                            onClick={() => setSubPage(p => p - 1)}>
                                            ← Prev
                                        </button>
                                        <span className="pagination-info">
                                            Page {subPagination.page} of {subPagination.pages}
                                        </span>
                                        <button className="btn btn-secondary"
                                            disabled={subPage >= subPagination.pages}
                                            onClick={() => setSubPage(p => p + 1)}>
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
                        {(recentRecords || []).length === 0 ? (
                            <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>
                                No recent activity.
                            </p>
                        ) : (
                            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                                {recentRecords.slice(0, 8).map((rec, i) => (
                                    <div key={i} style={{
                                        display:"flex", gap:"0.625rem",
                                        padding:"0.625rem 0",
                                        borderBottom: i < Math.min(recentRecords.length, 8) - 1
                                            ? "1px solid #f1f5f9" : "none"
                                    }}>
                                        <div style={{ display:"flex",
                                            flexDirection:"column", alignItems:"center" }}>
                                            <span style={{ fontSize:"0.875rem", lineHeight:1 }}>
                                                {rec.status === "verified" ? "✅" : "🟡"}
                                            </span>
                                            {i < Math.min(recentRecords.length, 8) - 1 && (
                                                <div style={{ width:"1px", flex:1,
                                                    background:"#e2e8f0", marginTop:"0.25rem" }} />
                                            )}
                                        </div>
                                        <div style={{ flex:1 }}>
                                            <p style={{ fontSize:"0.78rem", fontWeight:500,
                                                color:"#1F2D2C", margin:0 }}>
                                                {rec.studentName}
                                            </p>
                                            <p style={{ fontSize:"0.7rem", color:"#6B7C78",
                                                margin:"0.1rem 0 0" }}>
                                                {rec.subjectName} · {rec.examType} · {rec.marks} marks
                                            </p>
                                            <p style={{ fontSize:"0.68rem", color:"#9ca3af",
                                                margin:"0.1rem 0 0" }}>
                                                {rec.className} {rec.section} · {timeAgo(rec.createdAt)}
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
                RECORD DETAIL DRAWER
            ══════════════════════════════════════════════ */}
            {detailOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{
                            position:"fixed", inset:0,
                            background:"rgba(0,0,0,0.3)", zIndex:999
                        }}
                        onClick={() => setDetailOpen(false)}
                    />

                    {/* Drawer panel */}
                    <div style={{
                        position:"fixed", top:0, right:0, bottom:0,
                        width:"520px", maxWidth:"100vw",
                        background:"#fff",
                        boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
                        zIndex:1000, display:"flex", flexDirection:"column",
                        overflowY:"auto"
                    }}>

                        {/* Drawer header */}
                        <div style={{
                            padding:"1.25rem 1.5rem",
                            borderBottom:"1px solid #e2e8f0",
                            display:"flex", justifyContent:"space-between",
                            alignItems:"flex-start", background:"#fff",
                            position:"sticky", top:0, zIndex:1
                        }}>
                            <div>
                                <p style={{ fontWeight:700, fontSize:"1rem",
                                    color:"#1F2D2C", margin:0 }}>
                                    Record Details
                                </p>
                                {detailGroup && (
                                    <p style={{ fontSize:"0.78rem", color:"#6B7C78",
                                        margin:"0.25rem 0 0" }}>
                                        {detailGroup.className} — {detailGroup.section}
                                        &nbsp;·&nbsp;{detailGroup.subjectName}
                                        &nbsp;·&nbsp;
                                        {EXAM_TYPES.find(e => e.value === detailGroup.examType)?.label}
                                    </p>
                                )}
                            </div>
                            <button className="btn btn-danger"
                                onClick={() => setDetailOpen(false)}>
                                Close
                            </button>
                        </div>

                        {/* Drawer body */}
                        <div style={{ padding:"1.25rem 1.5rem", flex:1 }}>

                            {detailLoading ? (
                                <div style={{ textAlign:"center", padding:"3rem", color:"#6B7C78" }}>
                                    <p style={{ fontSize:"1.5rem" }}>⏳</p>
                                    <p style={{ fontSize:"0.875rem" }}>Loading details...</p>
                                </div>
                            ) : detailData ? (
                                <>
                                    {/* Group info */}
                                    <Panel title="Record Information">
                                        <div className="detail-grid">
                                            {[
                                                ["Class",       `${detailData.summary.className} — ${detailData.summary.section}`],
                                                ["Subject",     detailData.summary.subjectName],
                                                ["Code",        detailData.summary.subjectCode],
                                                ["Assessment",  EXAM_TYPES.find(e => e.value === detailData.summary.examType)?.label],
                                                ["Max Marks",   detailData.summary.maxAllowed],
                                                ["Total Students", detailData.summary.totalStudents],
                                            ].map(([label, val]) => (
                                                <div key={label} className="detail-row">
                                                    <span className="detail-label">{label}</span>
                                                    <span className="detail-value">{val ?? "—"}</span>
                                                </div>
                                            ))}
                                            <div className="detail-row">
                                                <span className="detail-label">Status</span>
                                                <StatusBadge status={detailData.summary.status} />
                                            </div>
                                        </div>
                                    </Panel>

                                    {/* Stats boxes */}
                                    <Panel title="Class Performance" style={{ marginTop:"1rem" }}>
                                        <div style={{ display:"flex", gap:"0.625rem",
                                            flexWrap:"wrap" }}>
                                            {[
                                                { label:"Average",  val: detailData.summary.avgMarks, color:"#3b82f6" },
                                                { label:"Highest",  val: detailData.summary.maxMarks, color:"#16a34a" },
                                                { label:"Lowest",   val: detailData.summary.minMarks, color:"#ef4444" },
                                                { label:"Max Allowed", val: detailData.summary.maxAllowed, color:"#6B7C78" },
                                            ].map(item => (
                                                <div key={item.label} style={{
                                                    flex:1, minWidth:"80px", textAlign:"center",
                                                    padding:"0.75rem 0.5rem",
                                                    background:"#f8fafc", borderRadius:"0.375rem"
                                                }}>
                                                    <p style={{ fontWeight:700, fontSize:"1.25rem",
                                                        color:item.color, margin:0 }}>
                                                        {item.val ?? "—"}
                                                    </p>
                                                    <p style={{ fontSize:"0.68rem",
                                                        color:"#6B7C78", margin:0 }}>
                                                        {item.label}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Average progress bar */}
                                        {detailData.summary.avgMarks != null && (
                                            <div style={{ marginTop:"0.875rem" }}>
                                                <div style={{ display:"flex",
                                                    justifyContent:"space-between",
                                                    fontSize:"0.75rem", color:"#6B7C78",
                                                    marginBottom:"0.3rem" }}>
                                                    <span>Class Average</span>
                                                    <span style={{ fontWeight:700,
                                                        color: pctColor(Math.round(
                                                            (detailData.summary.avgMarks / detailData.summary.maxAllowed) * 100
                                                        ))
                                                    }}>
                                                        {Math.round((detailData.summary.avgMarks / detailData.summary.maxAllowed) * 100)}%
                                                    </span>
                                                </div>
                                                <div style={{ background:"#e2e8f0",
                                                    borderRadius:"9999px", height:"8px" }}>
                                                    <div style={{
                                                        width:`${Math.round((detailData.summary.avgMarks / detailData.summary.maxAllowed) * 100)}%`,
                                                        height:"100%", borderRadius:"9999px",
                                                        background: pctColor(Math.round(
                                                            (detailData.summary.avgMarks / detailData.summary.maxAllowed) * 100
                                                        )),
                                                        transition:"width 0.5s"
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                                    </Panel>

                                    {/* Student list */}
                                    <div style={{ marginTop:"1rem" }}>
                                        <p style={{ fontSize:"0.75rem", fontWeight:600,
                                            color:"#6B7C78", textTransform:"uppercase",
                                            letterSpacing:"0.04em", marginBottom:"0.75rem" }}>
                                            Student Marks ({detailData.records.length})
                                        </p>
                                        <div style={{ display:"flex",
                                            flexDirection:"column", gap:"0.375rem" }}>
                                            {detailData.records.map((rec, i) => {
                                                const barPct = Math.min(
                                                    Math.round((rec.marks / rec.maxMarks) * 100), 100
                                                )
                                                return (
                                                    <div key={rec.recordId || i} style={{
                                                        padding:"0.75rem 1rem",
                                                        border:"1px solid #e2e8f0",
                                                        borderRadius:"0.375rem",
                                                        background:"#fafafa"
                                                    }}>
                                                        {/* Student row */}
                                                        <div style={{ display:"flex",
                                                            alignItems:"center",
                                                            gap:"0.625rem",
                                                            marginBottom:"0.5rem" }}>

                                                            {/* Avatar */}
                                                            <div style={{
                                                                width:"28px", height:"28px",
                                                                borderRadius:"50%",
                                                                background:"#3b82f6",
                                                                flexShrink:0, display:"flex",
                                                                alignItems:"center",
                                                                justifyContent:"center",
                                                                fontSize:"0.75rem",
                                                                overflow:"hidden"
                                                            }}>
                                                                {rec.student?.image
                                                                    ? <img
                                                                        src={rec.student.image}
                                                                        alt={rec.student.name}
                                                                        style={{ width:"100%", height:"100%",
                                                                            objectFit:"cover" }}
                                                                    />
                                                                    : "🎓"
                                                                }
                                                            </div>

                                                            {/* Name + roll */}
                                                            <div style={{ flex:1 }}>
                                                                <p style={{ fontWeight:500,
                                                                    fontSize:"0.8rem",
                                                                    color:"#1F2D2C", margin:0 }}>
                                                                    {rec.student?.name || "—"}
                                                                </p>
                                                                <p style={{ fontSize:"0.68rem",
                                                                    color:"#6B7C78", margin:0,
                                                                    fontFamily:"monospace" }}>
                                                                    {rec.student?.rollNo || "—"}
                                                                </p>
                                                            </div>

                                                            {/* Marks + % */}
                                                            <div style={{ textAlign:"right",
                                                                flexShrink:0 }}>
                                                                <p style={{ fontWeight:700,
                                                                    fontSize:"1rem",
                                                                    color: pctColor(barPct),
                                                                    margin:0 }}>
                                                                    {rec.marks}
                                                                    <span style={{ fontSize:"0.7rem",
                                                                        color:"#9ca3af",
                                                                        fontWeight:400 }}>
                                                                        /{rec.maxMarks}
                                                                    </span>
                                                                </p>
                                                                <p style={{ fontSize:"0.68rem",
                                                                    color: pctColor(barPct),
                                                                    fontWeight:600, margin:0 }}>
                                                                    {barPct}%
                                                                </p>
                                                            </div>

                                                            {/* Status */}
                                                            <StatusBadge status={rec.status} />
                                                        </div>

                                                        {/* Mini progress bar */}
                                                        <div style={{ background:"#e2e8f0",
                                                            borderRadius:"9999px", height:"4px" }}>
                                                            <div style={{
                                                                width:`${barPct}%`,
                                                                height:"100%",
                                                                borderRadius:"9999px",
                                                                background: pctColor(barPct),
                                                                transition:"width 0.4s"
                                                            }} />
                                                        </div>

                                                        {/* Remarks */}
                                                        {rec.remarks && (
                                                            <p style={{ fontSize:"0.7rem",
                                                                color:"#6B7C78", margin:"0.375rem 0 0",
                                                                fontStyle:"italic" }}>
                                                                📝 {rec.remarks}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign:"center",
                                    padding:"3rem", color:"#6B7C78" }}>
                                    <p style={{ fontSize:"1.5rem" }}>⚠️</p>
                                    <p style={{ fontSize:"0.875rem" }}>
                                        Could not load record details.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

        </div>
    )
}
