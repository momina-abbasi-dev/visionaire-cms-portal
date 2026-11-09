// import { useState, useEffect } from "react"
// import { useNavigate }         from "react-router-dom"
// import { getTeacherOverview }  from "../../../services/dashboardService.js"

// // ── helpers ────────────────────────────────────────────────────────────────────

// const fmt     = (d) => d ? new Date(d).toLocaleDateString()  : "—"
// const timeAgo = (date) => {
//     const diff = Math.floor((Date.now() - new Date(date)) / 1000)
//     if (diff < 60)    return `${diff}s ago`
//     if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
//     if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
//     return `${Math.floor(diff / 86400)}d ago`
// }
// const greeting = () => {
//     const h = new Date().getHours()
//     return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"
// }
// const todayStr = () => new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })

// const alertStyle = {
//     danger:  { background:"#fef2f2", border:"1px solid #fecaca", color:"#991b1b" },
//     warning: { background:"#fffbeb", border:"1px solid #fde68a", color:"#92400e" },
//     info:    { background:"#eff6ff", border:"1px solid #bfdbfe", color:"#1e40af" },
// }

// const StatCard = ({ icon, label, value, sub, valueColor, urgent }) => (
//     <div className="card" style={{
//         display:"flex", flexDirection:"column", gap:"0.375rem", padding:"1rem",
//         border: urgent ? "1px solid #fecaca" : undefined,
//         background: urgent ? "#fef2f2" : undefined,
//     }}>
//         <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
//             <span style={{ fontSize:"1.25rem" }}>{icon}</span>
//             <span style={{ fontSize:"0.75rem", color:"#6B7C78", fontWeight:500 }}>{label}</span>
//         </div>
//         <p style={{ fontSize:"1.5rem", fontWeight:700, color: valueColor || "#1F2D2C", margin:0 }}>{value ?? "—"}</p>
//         {sub && <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>{sub}</p>}
//     </div>
// )

// // ── component ──────────────────────────────────────────────────────────────────

// export default function TeacherOverview() {
//     const navigate = useNavigate()

//     const [data,    setData]    = useState(null)
//     const [loading, setLoading] = useState(true)
//     const [error,   setError]   = useState(null)

//     useEffect(() => {
//         getTeacherOverview()
//             .then(r => setData(r.data))
//             .catch(e => { setError("Failed to load dashboard."); console.error(e) })
//             .finally(() => setLoading(false))
//     }, [])

//     if (loading) return (
//         <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
//             <p style={{ fontSize:"2rem" }}>⏳</p><p>Loading your dashboard...</p>
//         </div>
//     )
//     if (error) return <div style={{ padding:"2rem", color:"#ef4444" }}>{error}</div>

//     const { teacher, stats, classCards, assignedSubjects, pendingTasks, recentActivity } = data

//     // ── quick actions ──────────────────────────────────────────────────────────
//     const quickActions = [
//         { icon:"📅", label:"Mark Attendance", path:"/teacher/dashboard/attendance", color:"#3b82f6" },
//         { icon:"📝", label:"Enter Marks",     path:"/teacher/dashboard/marks",      color:"#8b5cf6" },
//         { icon:"👨‍🎓", label:"View Students", path:"/teacher/dashboard/students",   color:"#10b981" },
//         { icon:"🏫", label:"My Classes",      path:"/teacher/dashboard/classes",    color:"#f59e0b" },
//         { icon:"📄", label:"View Results",    path:"/teacher/dashboard/results",    color:"#ef4444" },
//         { icon:"📚", label:"My Subjects",     path:"/teacher/dashboard/subjects",   color:"#6366f1" },
//     ]

//     // ── render ─────────────────────────────────────────────────────────────────
//     return (
//         <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem", padding:"0.5rem" }}>

//             {/* ══════════════════════════════════════════════
//                 SECTION 1 — WELCOME HEADER
//             ══════════════════════════════════════════════ */}
//             <div className="card" style={{
//                 display:"flex", alignItems:"center", gap:"1.5rem",
//                 padding:"1.5rem", background:"linear-gradient(135deg, #1e3a5f 0%, #1a4a6b 100%)",
//                 borderRadius:"0.75rem", color:"#fff"
//             }}>
//                 {/* Avatar */}
//                 <div style={{
//                     width:"72px", height:"72px", borderRadius:"50%",
//                     background:"#3b82f6", display:"flex", alignItems:"center",
//                     justifyContent:"center", fontSize:"1.75rem", flexShrink:0,
//                     overflow:"hidden", border:"3px solid rgba(255,255,255,0.2)"
//                 }}>
//                     {teacher.image
//                         ? <img src={teacher.image} alt={teacher.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
//                         : "👨‍🏫"
//                     }
//                 </div>

//                 {/* Info */}
//                 <div style={{ flex:1 }}>
//                     <p style={{ fontSize:"0.75rem", color:"rgba(255,255,255,0.6)", margin:0, marginBottom:"0.25rem" }}>
//                         {greeting()}
//                     </p>
//                     <h1 style={{ fontSize:"1.5rem", fontWeight:700, margin:0 }}>{teacher.name}</h1>
//                     <div style={{ display:"flex", flexWrap:"wrap", gap:"1rem", marginTop:"0.5rem" }}>
//                         {[
//                             ["🎓", teacher.role === "senior" ? "Senior Teacher" : "Junior Teacher"],
//                             ["🏢", `${teacher.department || "—"} ${teacher.departmentCode ? `(${teacher.departmentCode})` : ""}`],
//                             ["🪪", teacher.registrationNo],
//                             ["📚", teacher.education],
//                         ].map(([icon, val]) => val?.trim() ? (
//                             <span key={icon} style={{ fontSize:"0.8rem", color:"rgba(255,255,255,0.8)", display:"flex", alignItems:"center", gap:"0.25rem" }}>
//                                 {icon} {val}
//                             </span>
//                         ) : null)}
//                     </div>
//                 </div>

//                 {/* Date + status */}
//                 <div style={{ textAlign:"right", flexShrink:0 }}>
//                     <span style={{
//                         background: teacher.status === "active" ? "#16a34a" : "#ef4444",
//                         color:"#fff", padding:"0.25rem 0.75rem",
//                         borderRadius:"9999px", fontSize:"0.75rem", fontWeight:600, textTransform:"capitalize"
//                     }}>
//                         {teacher.status}
//                     </span>
//                     <p style={{ fontSize:"0.7rem", color:"rgba(255,255,255,0.5)", marginTop:"0.5rem", marginBottom:0 }}>
//                         📅 {todayStr()}
//                     </p>
//                 </div>
//             </div>

//             {/* ══════════════════════════════════════════════
//                 SECTION 4 — PENDING TASKS (top, important)
//             ══════════════════════════════════════════════ */}
//             {pendingTasks?.length > 0 && (
//                 <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
//                     {pendingTasks.map((task, i) => {
//                         const s = alertStyle[task.level] || alertStyle.info
//                         return (
//                             <div key={i} style={{
//                                 display:"flex", alignItems:"center", gap:"0.625rem",
//                                 padding:"0.625rem 0.875rem", borderRadius:"0.375rem",
//                                 fontSize:"0.875rem", fontWeight:500,
//                                 border:s.border, background:s.background, color:s.color
//                             }}>
//                                 <span>{task.icon}</span>
//                                 <span style={{ flex:1 }}>{task.message}</span>
//                                 <button
//                                     onClick={() => {
//                                         if (task.type === "attendance") navigate("/teacher/attendance")
//                                         if (task.type === "marks")      navigate("/teacher/marks")
//                                         if (task.type === "results")    navigate("/teacher/results")
//                                     }}
//                                     style={{ fontSize:"0.75rem", background:"transparent", border:`1px solid ${s.color}`, borderRadius:"0.25rem", padding:"0.2rem 0.5rem", color:s.color, cursor:"pointer", fontWeight:600, whiteSpace:"nowrap" }}
//                                 >
//                                     Complete Now →
//                                 </button>
//                             </div>
//                         )
//                     })}
//                 </div>
//             )}

//             {/* ══════════════════════════════════════════════
//                 SECTION 2 — QUICK STATS CARDS
//             ══════════════════════════════════════════════ */}
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//                 <StatCard icon="🏫" label="Assigned Classes"  value={stats.assignedClasses}  sub="As class teacher"   valueColor="#3b82f6" />
//                 <StatCard icon="📚" label="Assigned Subjects" value={stats.assignedSubjects}  sub="Unique subjects"    valueColor="#8b5cf6" />
//                 <StatCard icon="👨‍🎓" label="Total Students"  value={stats.totalStudents}     sub="Across all classes" valueColor="#10b981" />
//                 <StatCard icon="📅" label="Attendance Pending" value={`${stats.attendancePending} class${stats.attendancePending !== 1 ? "es" : ""}`} sub="Today" valueColor={stats.attendancePending > 0 ? "#ef4444" : "#16a34a"} urgent={stats.attendancePending > 0} />
//                 <StatCard icon="📝" label="Marks Pending"     value={`~${stats.marksPending}`} sub="Students"          valueColor={stats.marksPending > 0 ? "#f59e0b" : "#16a34a"} />
//                 <StatCard icon="📄" label="Results Awaiting"  value={stats.resultsAwaiting}  sub="Classes"            valueColor={stats.resultsAwaiting > 0 ? "#f59e0b" : "#16a34a"} />
//             </div>

//             {/* ══════════════════════════════════════════════
//                 MAIN: LEFT (assigned work) + RIGHT (activity)
//             ══════════════════════════════════════════════ */}
//             <div style={{ display:"flex", gap:"1.25rem", alignItems:"flex-start" }}>

//                 {/* ── LEFT COLUMN ── */}
//                 <div style={{ flex:3, display:"flex", flexDirection:"column", gap:"1.25rem" }}>

//                     {/* ══════════════════════════════════════════════
//                         SECTION 5 — ASSIGNED CLASSES
//                     ══════════════════════════════════════════════ */}
//                     <div>
//                         <p style={{ fontWeight:600, fontSize:"0.875rem", marginBottom:"0.75rem", color:"#1F2D2C" }}>
//                             🏫 Assigned Classes
//                         </p>
//                         {classCards.length === 0 ? (
//                             <div className="card" style={{ padding:"1.5rem", textAlign:"center", color:"#6B7C78" }}>
//                                 <p style={{ fontSize:"1.5rem" }}>🏫</p>
//                                 <p style={{ fontSize:"0.875rem" }}>No classes assigned yet.</p>
//                             </div>
//                         ) : (
//                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                                 {classCards.map((cls) => (
//                                     <div key={cls._id} className="card" style={{ padding:"1rem", position:"relative" }}>
//                                         {/* Attendance indicator */}
//                                         <div style={{
//                                             position:"absolute", top:"0.75rem", right:"0.75rem",
//                                             fontSize:"0.7rem", fontWeight:600,
//                                             color: cls.attendanceToday ? "#16a34a" : "#ef4444",
//                                             background: cls.attendanceToday ? "#f0fdf4" : "#fef2f2",
//                                             border: `1px solid ${cls.attendanceToday ? "#bbf7d0" : "#fecaca"}`,
//                                             padding:"0.15rem 0.5rem", borderRadius:"9999px"
//                                         }}>
//                                             {cls.attendanceToday ? "✅ Attendance Done" : "⚠️ Pending"}
//                                         </div>

//                                         <p style={{ fontWeight:700, fontSize:"1rem", marginBottom:"0.25rem" }}>
//                                             {cls.name} — {cls.section}
//                                         </p>
//                                         <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:"0 0 0.75rem" }}>
//                                             {cls.program} · Semester {cls.semester}
//                                         </p>

//                                         <div style={{ display:"flex", flexDirection:"column", gap:"0.25rem", marginBottom:"0.75rem" }}>
//                                             <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.8rem" }}>
//                                                 <span style={{ color:"#6B7C78" }}>👨‍🎓 Students</span>
//                                                 <span style={{ fontWeight:600 }}>{cls.studentCount}</span>
//                                             </div>
//                                             <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.8rem" }}>
//                                                 <span style={{ color:"#6B7C78" }}>📚 Subjects</span>
//                                                 <span style={{ fontWeight:600 }}>{cls.subjects?.length || 0}</span>
//                                             </div>
//                                             {cls.subjects?.length > 0 && (
//                                                 <div style={{ marginTop:"0.25rem" }}>
//                                                     <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
//                                                         {cls.subjects.slice(0,3).map(s => (
//                                                             <span key={s._id} style={{ fontSize:"0.65rem", background:"#eff6ff", color:"#3b82f6", border:"1px solid #bfdbfe", padding:"0.1rem 0.4rem", borderRadius:"9999px" }}>
//                                                                 {s.code}
//                                                             </span>
//                                                         ))}
//                                                         {cls.subjects.length > 3 && (
//                                                             <span style={{ fontSize:"0.65rem", color:"#6B7C78" }}>+{cls.subjects.length - 3} more</span>
//                                                         )}
//                                                     </div>
//                                                 </div>
//                                             )}
//                                         </div>

//                                         <div style={{ display:"flex", gap:"0.375rem" }}>
//                                             <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.75rem" }} onClick={() => navigate(`/teacher/attendance?class=${cls._id}`)}>
//                                                 📅 Attendance
//                                             </button>
//                                             <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.75rem" }} onClick={() => navigate(`/teacher/marks?class=${cls._id}`)}>
//                                                 📝 Marks
//                                             </button>
//                                             <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.75rem" }} onClick={() => navigate(`/teacher/students?class=${cls._id}`)}>
//                                                 👨‍🎓 Students
//                                             </button>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </div>

//                     {/* ══════════════════════════════════════════════
//                         SECTION 6 — ASSIGNED SUBJECTS
//                     ══════════════════════════════════════════════ */}
//                     <div>
//                         <p style={{ fontWeight:600, fontSize:"0.875rem", marginBottom:"0.75rem", color:"#1F2D2C" }}>
//                             📚 Assigned Subjects
//                         </p>
//                         {assignedSubjects.length === 0 ? (
//                             <div className="card" style={{ padding:"1.5rem", textAlign:"center", color:"#6B7C78" }}>
//                                 <p style={{ fontSize:"1.5rem" }}>📚</p>
//                                 <p style={{ fontSize:"0.875rem" }}>No subjects assigned yet.</p>
//                             </div>
//                         ) : (
//                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//                                 {assignedSubjects.map((subj) => (
//                                     <div key={subj._id} className="card" style={{ padding:"1rem" }}>
//                                         <p style={{ fontWeight:700, fontSize:"0.95rem", marginBottom:"0.15rem" }}>{subj.name}</p>
//                                         <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:"0 0 0.75rem" }}>
//                                             {subj.code} · {subj.creditHours} credit hr{subj.creditHours !== 1 ? "s" : ""}
//                                         </p>

//                                         {/* Classes teaching this subject */}
//                                         {subj.classes?.length > 0 && (
//                                             <div style={{ marginBottom:"0.75rem" }}>
//                                                 <p style={{ fontSize:"0.7rem", color:"#6B7C78", marginBottom:"0.25rem", fontWeight:600 }}>CLASSES</p>
//                                                 <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
//                                                     {subj.classes.map(c => (
//                                                         <span key={c._id} style={{ fontSize:"0.7rem", background:"#f0fdf4", color:"#166534", border:"1px solid #bbf7d0", padding:"0.15rem 0.5rem", borderRadius:"9999px" }}>
//                                                             {c.name} — {c.section}
//                                                         </span>
//                                                     ))}
//                                                 </div>
//                                             </div>
//                                         )}

//                                         <div style={{ display:"flex", gap:"0.375rem" }}>
//                                             <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.75rem" }} onClick={() => navigate(`/teacher/marks?subject=${subj._id}`)}>
//                                                 📝 Enter Marks
//                                             </button>
//                                             <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.75rem" }} onClick={() => navigate(`/teacher/students?subject=${subj._id}`)}>
//                                                 👨‍🎓 Students
//                                             </button>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </div>

//                 </div>

//                 {/* ── RIGHT COLUMN ── */}
//                 <div style={{ flex:1, display:"flex", flexDirection:"column", gap:"1.25rem", minWidth:"220px" }}>

//                     {/* ══════════════════════════════════════════════
//                         SECTION 8 — QUICK ACTIONS
//                     ══════════════════════════════════════════════ */}
//                     <div className="card" style={{ padding:"1rem" }}>
//                         <p style={{ fontWeight:600, fontSize:"0.875rem", marginBottom:"0.75rem", color:"#1F2D2C" }}>
//                             ⚡ Quick Actions
//                         </p>
//                         <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
//                             {quickActions.map((action) => (
//                                 <button
//                                     key={action.label}
//                                     onClick={() => navigate(action.path)}
//                                     style={{
//                                         display:"flex", alignItems:"center", gap:"0.625rem",
//                                         padding:"0.625rem 0.75rem", borderRadius:"0.375rem",
//                                         border:`1px solid ${action.color}20`, background:`${action.color}08`,
//                                         cursor:"pointer", textAlign:"left",
//                                         fontSize:"0.875rem", fontWeight:500, color:"#1F2D2C"
//                                     }}
//                                     onMouseEnter={e => e.currentTarget.style.background = `${action.color}18`}
//                                     onMouseLeave={e => e.currentTarget.style.background = `${action.color}08`}
//                                 >
//                                     <span style={{ fontSize:"1.1rem" }}>{action.icon}</span>
//                                     <span>{action.label}</span>
//                                 </button>
//                             ))}
//                         </div>
//                     </div>

//                     {/* ══════════════════════════════════════════════
//                         SECTION 7 — RECENT ACTIVITY
//                     ══════════════════════════════════════════════ */}
//                     <div className="card" style={{ padding:"1rem" }}>
//                         <p style={{ fontWeight:600, fontSize:"0.875rem", marginBottom:"0.75rem", color:"#1F2D2C" }}>
//                             📋 Recent Activity
//                         </p>
//                         {recentActivity.length === 0 ? (
//                             <p style={{ color:"#6B7C78", fontSize:"0.875rem" }}>No recent activity.</p>
//                         ) : (
//                             <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
//                                 {recentActivity.map((item, i) => (
//                                     <div key={i} style={{
//                                         display:"flex", gap:"0.625rem",
//                                         padding:"0.625rem 0",
//                                         borderBottom: i < recentActivity.length - 1 ? "1px solid #f1f5f9" : "none"
//                                     }}>
//                                         <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
//                                             <span style={{ fontSize:"1rem", lineHeight:1 }}>{item.icon}</span>
//                                             {i < recentActivity.length - 1 && (
//                                                 <div style={{ width:"1px", flex:1, background:"#e2e8f0", marginTop:"0.25rem" }} />
//                                             )}
//                                         </div>
//                                         <div style={{ flex:1 }}>
//                                             <p style={{ fontSize:"0.8rem", fontWeight:500, color:"#1F2D2C", margin:0 }}>{item.message}</p>
//                                             {item.meta && <p style={{ fontSize:"0.7rem", color:"#6B7C78", margin:"0.125rem 0 0" }}>{item.meta}</p>}
//                                             <p style={{ fontSize:"0.7rem", color:"#9ca3af", margin:"0.125rem 0 0" }}>{timeAgo(item.time)}</p>
//                                         </div>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </div>

//                 </div>
//             </div>

//             {/* ══════════════════════════════════════════════
//                 SECTION 6 — QUICK ACCESS BUTTONS (bottom)
//             ══════════════════════════════════════════════ */}
//             <div>
//                 <p style={{ fontWeight:600, fontSize:"0.875rem", marginBottom:"0.75rem", color:"#1F2D2C" }}>⚡ Quick Access</p>
//                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
//                     {quickActions.map((item) => (
//                         <button
//                             key={item.label}
//                             onClick={() => navigate(item.path)}
//                             style={{
//                                 display:"flex", flexDirection:"column", alignItems:"center",
//                                 gap:"0.5rem", padding:"1rem 0.75rem",
//                                 background:`${item.color}10`, border:`1px solid ${item.color}30`,
//                                 borderRadius:"0.5rem", cursor:"pointer",
//                                 fontSize:"0.8rem", fontWeight:500, color:"#1F2D2C"
//                             }}
//                             onMouseEnter={e => { e.currentTarget.style.background=`${item.color}20`; e.currentTarget.style.transform="translateY(-2px)" }}
//                             onMouseLeave={e => { e.currentTarget.style.background=`${item.color}10`; e.currentTarget.style.transform="translateY(0)" }}
//                         >
//                             <span style={{ fontSize:"1.5rem" }}>{item.icon}</span>
//                             <span>{item.label}</span>
//                         </button>
//                     ))}
//                 </div>
//             </div>

//         </div>
//     )
// }

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx"
import { Panel } from "../../../components/ui/Panel.jsx"

import { getTeacherOverview } from "../../../services/dashboardService.js"

import {
    faChalkboard,
    faBook,
    faUserGraduate,
    faCalendarCheck,
    faPenToSquare,
    faFileCircleCheck,
    faTriangleExclamation,
    faCircleInfo,
    // faClipboardCheck,
    faUsers,
    faArrowRight,
    faGraduationCap,
    faSchool,
    // faListCheck,
} from "@fortawesome/free-solid-svg-icons"

import "./teacher.css"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

// ── helpers ────────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000)

    if (diff < 60) {
        return `${diff}s ago`
    }

    if (diff < 3600) {
        return `${Math.floor(diff / 60)}m ago`
    }

    if (diff < 86400) {
        return `${Math.floor(diff / 3600)}h ago`
    }

    return `${Math.floor(diff / 86400)}d ago`
}

const alertClassMap = {
    danger: "alert-error",
    warning: "alert-warning",
    info: "alert-info",
}

const getTaskIcon = (type) => {
    const icons = {
        attendance: faCalendarCheck,
        marks: faPenToSquare,
        results: faFileCircleCheck,
        default: faTriangleExclamation,
    }

    return icons[type] || icons.default
}

const getActivityIcon = (type) => {
    const icons = {
        attendance: faCalendarCheck,
        marks: faPenToSquare,
        result: faFileCircleCheck,
        student: faGraduationCap,
        class: faSchool,
        subject: faBook,
        default: faCircleInfo,
    }

    return icons[type] || icons.default
}

// ── component ──────────────────────────────────────────────────────────────────

export default function TeacherOverview() {
    const navigate = useNavigate()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await getTeacherOverview()
                setData(response.data)
            } catch (err) {
                setError("Failed to load dashboard.")
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchDashboard()
    }, [])

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="dashboard-loading-icon">
                    <FontAwesomeIcon icon={faCircleInfo} />
                </div>

                <p>Loading dashboard...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-state">
                <div className="error-state-icon">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                </div>

                <h2 className="error-state-title">
                    Unable to load dashboard
                </h2>

                <p className="error-state-description">
                    {error}
                </p>
            </div>
        )
    }

    const teacher = data?.teacher || {}
    const stats = data?.stats || {}
    const classCards = Array.isArray(data?.classCards) ? data.classCards : []
    const pendingTasks = Array.isArray(data?.pendingTasks) ? data.pendingTasks : []
    const recentActivity = Array.isArray(data?.recentActivity) ? data.recentActivity : []

    const quickActions = [
        {
            icon: faCalendarCheck,
            label: "Mark Attendance",
            path: "/teacher/dashboard/teacher-attendance",
        },
        {
            icon: faPenToSquare,
            label: "Enter Marks",
            path: "/teacher/dashboard/teacher-records",
        },
        {
            icon: faUserGraduate,
            label: "View Students",
            path: "/teacher/dashboard/teacher-students",
        },
        {
            icon: faChalkboard,
            label: "My Classes",
            path: "/teacher/dashboard/teacher-classes",
        },
    ]

    return (
        <div className="dashboard-page overview-dashboard teacher-overview">

            {/* ── HEADER ── */}

            <PageHeader
                title="Teacher Overview"
                description={teacher.name
                    ? `Welcome back, ${teacher.name}. Review your classes and teaching priorities.`
                    : "Review your classes and teaching priorities."}
            />

            {/* ── SUMMARY ── */}

            <div className="overview-kpi-grid">

                <SummaryCard
                    title="Assigned Classes"
                    value={stats.assignedClasses ?? "N/A"}
                    icon={faChalkboard}
                />

                <SummaryCard
                    title="Total Students"
                    value={stats.totalStudents ?? "N/A"}
                    icon={faUserGraduate}
                />

                <SummaryCard
                    title="Attendance Pending"
                    value={stats.attendancePending ?? "N/A"}
                    icon={faCalendarCheck}
                />

                <SummaryCard
                    title="Marks Pending"
                    value={stats.marksPending ?? "N/A"}
                    icon={faPenToSquare}
                />

            </div>

            {/* ── PENDING TASKS ── */}

            {pendingTasks?.length > 0 && (
                <details className="dashboard-alerts">
                    <summary className="dashboard-alerts-summary">

                        <div className="dashboard-alerts-title">

                            <span className="dashboard-alerts-icon">
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                            </span>

                            <span>
                                <strong>Pending Tasks</strong>

                                <small>
                                    {pendingTasks.length} task
                                    {pendingTasks.length !== 1 ? "s" : ""}
                                    {" "}require
                                    {pendingTasks.length === 1 ? "s" : ""}
                                    {" "}attention
                                </small>
                            </span>

                        </div>

                        <span className="dashboard-alerts-toggle">
                            View tasks
                        </span>

                    </summary>

                    <div className="dashboard-alerts-list">

                        {pendingTasks.map((task, index) => (
                            <div
                                key={index}
                                className={`alert ${
                                    alertClassMap[task.level] || "alert-info"
                                }`}
                            >
                                <FontAwesomeIcon
                                    icon={getTaskIcon(task.type)}
                                />

                                <span className="flex-1">
                                    {task.message}
                                </span>

                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        if (task.type === "attendance") {
                                            navigate("/teacher/dashboard/teacher-attendance")
                                        }

                                        if (task.type === "marks") {
                                            navigate("/teacher/dashboard/teacher-records")
                                        }

                                        if (task.type === "results") {
                                            navigate("/teacher/dashboard/teacher-results")
                                        }
                                    }}
                                >
                                    Complete Now
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </button>
                            </div>
                        ))}

                    </div>
                </details>
            )}

            {/* ── MAIN DASHBOARD ── */}

            <div className="dashboard-main-grid">

                {/* ── LEFT COLUMN ── */}

                <div className="dashboard-main-column">

                    {/* ASSIGNED CLASSES */}

                    <Panel title="Assigned Classes">

                        {classCards.length === 0 ? (
                            <p className="dashboard-empty">
                                No classes assigned yet.
                            </p>
                        ) : (
                            <div className="page-grid page-grid-3">

                                {classCards.map((cls) => (
                                    <div
                                        key={cls._id}
                                        className="card teacher-class-card"
                                    >

                                        <div className="teacher-class-card-header">

                                            <div>
                                                <h3 className="teacher-class-card-title">
                                                    {cls.name} — {cls.section}
                                                </h3>

                                                <p className="teacher-class-card-subtitle">
                                                    {cls.program} · Semester {cls.semester}
                                                </p>
                                            </div>

                                            <span
                                                className={
                                                    cls.attendanceToday == null
                                                        ? ""
                                                        : cls.attendanceToday
                                                            ? "status status-success"
                                                            : "status status-pending"
                                                }
                                            >
                                                {cls.attendanceToday == null
                                                    ? "N/A"
                                                    : cls.attendanceToday
                                                        ? "Attendance Done"
                                                        : "Attendance Pending"}
                                            </span>

                                        </div>

                                        <div className="teacher-class-card-stats">

                                            <div className="teacher-class-card-stat">
                                                <span>
                                                    <FontAwesomeIcon icon={faUsers} />
                                                    Students
                                                </span>

                                                <strong>
                                                    {cls.studentCount ?? "N/A"}
                                                </strong>
                                            </div>

                                        </div>

                                        {Array.isArray(cls.subjects) && cls.subjects.length > 0 && (
                                            <div className="teacher-class-subjects">

                                                <span className="teacher-class-subjects-label">
                                                    Subjects
                                                </span>

                                                <div className="teacher-class-subject-list">

                                                    {cls.subjects.slice(0, 3).map((subject) => (
                                                        <span
                                                            key={subject._id}
                                                            className="status status-info"
                                                        >
                                                            {subject.code}
                                                        </span>
                                                    ))}

                                                    {cls.subjects.length > 3 && (
                                                        <span className="teacher-class-subject-more">
                                                            +{cls.subjects.length - 3} more
                                                        </span>
                                                    )}

                                                </div>

                                            </div>
                                        )}

                                        <div className="teacher-card-actions">

                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() =>
                                                    navigate(
                                                        `/teacher/dashboard/teacher-attendance?class=${cls._id}`
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faCalendarCheck}
                                                />
                                                Attendance
                                            </button>

                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() =>
                                                    navigate(
                                                        `/teacher/dashboard/teacher-records?class=${cls._id}`
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faPenToSquare}
                                                />
                                                Marks
                                            </button>

                                            <button
                                                className="btn btn-secondary"
                                                onClick={() =>
                                                    navigate(
                                                        `/teacher/dashboard/teacher-students?class=${cls._id}`
                                                    )
                                                }
                                            >
                                                <FontAwesomeIcon
                                                    icon={faUserGraduate}
                                                />
                                                Students
                                            </button>

                                        </div>

                                    </div>
                                ))}

                            </div>
                        )}

                    </Panel>

                </div>

                {/* ── RIGHT COLUMN ── */}

                <div className="dashboard-side-column">

                    {/* QUICK ACTIONS */}

                    <Panel title="Quick Access">

                        <div className="quick-actions">

                            {quickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    className="quick-action"
                                    onClick={() => navigate(action.path)}
                                >
                                    <span className="quick-action-icon">
                                        <FontAwesomeIcon icon={action.icon} />
                                    </span>

                                    <span className="quick-action-label">
                                        {action.label}
                                    </span>

                                    <span className="quick-action-arrow">
                                        <FontAwesomeIcon icon={faArrowRight} />
                                    </span>
                                </button>
                            ))}

                        </div>

                    </Panel>

                    {/* RECENT ACTIVITY */}

                    <Panel title="Recent Activity">

                        {recentActivity.length === 0 ? (
                            <p className="dashboard-empty">
                                Recent teaching activity will appear here.
                            </p>
                        ) : (
                            <div className="activity-feed">

                                {recentActivity.slice(0, 3).map((item, index) => (
                                    <div
                                        key={index}
                                        className="activity-item"
                                    >

                                        <div className="activity-icon-wrapper">
                                            <FontAwesomeIcon
                                                icon={getActivityIcon(item.type)}
                                            />
                                        </div>

                                        <div className="activity-content">

                                            <p className="activity-message">
                                                {item.message}
                                            </p>

                                            {item.meta && (
                                                <p className="activity-meta">
                                                    {item.meta}
                                                </p>
                                            )}

                                            <p className="activity-meta">
                                                {timeAgo(item.time)}
                                            </p>

                                        </div>

                                    </div>
                                ))}

                            </div>
                        )}

                    </Panel>

                </div>

            </div>

        </div>
    )
}