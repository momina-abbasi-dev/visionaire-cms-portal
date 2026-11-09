import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Panel } from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx"
import {
    getResultsPageData,
    getResults,
    getStudentFullResult,
    verifyResult,
    getVerificationQueue,
} from "../../../services/teacherResultsService.js"

// ── style maps ─────────────────────────────────────────────────────────────────

const GRADE_STYLE = {
    A: { color:"#166534", bg:"#f0fdf4", border:"#bbf7d0" },
    B: { color:"#1e40af", bg:"#eff6ff", border:"#bfdbfe" },
    C: { color:"#92400e", bg:"#fffbeb", border:"#fde68a" },
    D: { color:"#9a3412", bg:"#fff7ed", border:"#fed7aa" },
    F: { color:"#991b1b", bg:"#fef2f2", border:"#fecaca" },
}

const STATUS_STYLE = {
    pass:    { className:"status-success", label:"Pass" },
    fail:    { className:"status-error", label:"Fail" },
    pending: { className:"status-pending", label:"Pending" },
}

const GRADE_STATUS_CLASS = {
    A: "status-success",
    B: "status-info",
    C: "status-warning",
    D: "status-warning",
    F: "status-error",
}

const STANDING_STYLE = {
    "Outstanding Performance":  { color:"#166534", bg:"#f0fdf4", border:"#bbf7d0" },
    "Excellent Performance":    { color:"#1e40af", bg:"#eff6ff", border:"#bfdbfe" },
    "Good Performance":         { color:"#6b21a8", bg:"#faf5ff", border:"#e9d5ff" },
    "Satisfactory Performance": { color:"#92400e", bg:"#fffbeb", border:"#fde68a" },
    "Needs Improvement":        { color:"#9a3412", bg:"#fff7ed", border:"#fed7aa" },
    "Unsatisfactory":           { color:"#991b1b", bg:"#fef2f2", border:"#fecaca" },
}

// ── helpers ────────────────────────────────────────────────────────────────────

const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", {
        day:"2-digit", month:"short", year:"numeric"
    }) : "—"

const pctColor = (p) =>
    p >= 80 ? "#16a34a" : p >= 65 ? "#1e40af" : p >= 50 ? "#f59e0b" : "#ef4444"

// ── sub-components ─────────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, urgent }) => (
    <SharedSummaryCard
        title={label}
        value={value ?? "—"}
        supporting={sub}
        variant={urgent ? "warning" : "default"}
    />
)

const GradeBadge = ({ grade }) => {
    if (!grade) return <span className="status status-neutral">—</span>
    const className = GRADE_STATUS_CLASS[grade] || "status-neutral"
    return <span className={`status ${className}`}>{grade}</span>
}

const ResultStatusBadge = ({ status }) => {
    const s = STATUS_STYLE[status] || STATUS_STYLE.pending
    return <span className={`status ${s.className}`}>{s.label}</span>
}

const VerifiedBadge = ({ verifiedBy }) =>
    verifiedBy ? (
        <span className="status status-info">Verified</span>
    ) : (
        <span className="status status-warning">Unverified</span>
    )

// ── print helper ───────────────────────────────────────────────────────────────

const printStudentResult = (student, results, overall) => {
    const w = window.open("", "_blank", "width=860,height=700")
    w.document.write(`
        <html><head>
        <title>Result — ${student.name}</title>
        <style>
            *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;}
            body{padding:32px;color:#1F2D2C;font-size:14px;}
            .header{text-align:center;border-bottom:3px solid #1F2D2C;padding-bottom:16px;margin-bottom:24px;}
            .header h1{font-size:20px;font-weight:800;}
            .header p{font-size:12px;color:#666;margin-top:4px;}
            .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;}
            .info-cell{padding:10px 14px;border-bottom:1px solid #e2e8f0;border-right:1px solid #e2e8f0;}
            .info-cell:nth-child(even){border-right:none;}
            .info-cell label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:3px;}
            .info-cell strong{font-size:14px;font-weight:700;}
            .summary-row{display:flex;gap:12px;margin-bottom:20px;}
            .summary-box{flex:1;text-align:center;border:1px solid #e2e8f0;border-radius:8px;padding:12px;}
            .summary-box .val{font-size:22px;font-weight:800;}
            .summary-box .lbl{font-size:11px;color:#666;text-transform:uppercase;margin-top:4px;}
            table{width:100%;border-collapse:collapse;margin-bottom:20px;}
            th{background:#1F2D2C;color:#fff;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;}
            td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;}
            tr:nth-child(even) td{background:#f8fafc;}
            .pass{color:#166534;font-weight:700;} .fail{color:#991b1b;font-weight:700;}
            .footer{border-top:2px dashed #ccc;margin-top:24px;padding-top:16px;text-align:center;font-size:11px;color:#888;}
        </style>
        </head><body>
        <div class="header">
            <h1>Official Result Card</h1>
            <p>Educational Management System — Teacher Review Copy</p>
        </div>
        <div class="info-grid">
            <div class="info-cell"><label>Student Name</label><strong>${student.name}</strong></div>
            <div class="info-cell"><label>Roll Number</label><strong>${student.rollNo}</strong></div>
            <div class="info-cell"><label>Program</label><strong>${student.program || "—"}</strong></div>
            <div class="info-cell"><label>Printed On</label><strong>${new Date().toLocaleDateString()}</strong></div>
        </div>
        <div class="summary-row">
            ${[
                ["Total Marks",   overall.totalMarks],
                ["Obtained",      overall.totalObtained],
                ["Percentage",    `${overall.avgPct}%`],
                ["Grade",         overall.overallGrade],
                ["Status",        overall.overallStatus.toUpperCase()],
            ].map(([l, v]) => `<div class="summary-box"><div class="val">${v}</div><div class="lbl">${l}</div></div>`).join("")}
        </div>
        <table>
            <thead><tr><th>Subject</th><th>Code</th><th>Obtained</th><th>Total</th><th>%</th><th>Att.%</th><th>Grade</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
                ${results.map(r => `<tr>
                    <td>${r.subjectName || "—"}</td>
                    <td style="font-family:monospace">${r.subjectCode || "—"}</td>
                    <td style="text-align:center;font-weight:700">${r.obtainedMarks}</td>
                    <td style="text-align:center;color:#888">${r.totalMarks}</td>
                    <td style="text-align:center;font-weight:700">${r.marksPercentage}%</td>
                    <td style="text-align:center">${r.attendancePercentage}%</td>
                    <td style="text-align:center">${r.grade}</td>
                    <td class="${r.status}">${r.status?.toUpperCase()}</td>
                    <td style="color:#888;font-size:12px">${r.remarks || "—"}</td>
                </tr>`).join("")}
            </tbody>
        </table>
        <div class="footer">
            <p>This is a teacher review copy. Official results are published by the administration.</p>
        </div>
        </body></html>
    `)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 500)
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function TeacherResults() {
    const [searchParams] = useSearchParams()

    // ── page bootstrap ─────────────────────────────────────────────────────────
    const [pageData,    setPageData]    = useState(null)
    const [pageLoading, setPageLoading] = useState(true)
    const [pageError,   setPageError]   = useState(null)

    // ── result controls ────────────────────────────────────────────────────────
    const [selClassId,   setSelClassId]   = useState(searchParams.get("class")   || "All")
    const [selSubjectId, setSelSubjectId] = useState(searchParams.get("subject") || "All")
    const [selSession,   setSelSession]   = useState("All")
    const [selStatus,    setSelStatus]    = useState("All")
    const [search,       setSearch]       = useState(searchParams.get("student") ? "" : "")
    const [page,         setPage]         = useState(1)

    // ── results list ───────────────────────────────────────────────────────────
    const [results,     setResults]     = useState([])
    const [pagination,  setPagination]  = useState(null)
    const [resLoading,  setResLoading]  = useState(false)
    const [resError,    setResError]    = useState(null)

    // ── verification queue ─────────────────────────────────────────────────────
    const [queue,        setQueue]        = useState([])
    const [queueLoading, setQueueLoading] = useState(false)
    const [verifying,    setVerifying]    = useState(null)
    const [verifySuccess,setVerifySuccess]= useState(null)
    const [verifyError,  setVerifyError]  = useState(null)

    // ── drawer ─────────────────────────────────────────────────────────────────
    const [drawerOpen,    setDrawerOpen]    = useState(false)
    const [drawerLoading, setDrawerLoading] = useState(false)
    const [drawerData,    setDrawerData]    = useState(null)
    const [drawerError,   setDrawerError]   = useState(null)
    const [drawerSession, setDrawerSession] = useState("All")

    // ── fetch page bootstrap ───────────────────────────────────────────────────

    const fetchPageData = useCallback(() => {
        setPageLoading(true); setPageError(null)
        getResultsPageData()
            .then(r => setPageData(r.data))
            .catch(() => setPageError("Failed to load page data."))
            .finally(() => setPageLoading(false))
    }, [])

    useEffect(() => { fetchPageData() }, [fetchPageData])

    // ── fetch results list ─────────────────────────────────────────────────────

    const fetchResults = useCallback(() => {
        setResLoading(true); setResError(null)
        const params = { page, limit: 20 }
        if (selClassId   !== "All") params.classId      = selClassId
        if (selSubjectId !== "All") params.subjectId    = selSubjectId
        if (selSession   !== "All") params.session      = selSession
        if (selStatus    !== "All") params.resultStatus = selStatus
        if (search)                 params.search       = search

        getResults(params)
            .then(r  => { setResults(r.data.results || []); setPagination(r.data.pagination) })
            .catch(e => setResError("Failed to load results."))
            .finally(() => setResLoading(false))
    }, [selClassId, selSubjectId, selSession, selStatus, search, page])

    useEffect(() => { fetchResults() }, [fetchResults])
    useEffect(() => { setPage(1) }, [selClassId, selSubjectId, selSession, selStatus, search])

    // ── fetch verification queue ───────────────────────────────────────────────

    const fetchQueue = useCallback(() => {
        setQueueLoading(true)
        getVerificationQueue()
            .then(r  => setQueue(r.data.queue || []))
            .catch(e => console.error("Queue fetch error:", e))
            .finally(() => setQueueLoading(false))
    }, [])

    useEffect(() => {
        if (pageData?.teacher?.role === "senior") fetchQueue()
    }, [pageData, fetchQueue])

    // ── open student drawer ────────────────────────────────────────────────────

    const openDrawer = (result) => {
        setDrawerOpen(true)
        setDrawerData(null)
        setDrawerError(null)
        setDrawerLoading(true)
        setDrawerSession(result.session || "All")

        getStudentFullResult(result.student._id, {
            session: result.session || undefined
        })
            .then(r  => setDrawerData(r.data))
            .catch(e => setDrawerError(
                e.response?.data?.message || "Failed to load student result."
            ))
            .finally(() => setDrawerLoading(false))
    }

    // ── verify result ──────────────────────────────────────────────────────────

    const handleVerify = async (resultId) => {
        setVerifying(resultId); setVerifyError(null); setVerifySuccess(null)
        try {
            await verifyResult(resultId)
            setVerifySuccess(resultId)
            fetchResults()
            fetchQueue()
            setTimeout(() => setVerifySuccess(null), 3000)
        } catch (err) {
            setVerifyError(err.response?.data?.message || "Verification failed.")
        } finally { setVerifying(null) }
    }

    // ── loading / error ────────────────────────────────────────────────────────

    if (pageLoading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
            height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p>
            <p>Loading results...</p>
        </div>
    )
    if (pageError) return <div style={{ padding:"2rem", color:"#ef4444" }}>{pageError}</div>

    const { stats, classes, subjects, sessions } = pageData
    const isSenior = pageData?.teacher?.role === "senior"

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <div className="dashboard-page admin-page teacher-page">

            {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
            <PageHeader
                title="Results"
                description="Review official results for your assigned classes and subjects."
                action={<div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" }}>
                    {isSenior && (
                        <span style={{
                            background:"#eff6ff", color:"#1e40af",
                            border:"1px solid #bfdbfe",
                            padding:"0.25rem 0.75rem", borderRadius:"9999px",
                            fontSize:"0.75rem", fontWeight:600
                        }}>
                            🎓 Senior — Verify Enabled
                        </span>
                    )}
                    <button className="btn btn-secondary"
                        onClick={() => { fetchPageData(); fetchResults() }}>
                        Refresh
                    </button>
                </div>}
            />

            {/* ══════════════════════════════════════════════
                SUMMARY CARDS
            ══════════════════════════════════════════════ */}
            <div className="summary-card-grid">
                <SummaryCard icon="🏫" label="Classes"
                    value={stats.totalClasses}       sub="Assigned"
                    valueColor="#3b82f6" />
                <SummaryCard icon="📚" label="Subjects"
                    value={stats.totalSubjects}      sub="You teach"
                    valueColor="#8b5cf6" />
                <SummaryCard icon="📄" label="Published"
                    value={stats.publishedCount}     sub="Result entries"
                    valueColor="#16a34a" />
                <SummaryCard icon="⏳" label="Unverified"
                    value={stats.pendingVerification} sub="Awaiting review"
                    valueColor={stats.pendingVerification > 0 ? "#f59e0b" : "#16a34a"}
                    urgent={isSenior && stats.pendingVerification > 0} />
                <SummaryCard icon="👨‍🎓" label="Students"
                    value={stats.totalStudents}      sub="Evaluated"
                    valueColor="#10b981" />
                <SummaryCard icon="✅" label="Pass Rate"
                    value={`${stats.passRate}%`}     sub="Of published results"
                    valueColor={stats.passRate >= 75 ? "#16a34a" : "#f59e0b"} />
            </div>

            {/* ══════════════════════════════════════════════
                VERIFICATION QUEUE (senior only)
            ══════════════════════════════════════════════ */}
            {isSenior && queue.length > 0 && (
                <Panel title={`⏳ Verification Queue (${queue.length} pending)`}>
                    {verifyError && (
                        <p style={{ color:"#ef4444", fontSize:"0.875rem",
                            marginBottom:"0.75rem" }}>
                            {verifyError}
                        </p>
                    )}
                    {verifySuccess && (
                        <p style={{ color:"#16a34a", fontSize:"0.875rem",
                            marginBottom:"0.75rem" }}>
                            ✅ Result verified successfully.
                        </p>
                    )}
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Class</th>
                                    <th>Subject</th>
                                    <th>Session</th>
                                    <th style={{ textAlign:"center" }}>Students</th>
                                    <th style={{ textAlign:"center" }}>Pass</th>
                                    <th style={{ textAlign:"center" }}>Fail</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {queueLoading ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign:"center",
                                            color:"#6B7C78", padding:"1rem" }}>
                                            Loading queue...
                                        </td>
                                    </tr>
                                ) : queue.map((q, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight:500 }}>
                                            {q.className} — {q.section}
                                        </td>
                                        <td>
                                            <p style={{ margin:0, fontWeight:500,
                                                fontSize:"0.875rem" }}>
                                                {q.subjectName}
                                            </p>
                                            <p style={{ margin:0, fontSize:"0.72rem",
                                                color:"#6B7C78", fontFamily:"monospace" }}>
                                                {q.subjectCode}
                                            </p>
                                        </td>
                                        <td style={{ fontSize:"0.8rem", color:"#6B7C78" }}>
                                            {q.session}
                                        </td>
                                        <td style={{ textAlign:"center", fontWeight:600,
                                            color:"#3b82f6" }}>
                                            {q.totalCount}
                                        </td>
                                        <td style={{ textAlign:"center", fontWeight:600,
                                            color:"#16a34a" }}>
                                            {q.passCount}
                                        </td>
                                        <td style={{ textAlign:"center", fontWeight:600,
                                            color:"#ef4444" }}>
                                            {q.failCount}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-primary"
                                                style={{ fontSize:"0.75rem" }}
                                                onClick={() => {
                                                    if (q.sampleIds?.length > 0)
                                                        handleVerify(q.sampleIds[0])
                                                }}
                                                disabled={verifying != null}
                                            >
                                                {verifying ? "Verifying..." : "✅ Verify Group"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            )}

            {/* ══════════════════════════════════════════════
                RESULT CONTROLS + SEARCH
            ══════════════════════════════════════════════ */}
            <SearchFilters
                searchValue={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by student name or roll number..."
                filters={[
                        {
                            id: "class",
                            label: "Class:",
                            value: selClassId,
                            onChange: setSelClassId,
                            options: [
                                { value: "All", label: "All Classes" },
                                ...classes.map((c) => ({
                                    value: c._id,
                                    label: `${c.name} — ${c.section}`,
                                })),
                            ],
                        },
                        {
                            id: "subject",
                            label: "Subject:",
                            value: selSubjectId,
                            onChange: setSelSubjectId,
                            options: [
                                { value: "All", label: "All Subjects" },
                                ...subjects.map((s) => ({
                                    value: s._id,
                                    label: s.name,
                                })),
                            ],
                        },
                        {
                            id: "session",
                            label: "Session:",
                            value: selSession,
                            onChange: setSelSession,
                            options: ["All", ...sessions],
                        },
                        {
                            id: "status",
                            label: "Status:",
                            value: selStatus,
                            onChange: setSelStatus,
                            options: [
                                { value: "All", label: "All" },
                                { value: "pass", label: "Pass" },
                                { value: "fail", label: "Fail" },
                            ],
                        },
                ]}
                onReset={search || selClassId !== "All" || selSubjectId !== "All" ||
                    selSession !== "All" || selStatus !== "All"
                    ? () => {
                        setSearch("");
                        setSelClassId("All");
                        setSelSubjectId("All");
                        setSelSession("All");
                        setSelStatus("All");
                    }
                    : undefined}
            />

            {/* ══════════════════════════════════════════════
                RESULTS TABLE
            ══════════════════════════════════════════════ */}
            {resError ? (
                <div style={{ padding:"1rem", color:"#ef4444" }}>{resError}</div>
            ) : (
                <Panel title={`Results (${pagination?.total || 0})`}>
                    {resLoading ? (
                        <p style={{ color:"#6B7C78", fontSize:"0.875rem",
                            padding:"1rem" }}>
                            Loading results...
                        </p>
                    ) : results.length === 0 ? (
                        <div style={{ textAlign:"center", padding:"3rem", color:"#6B7C78" }}>
                            <p style={{ fontSize:"2.5rem" }}>📄</p>
                            <p style={{ fontWeight:600, marginTop:"0.5rem" }}>
                                No Results Found
                            </p>
                            <p style={{ fontSize:"0.875rem" }}>
                                Results will appear here once generated by the administration.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Roll No.</th>
                                            <th>Subject</th>
                                            <th>Class</th>
                                            <th>Session</th>
                                            <th style={{ textAlign:"center" }}>Obtained</th>
                                            <th style={{ textAlign:"center" }}>%</th>
                                            <th style={{ textAlign:"center" }}>Grade</th>
                                            <th style={{ textAlign:"center" }}>Status</th>
                                            <th>Verified</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map(r => (
                                            <tr key={r._id}>
                                                {/* Student */}
                                                <td>
                                                    <div style={{ display:"flex",
                                                        alignItems:"center", gap:"0.5rem" }}>
                                                        <div style={{
                                                            width:"30px", height:"30px",
                                                            borderRadius:"50%",
                                                            background:"#3b82f6",
                                                            flexShrink:0, display:"flex",
                                                            alignItems:"center",
                                                            justifyContent:"center",
                                                            fontSize:"0.8rem",
                                                            overflow:"hidden"
                                                        }}>
                                                            {r.student?.image
                                                                ? <img src={r.student.image}
                                                                    alt={r.student.name}
                                                                    style={{ width:"100%",
                                                                        height:"100%",
                                                                        objectFit:"cover" }} />
                                                                : "🎓"
                                                            }
                                                        </div>
                                                        <span style={{ fontWeight:500,
                                                            fontSize:"0.875rem" }}>
                                                            {r.student?.name}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td style={{ fontFamily:"monospace",
                                                    fontSize:"0.78rem", color:"#6B7C78" }}>
                                                    {r.student?.rollNo}
                                                </td>

                                                <td>
                                                    <p style={{ margin:0, fontWeight:500,
                                                        fontSize:"0.875rem" }}>
                                                        {r.subject?.name}
                                                    </p>
                                                    <p style={{ margin:0, fontSize:"0.7rem",
                                                        color:"#6B7C78",
                                                        fontFamily:"monospace" }}>
                                                        {r.subject?.code}
                                                    </p>
                                                </td>

                                                <td style={{ fontSize:"0.8rem" }}>
                                                    {r.classSection?.name} — {r.classSection?.section}
                                                </td>

                                                <td style={{ fontSize:"0.78rem",
                                                    color:"#6B7C78" }}>
                                                    {r.session}
                                                </td>

                                                <td style={{ textAlign:"center",
                                                    fontWeight:700 }}>
                                                    {r.obtainedMarks}
                                                    <span style={{ color:"#9ca3af",
                                                        fontWeight:400,
                                                        fontSize:"0.75rem" }}>
                                                        /{r.totalMarks}
                                                    </span>
                                                </td>

                                                <td style={{ textAlign:"center" }}>
                                                    <span style={{ fontWeight:700,
                                                        color: pctColor(r.marksPercentage) }}>
                                                        {r.marksPercentage}%
                                                    </span>
                                                </td>

                                                <td style={{ textAlign:"center" }}>
                                                    <GradeBadge grade={r.grade} />
                                                </td>

                                                <td style={{ textAlign:"center" }}>
                                                    <ResultStatusBadge status={r.status} />
                                                </td>

                                                <td>
                                                    <VerifiedBadge verifiedBy={r.generatedBy} />
                                                </td>

                                                <td>
                                                    <div style={{ display:"flex",
                                                        gap:"0.25rem" }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ fontSize:"0.7rem" }}
                                                            onClick={() => openDrawer(r)}
                                                            title="View Result"
                                                        >
                                                            👁
                                                        </button>
                                                        {isSenior && !r.generatedBy && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ fontSize:"0.7rem" }}
                                                                onClick={() => handleVerify(r._id)}
                                                                disabled={verifying === r._id}
                                                                title="Verify"
                                                            >
                                                                {verifying === r._id ? "..." : "✅"}
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
                            {pagination && pagination.pages > 1 && (
                                <div className="pagination">
                                    <button className="btn btn-secondary"
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => p - 1)}>
                                        ← Prev
                                    </button>
                                    <span className="pagination-info">
                                        Page {pagination.page} of {pagination.pages}
                                        &nbsp;({pagination.total} results)
                                    </span>
                                    <button className="btn btn-secondary"
                                        disabled={page >= pagination.pages}
                                        onClick={() => setPage(p => p + 1)}>
                                        Next →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </Panel>
            )}

                        {/* ══════════════════════════════════════════════
                STUDENT RESULT DRAWER
            ══════════════════════════════════════════════ */}
            {drawerOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{
                            position:"fixed", inset:0,
                            background:"rgba(0,0,0,0.3)", zIndex:999
                        }}
                        onClick={() => setDrawerOpen(false)}
                    />

                    {/* Drawer panel */}
                    <div style={{
                        position:"fixed", top:0, right:0, bottom:0,
                        width:"580px", maxWidth:"100vw",
                        background:"#fff",
                        boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
                        zIndex:1000, display:"flex", flexDirection:"column",
                        overflowY:"auto"
                    }}>

                        {/* ── Drawer header ── */}
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
                                    Student Result
                                </p>
                                {drawerData && (
                                    <p style={{ fontSize:"0.78rem", color:"#6B7C78",
                                        margin:"0.25rem 0 0" }}>
                                        {drawerData.student.name} &nbsp;·&nbsp;
                                        {drawerData.student.rollNo}
                                    </p>
                                )}
                            </div>
                            <div style={{ display:"flex", gap:"0.5rem" }}>
                                {drawerData && (
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize:"0.78rem" }}
                                        onClick={() => printStudentResult(
                                            drawerData.student,
                                            drawerData.results,
                                            drawerData.overall
                                        )}
                                    >
                                        🖨️ Print
                                    </button>
                                )}
                                <button
                                    className="btn btn-danger"
                                    onClick={() => setDrawerOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        {/* ── Drawer body ── */}
                        <div style={{ padding:"1.25rem 1.5rem", flex:1 }}>

                            {/* Loading */}
                            {drawerLoading && (
                                <div style={{ textAlign:"center", padding:"3rem",
                                    color:"#6B7C78" }}>
                                    <p style={{ fontSize:"1.5rem" }}>⏳</p>
                                    <p style={{ fontSize:"0.875rem" }}>
                                        Loading result...
                                    </p>
                                </div>
                            )}

                            {/* Error */}
                            {drawerError && !drawerLoading && (
                                <div style={{ textAlign:"center", padding:"2rem",
                                    color:"#ef4444" }}>
                                    <p style={{ fontSize:"1.5rem" }}>⚠️</p>
                                    <p style={{ fontSize:"0.875rem" }}>{drawerError}</p>
                                </div>
                            )}

                            {/* Content */}
                            {drawerData && !drawerLoading && (
                                <>
                                    {/* ── Student header card ── */}
                                    <div style={{
                                        display:"flex", alignItems:"center", gap:"1rem",
                                        padding:"1rem 1.25rem", marginBottom:"1rem",
                                        background:"linear-gradient(135deg, #1e3a5f 0%, #1a4a6b 100%)",
                                        borderRadius:"0.5rem"
                                    }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width:"52px", height:"52px",
                                            borderRadius:"50%", background:"#3b82f6",
                                            flexShrink:0, display:"flex",
                                            alignItems:"center", justifyContent:"center",
                                            fontSize:"1.25rem",
                                            border:"3px solid rgba(255,255,255,0.2)",
                                            overflow:"hidden"
                                        }}>
                                            {drawerData.student.image
                                                ? <img src={drawerData.student.image}
                                                    alt={drawerData.student.name}
                                                    style={{ width:"100%", height:"100%",
                                                        objectFit:"cover" }} />
                                                : "🎓"
                                            }
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex:1 }}>
                                            <p style={{ fontWeight:700, fontSize:"1rem",
                                                color:"#fff", margin:0 }}>
                                                {drawerData.student.name}
                                            </p>
                                            <p style={{ fontSize:"0.78rem",
                                                color:"rgba(255,255,255,0.7)",
                                                margin:"0.2rem 0 0",
                                                fontFamily:"monospace" }}>
                                                {drawerData.student.rollNo}
                                            </p>
                                            <p style={{ fontSize:"0.75rem",
                                                color:"rgba(255,255,255,0.6)",
                                                margin:"0.2rem 0 0" }}>
                                                🎓 {drawerData.student.program}
                                            </p>
                                        </div>

                                        {/* Overall grade */}
                                        <div style={{ textAlign:"center", flexShrink:0 }}>
                                            <div style={{
                                                background:"rgba(255,255,255,0.15)",
                                                borderRadius:"0.5rem",
                                                padding:"0.625rem 1rem"
                                            }}>
                                                <p style={{ fontSize:"2rem", fontWeight:800,
                                                    color:"#fff", margin:0, lineHeight:1 }}>
                                                    {drawerData.overall.overallGrade}
                                                </p>
                                                <p style={{ fontSize:"0.65rem",
                                                    color:"rgba(255,255,255,0.7)",
                                                    margin:"0.25rem 0 0" }}>
                                                    Overall Grade
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Overall summary stats ── */}
                                    <div style={{ display:"flex", gap:"0.625rem",
                                        marginBottom:"1rem", flexWrap:"wrap" }}>
                                        {[
                                            { label:"Total Marks",  val: drawerData.overall.totalMarks,    color:"#1F2D2C" },
                                            { label:"Obtained",     val: drawerData.overall.totalObtained, color:"#3b82f6" },
                                            { label:"Percentage",   val:`${drawerData.overall.avgPct}%`,   color: pctColor(drawerData.overall.avgPct) },
                                            { label:"Passed",       val: drawerData.overall.passCount,     color:"#16a34a" },
                                            { label:"Failed",       val: drawerData.overall.failCount,     color: drawerData.overall.failCount > 0 ? "#ef4444" : "#16a34a" },
                                        ].map(item => (
                                            <div key={item.label} style={{
                                                flex:1, minWidth:"70px", textAlign:"center",
                                                padding:"0.625rem 0.5rem",
                                                background:"#f8fafc",
                                                borderRadius:"0.375rem"
                                            }}>
                                                <p style={{ fontWeight:700, fontSize:"1.1rem",
                                                    color:item.color, margin:0 }}>
                                                    {item.val}
                                                </p>
                                                <p style={{ fontSize:"0.65rem",
                                                    color:"#6B7C78", margin:0 }}>
                                                    {item.label}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── Overall result verdict ── */}
                                    {(() => {
                                        const ss = STANDING_STYLE[drawerData.overall.overallRemarks]
                                            || STANDING_STYLE["Satisfactory Performance"]
                                        return (
                                            <div style={{
                                                display:"flex", justifyContent:"space-between",
                                                alignItems:"center",
                                                padding:"0.75rem 1rem", marginBottom:"1rem",
                                                background:ss.bg, border:`1px solid ${ss.border}`,
                                                borderRadius:"0.375rem"
                                            }}>
                                                <div>
                                                    <p style={{ fontWeight:700, fontSize:"0.9rem",
                                                        color:ss.color, margin:0 }}>
                                                        {drawerData.overall.overallRemarks}
                                                    </p>
                                                    <p style={{ fontSize:"0.75rem",
                                                        color:ss.color, margin:"0.125rem 0 0",
                                                        opacity:0.85 }}>
                                                        {drawerData.overall.totalSubjects} subject(s) evaluated
                                                    </p>
                                                </div>
                                                <ResultStatusBadge
                                                    status={drawerData.overall.overallStatus}
                                                />
                                            </div>
                                        )
                                    })()}

                                    {/* ── Subject-wise results ── */}
                                    <p style={{ fontSize:"0.75rem", fontWeight:600,
                                        color:"#6B7C78", textTransform:"uppercase",
                                        letterSpacing:"0.04em", marginBottom:"0.75rem" }}>
                                        Subject-wise Results
                                    </p>

                                    <div style={{ display:"flex", flexDirection:"column",
                                        gap:"0.625rem" }}>
                                        {drawerData.results.map((r, i) => {
                                            const barPct = r.marksPercentage || 0
                                            const gs = GRADE_STYLE[r.grade] || GRADE_STYLE.F

                                            return (
                                                <div key={r._id || i} style={{
                                                    border:"1px solid #e2e8f0",
                                                    borderRadius:"0.5rem",
                                                    overflow:"hidden"
                                                }}>
                                                    {/* Subject header */}
                                                    <div style={{
                                                        display:"flex", justifyContent:"space-between",
                                                        alignItems:"center",
                                                        padding:"0.75rem 1rem",
                                                        background:"#fafafa",
                                                        borderBottom:"1px solid #f1f5f9"
                                                    }}>
                                                        <div>
                                                            <p style={{ fontWeight:600,
                                                                fontSize:"0.875rem",
                                                                color:"#1F2D2C", margin:0 }}>
                                                                {r.subjectName}
                                                            </p>
                                                            <p style={{ fontSize:"0.72rem",
                                                                color:"#6B7C78", margin:0,
                                                                fontFamily:"monospace" }}>
                                                                {r.subjectCode}
                                                                {r.creditHours &&
                                                                    ` · ${r.creditHours} cr hrs`
                                                                }
                                                                {r.session && ` · ${r.session}`}
                                                            </p>
                                                        </div>
                                                        <div style={{ display:"flex",
                                                            gap:"0.5rem", alignItems:"center" }}>
                                                            <span style={{
                                                                background:gs.bg,
                                                                border:`1px solid ${gs.border}`,
                                                                color:gs.color,
                                                                padding:"0.25rem 0.75rem",
                                                                borderRadius:"9999px",
                                                                fontSize:"0.875rem", fontWeight:700
                                                            }}>
                                                                {r.grade}
                                                            </span>
                                                            <ResultStatusBadge status={r.status} />
                                                        </div>
                                                    </div>

                                                    {/* Marks detail */}
                                                    <div style={{ padding:"0.75rem 1rem" }}>
                                                        <div style={{ display:"flex",
                                                            gap:"1rem", marginBottom:"0.625rem",
                                                            fontSize:"0.8rem", flexWrap:"wrap" }}>
                                                            <span>
                                                                Obtained:&nbsp;
                                                                <strong style={{ color: pctColor(barPct) }}>
                                                                    {r.obtainedMarks}
                                                                </strong>
                                                                <span style={{ color:"#9ca3af" }}>
                                                                    /{r.totalMarks}
                                                                </span>
                                                            </span>
                                                            <span>
                                                                Marks:&nbsp;
                                                                <strong style={{ color: pctColor(barPct) }}>
                                                                    {r.marksPercentage}%
                                                                </strong>
                                                            </span>
                                                            <span>
                                                                Attendance:&nbsp;
                                                                <strong style={{ color: r.attendancePercentage >= 75 ? "#16a34a" : "#ef4444" }}>
                                                                    {r.attendancePercentage}%
                                                                </strong>
                                                            </span>
                                                            {r.className && (
                                                                <span style={{ color:"#6B7C78" }}>
                                                                    {r.className} — {r.section}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Progress bar */}
                                                        <div style={{ background:"#e2e8f0",
                                                            borderRadius:"9999px", height:"6px" }}>
                                                            <div style={{
                                                                width:`${Math.min(barPct, 100)}%`,
                                                                height:"100%",
                                                                borderRadius:"9999px",
                                                                background: pctColor(barPct),
                                                                transition:"width 0.4s"
                                                            }} />
                                                        </div>

                                                        {/* Remarks + verified */}
                                                        <div style={{ display:"flex",
                                                            justifyContent:"space-between",
                                                            alignItems:"center",
                                                            marginTop:"0.5rem" }}>
                                                            {r.remarks ? (
                                                                <p style={{ fontSize:"0.72rem",
                                                                    color:"#6B7C78",
                                                                    fontStyle:"italic", margin:0 }}>
                                                                    📝 {r.remarks}
                                                                </p>
                                                            ) : (
                                                                <span />
                                                            )}
                                                            <div style={{ display:"flex",
                                                                gap:"0.375rem",
                                                                alignItems:"center" }}>
                                                                <VerifiedBadge
                                                                    verifiedBy={r.generatedBy}
                                                                />
                                                                {isSenior && !r.generatedBy && (
                                                                    <button
                                                                        className="btn btn-primary"
                                                                        style={{ fontSize:"0.68rem",
                                                                            padding:"0.2rem 0.5rem" }}
                                                                        onClick={() =>
                                                                            handleVerify(r._id)}
                                                                        disabled={verifying === r._id}
                                                                    >
                                                                        {verifying === r._id
                                                                            ? "..." : "✅ Verify"}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* ── Verification success notice ── */}
                                    {verifySuccess && (
                                        <div style={{
                                            marginTop:"1rem", padding:"0.75rem",
                                            background:"#f0fdf4",
                                            border:"1px solid #bbf7d0",
                                            borderRadius:"0.375rem",
                                            fontSize:"0.8rem", color:"#166534"
                                        }}>
                                            ✅ Result verified successfully.
                                        </div>
                                    )}

                                    {/* ── Print / admin note ── */}
                                    <div style={{
                                        marginTop:"1rem", padding:"0.75rem",
                                        background:"#eff6ff",
                                        border:"1px solid #bfdbfe",
                                        borderRadius:"0.375rem",
                                        fontSize:"0.78rem", color:"#1e40af"
                                    }}>
                                        ℹ️ Official result publication is managed by the
                                        administration. Teachers can review and verify only.
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}

        </div>
    )
}