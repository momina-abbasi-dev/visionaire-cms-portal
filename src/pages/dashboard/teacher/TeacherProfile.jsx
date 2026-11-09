import { useState, useEffect } from "react"
import { useNavigate }         from "react-router-dom"
import { Tabs }   from "../../../components/ui/Tabs.jsx"
import { Panel }  from "../../../components/ui/Panel.jsx"
import { PageHeader } from "../../../components/ui/PageHeader.jsx"
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx"
import {
    getTeacherProfile,
    updateTeacherProfile,
    changeTeacherPassword,
} from "../../../services/teacherProfileService.js"

// ── helpers ────────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-US", { day:"2-digit", month:"long", year:"numeric" }) : "—"

const Row = ({ label, value, mono, badge }) => (
    <div className="detail-row">
        <span className="detail-label">{label}</span>
        {badge
            ? badge
            : <span className="detail-value" style={mono ? { fontFamily:"monospace", letterSpacing:"0.03em" } : {}}>{value ?? "—"}</span>
        }
    </div>
)

const StatCard = ({ label, value, sub }) => (
    <SharedSummaryCard title={label} value={value ?? "—"} supporting={sub} />
)

// ── component ──────────────────────────────────────────────────────────────────
export default function TeacherProfile() {
    const navigate = useNavigate()

    const [data,        setData]        = useState(null)
    const [loading,     setLoading]     = useState(true)
    const [error,       setError]       = useState(null)
    const [activeTab,   setActiveTab]   = useState("personal")

    // ── edit ───────────────────────────────────────────────────────────────────
    const [isEditing,   setIsEditing]   = useState(false)
    const [editForm,    setEditForm]    = useState({ contact:"", address:"", city:"" })
    const [editSaving,  setEditSaving]  = useState(false)
    const [editError,   setEditError]   = useState(null)
    const [editSuccess, setEditSuccess] = useState(false)

    // ── password ───────────────────────────────────────────────────────────────
    const [pwForm,      setPwForm]      = useState({ currentPassword:"", newPassword:"", confirmPassword:"" })
    const [pwSaving,    setPwSaving]    = useState(false)
    const [pwError,     setPwError]     = useState(null)
    const [pwSuccess,   setPwSuccess]   = useState(false)
    const [showPw,      setShowPw]      = useState({ current:false, new:false, confirm:false })

    // ── fetch ──────────────────────────────────────────────────────────────────
    const fetchProfile = async () => {
        setLoading(true); setError(null)
        try {
            const r = await getTeacherProfile()
            setData(r.data)
            setEditForm({
                contact: r.data.teacher.contact || "",
                address: r.data.teacher.address || "",
                city:    r.data.teacher.city    || "",
            })
        } catch (e) { setError("Failed to load profile."); console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchProfile() }, [])

    // ── save edit ──────────────────────────────────────────────────────────────
    const handleSaveEdit = async () => {
        setEditSaving(true); setEditError(null); setEditSuccess(false)
        try {
            await updateTeacherProfile(editForm)
            setEditSuccess(true); setIsEditing(false)
            fetchProfile()
            setTimeout(() => setEditSuccess(false), 3000)
        } catch (err) { setEditError(err.response?.data?.message || "Failed to update.") }
        finally { setEditSaving(false) }
    }

    // ── change password ────────────────────────────────────────────────────────
    const handleChangePassword = async (e) => {
        e.preventDefault(); setPwSaving(true); setPwError(null); setPwSuccess(false)
        try {
            await changeTeacherPassword(pwForm)
            setPwSuccess(true)
            setPwForm({ currentPassword:"", newPassword:"", confirmPassword:"" })
            setTimeout(() => setPwSuccess(false), 4000)
        } catch (err) { setPwError(err.response?.data?.message || "Failed to change password.") }
        finally { setPwSaving(false) }
    }

    // ── loading / error ────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh", flexDirection:"column", gap:"1rem", color:"#6B7C78" }}>
            <p style={{ fontSize:"2rem" }}>⏳</p><p>Loading profile...</p>
        </div>
    )
    if (error) return <div style={{ padding:"2rem", color:"#ef4444" }}>{error}</div>

    const { teacher, account, stats, classCards, assignedSubjects } = data
    const roleLabel = teacher.role === "senior" ? "Senior Teacher" : "Junior Teacher"

    return (
        <div className="dashboard-page admin-page teacher-page">
            <PageHeader title="Teacher Profile" description="Manage your personal, professional, and account details." />

            {/* ══════════════════════════════════════════════
                PROFILE HEADER
            ══════════════════════════════════════════════ */}
            <div style={{ borderRadius:"0.75rem", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}>
                {/* Banner */}
                <div style={{
                    height:"48px",
                    background:"var(--color-primary)"
                }} />

                {/* Content */}
                <div className="card" style={{
                    borderTopLeftRadius:0, borderTopRightRadius:0,
                    padding:"0 1.5rem 1.25rem",
                    display:"flex", alignItems:"flex-end", gap:"1.5rem", flexWrap:"wrap"
                }}>
                    {/* Avatar */}
                    <div style={{
                        width:"72px", height:"72px", borderRadius:"50%",
                        border:"4px solid #fff", overflow:"hidden",
                        background:"#1e3a5f", display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:"1.75rem",
                        flexShrink:0, marginTop:"-36px",
                        boxShadow:"0 2px 8px rgba(0,0,0,0.15)"
                    }}>
                        {teacher.image
                            ? <img src={teacher.image} alt={teacher.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                            : "👨‍🏫"
                        }
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, paddingBottom:"0.25rem" }}>
                        <h1 style={{ fontSize:"1.35rem", fontWeight:700, margin:"0 0 0.25rem", color:"#1F2D2C" }}>
                            {teacher.name}
                        </h1>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.75rem" }}>
                            {[
                                ["🎓", roleLabel],
                                ["🪪", `EMP: ${teacher.registrationNo}`],
                                ["🏢", teacher.department ? `${teacher.department}${teacher.departmentCode ? ` (${teacher.departmentCode})` : ""}` : null],
                                ["📅", `Joined: ${fmt(teacher.createdAt)}`],
                            ].map(([icon, val]) => val ? (
                                <span key={icon} style={{ fontSize:"0.8rem", color:"#6B7C78", display:"flex", alignItems:"center", gap:"0.25rem" }}>
                                    {icon} {val}
                                </span>
                            ) : null)}
                        </div>
                    </div>

                    {/* Status badges */}
                    <div style={{ display:"flex", gap:"0.5rem", alignItems:"center", paddingBottom:"0.25rem" }}>
                        <span className={`status ${teacher.status === "active" ? "status-active" : "status-suspended"}`}>
                            {teacher.status}
                        </span>
                        <span className={`status ${teacher.role === "senior" ? "status-info" : "status-neutral"}`}>
                            {roleLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════
                QUICK SUMMARY CARDS
            ══════════════════════════════════════════════ */}
            <div className="summary-card-grid">
                <StatCard icon="🏫" label="Classes"          value={stats.assignedClasses}  sub="Assigned as class teacher" valueColor="#3b82f6" />
                <StatCard icon="📚" label="Subjects"         value={stats.assignedSubjects} sub="Unique subjects"           valueColor="#8b5cf6" />
                <StatCard icon="👨‍🎓" label="Students"       value={stats.totalStudents}    sub="Across all classes"        valueColor="#10b981" />
                <StatCard icon="📅" label="Years of Service" value={stats.yearsOfService > 0 ? `${stats.yearsOfService} yr${stats.yearsOfService !== 1 ? "s" : ""}` : "< 1 yr"} sub={`Since ${new Date(teacher.createdAt).getFullYear()}`} valueColor="#f59e0b" />
            </div>

            {/* ══════════════════════════════════════════════
                TABS
            ══════════════════════════════════════════════ */}
            <Tabs
                tabs={[
                    { id:"personal",     label:"👤 Personal"     },
                    { id:"professional", label:"💼 Professional"  },
                    { id:"teaching",     label:"📚 Teaching"      },
                    { id:"documents",    label:"📂 Documents"     },
                    { id:"security",     label:"🔒 Security"      },
                ]}
                activeTab={activeTab}
                onChange={(t) => { setActiveTab(t); setIsEditing(false); setEditError(null) }}
            />

            {/* ══════════════════════════════════════════════
                TAB: PERSONAL
            ══════════════════════════════════════════════ */}
            {activeTab === "personal" && (
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-start" }}>

                    <Panel
                        title="Personal Information"
                        style={{ flex:2, minWidth:"280px" }}
                        actions={
                            !isEditing ? (
                                <button className="btn btn-secondary" onClick={() => { setIsEditing(true); setEditError(null) }}>
                                    ✏️ Edit
                                </button>
                            ) : (
                                <div style={{ display:"flex", gap:"0.5rem" }}>
                                    <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                                    <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                                        {editSaving ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            )
                        }
                    >
                        {editError   && <p style={{ color:"#ef4444",  fontSize:"0.875rem", marginBottom:"0.75rem" }}>{editError}</p>}
                        {editSuccess  && <p style={{ color:"#16a34a", fontSize:"0.875rem", marginBottom:"0.75rem" }}>✅ Profile updated.</p>}

                        {/* Read-only */}
                        <div style={{ marginBottom:"1rem" }}>
                            <p style={{ fontSize:"0.7rem", fontWeight:600, color:"#6B7C78", marginBottom:"0.5rem" }}>BASIC INFO</p>
                            <div className="detail-grid">
                                <Row label="Full Name"     value={teacher.name}  />
                                <Row label="Email"         value={teacher.email} />
                                <Row label="CNIC"          value={teacher.cnic}  mono />
                                <Row label="Date of Birth" value={fmt(teacher.dob)} />
                            </div>
                        </div>

                        {/* Editable */}
                        <div>
                            <p style={{ fontSize:"0.7rem", fontWeight:600, color:"#6B7C78", marginBottom:"0.5rem" }}>
                                CONTACT & ADDRESS
                                {!isEditing && <span style={{ marginLeft:"0.5rem", color:"#3b82f6", fontWeight:400 }}>(editable)</span>}
                            </p>
                            {!isEditing ? (
                                <div className="detail-grid">
                                    <Row label="Contact" value={teacher.contact} />
                                    <Row label="Address" value={teacher.address} />
                                    <Row label="City"    value={teacher.city}    />
                                </div>
                            ) : (
                                <div>
                                    {[
                                        { name:"contact", label:"Contact Number" },
                                        { name:"address", label:"Address"        },
                                        { name:"city",    label:"City"           },
                                    ].map(f => (
                                        <div key={f.name} className="form-group">
                                            <label className="form-label">{f.label}</label>
                                            <input className="form-input" name={f.name} value={editForm[f.name]}
                                                onChange={e => setEditForm({ ...editForm, [e.target.name]: e.target.value })} />
                                        </div>
                                    ))}
                                    <p style={{ fontSize:"0.75rem", color:"#6B7C78", marginTop:"0.5rem" }}>
                                        ℹ️ Only contact, address, and city can be updated. Contact admin for other changes.
                                    </p>
                                </div>
                            )}
                        </div>
                    </Panel>

                    {/* Account Info */}
                    <Panel title="Account Information" style={{ flex:1, minWidth:"220px" }}>
                        <div className="detail-grid">
                            <Row label="Email"  value={account.email} />
                            <Row label="Role"   value={account.role.charAt(0).toUpperCase() + account.role.slice(1)} />
                            <Row label="Status" badge={
                                <span className={account.status === "active" ? "status-active" : "status-suspended"} style={{ textTransform:"capitalize" }}>
                                    {account.status}
                                </span>
                            } />
                            <Row label="Member Since" value={fmt(account.createdAt)} />
                        </div>
                    </Panel>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: PROFESSIONAL
            ══════════════════════════════════════════════ */}
            {activeTab === "professional" && (
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-start" }}>

                    <Panel title="Professional Information" style={{ flex:2, minWidth:"280px" }}>
                        <div style={{ marginBottom:"0.5rem", padding:"0.75rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"0.375rem", fontSize:"0.8rem", color:"#1e40af" }}>
                            ℹ️ Professional details are managed by the institution and cannot be edited by teachers.
                        </div>
                        <div className="detail-grid" style={{ marginTop:"1rem" }}>
                            <Row label="Full Name"         value={teacher.name}                               />
                            <Row label="Registration No."  value={teacher.registrationNo}             mono   />
                            <Row label="Department"        value={teacher.department}                         />
                            <Row label="Department Code"   value={teacher.departmentCode}                     />
                            <Row label="Teacher Role"      badge={
                                <span style={{
                                    background: teacher.role === "senior" ? "#eff6ff" : "#faf5ff",
                                    color: teacher.role === "senior" ? "#1e40af" : "#6b21a8",
                                    border:`1px solid ${teacher.role === "senior" ? "#bfdbfe" : "#e9d5ff"}`,
                                    padding:"0.2rem 0.625rem", borderRadius:"9999px",
                                    fontSize:"0.8rem", fontWeight:600
                                }}>
                                    {roleLabel}
                                </span>
                            } />
                            <Row label="Employment Status" badge={
                                <span className={teacher.status === "active" ? "status-active" : "status-suspended"}>
                                    {teacher.status}
                                </span>
                            } />
                            <Row label="Joining Date"      value={fmt(teacher.createdAt)}                     />
                            <Row label="Years of Service"  value={stats.yearsOfService > 0 ? `${stats.yearsOfService} year(s)` : "Less than 1 year"} />
                            <Row label="Education"         value={teacher.education}                          />
                        </div>
                    </Panel>

                    {/* Qualifications card */}
                    <Panel title="Qualifications" style={{ flex:1, minWidth:"220px" }}>
                        <div style={{ textAlign:"center", padding:"1rem", background:"#f8fafc", borderRadius:"0.5rem", marginBottom:"1rem" }}>
                            <p style={{ fontSize:"2rem", margin:0 }}>🎓</p>
                            <p style={{ fontWeight:700, fontSize:"0.95rem", margin:"0.5rem 0 0.25rem", color:"#1F2D2C" }}>{teacher.education}</p>
                            <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>Highest Qualification</p>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                            <div style={{ padding:"0.625rem 0.75rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"0.375rem" }}>
                                <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>Department</p>
                                <p style={{ fontSize:"0.875rem", fontWeight:600, color:"#1e40af", margin:"0.125rem 0 0" }}>{teacher.department || "—"}</p>
                            </div>
                            <div style={{ padding:"0.625rem 0.75rem", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"0.375rem" }}>
                                <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:0 }}>Years Active</p>
                                <p style={{ fontSize:"0.875rem", fontWeight:600, color:"#16a34a", margin:"0.125rem 0 0" }}>
                                    {stats.yearsOfService > 0 ? `${stats.yearsOfService} year(s)` : "< 1 year"}
                                </p>
                            </div>
                        </div>
                    </Panel>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: TEACHING ASSIGNMENTS
            ══════════════════════════════════════════════ */}
            {activeTab === "teaching" && (
                <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

                    {/* Assigned Subjects */}
                    <Panel title="📚 Assigned Subjects">
                        {assignedSubjects.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>📚</p>
                                <p style={{ fontSize:"0.875rem" }}>No subjects assigned yet.</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Subject</th>
                                            <th>Code</th>
                                            <th style={{ textAlign:"center" }}>Credit Hours</th>
                                            <th>Assigned Classes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignedSubjects.map(s => (
                                            <tr key={s._id}>
                                                <td style={{ fontWeight:500 }}>{s.name}</td>
                                                <td style={{ fontFamily:"monospace", fontSize:"0.8rem", color:"#6B7C78" }}>{s.code}</td>
                                                <td style={{ textAlign:"center" }}>{s.creditHours}</td>
                                                <td>
                                                    <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                                                        {s.classes.map((c, i) => (
                                                            <span key={i} style={{ fontSize:"0.72rem", background:"#eff6ff", color:"#1e40af", border:"1px solid #bfdbfe", padding:"0.1rem 0.5rem", borderRadius:"9999px" }}>
                                                                {c}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    {/* Assigned Classes */}
                    <Panel title="🏫 Assigned Classes">
                        {classCards.length === 0 ? (
                            <div style={{ textAlign:"center", padding:"2rem", color:"#6B7C78" }}>
                                <p style={{ fontSize:"1.5rem" }}>🏫</p>
                                <p style={{ fontSize:"0.875rem" }}>No classes assigned yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {classCards.map(cls => (
                                    <div key={cls._id} className="card" style={{ padding:"1rem" }}>
                                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.625rem" }}>
                                            <div>
                                                <p style={{ fontWeight:700, fontSize:"1rem", margin:0 }}>{cls.name} — {cls.section}</p>
                                                <p style={{ fontSize:"0.75rem", color:"#6B7C78", margin:"0.125rem 0 0" }}>{cls.program} · Sem {cls.semester}</p>
                                            </div>
                                            <span style={{ background:"#eff6ff", color:"#1e40af", border:"1px solid #bfdbfe", padding:"0.15rem 0.5rem", borderRadius:"9999px", fontSize:"0.72rem", fontWeight:600 }}>
                                                Sem {cls.semester}
                                            </span>
                                        </div>
                                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.8rem", marginBottom:"0.625rem" }}>
                                            <span style={{ color:"#6B7C78" }}>👨‍🎓 Students</span>
                                            <span style={{ fontWeight:600 }}>{cls.studentCount}</span>
                                        </div>
                                        {cls.subjects?.length > 0 && (
                                            <div style={{ marginBottom:"0.75rem" }}>
                                                <p style={{ fontSize:"0.68rem", color:"#6B7C78", fontWeight:600, margin:"0 0 0.25rem" }}>SUBJECTS</p>
                                                <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
                                                    {cls.subjects.map(s => (
                                                        <span key={s._id} style={{ fontSize:"0.68rem", background:"#f0fdf4", color:"#166534", border:"1px solid #bbf7d0", padding:"0.1rem 0.4rem", borderRadius:"9999px" }}>
                                                            {s.code}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ display:"flex", gap:"0.375rem" }}>
                                            <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem" }} onClick={() => navigate(`/teacher/students?class=${cls._id}`)}>
                                                👨‍🎓 Students
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex:1, fontSize:"0.72rem" }} onClick={() => navigate(`/teacher/attendance?class=${cls._id}`)}>
                                                📅 Attendance
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                    {/* Admin note */}
                    <div style={{ padding:"0.75rem 1rem", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:"0.375rem", fontSize:"0.8rem", color:"#92400e" }}>
                        ℹ️ Class and subject assignments are managed by the administration. Contact admin to update your teaching assignments.
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                TAB: DOCUMENTS
            ══════════════════════════════════════════════ */}
            {activeTab === "documents" && (
                <Panel title="Education & Professional Documents">
                    <p style={{ fontSize:"0.8rem", color:"#6B7C78", marginBottom:"1rem" }}>
                        Documents submitted during your onboarding. Contact admin to add or update documents.
                    </p>

                    {teacher.educationDocuments?.length > 0 ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                            {teacher.educationDocuments.map((doc, i) => (
                                <div key={i} style={{
                                    display:"flex", justifyContent:"space-between", alignItems:"center",
                                    padding:"0.875rem 1rem",
                                    border:"1px solid #e2e8f0", borderRadius:"0.375rem",
                                    background:"#fafafa"
                                }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                                        <span style={{ fontSize:"1.5rem" }}>📄</span>
                                        <div>
                                            <p style={{ fontWeight:500, fontSize:"0.875rem", margin:0 }}>{doc.name}</p>
                                            <p style={{ fontSize:"0.7rem", color:"#6B7C78", margin:"0.125rem 0 0" }}>
                                                Official document
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display:"flex", gap:"0.375rem" }}>
                                        {doc.fileUrl && (
                                            <>
                                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                                    className="btn btn-secondary" style={{ fontSize:"0.75rem" }}>
                                                    👁 View
                                                </a>
                                                <a href={doc.fileUrl} download
                                                    className="btn btn-secondary" style={{ fontSize:"0.75rem" }}>
                                                    ⬇️ Download
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign:"center", padding:"3rem", color:"#6B7C78" }}>
                            <p style={{ fontSize:"2.5rem" }}>📂</p>
                            <p style={{ fontWeight:600, marginTop:"0.5rem" }}>No Documents Uploaded</p>
                            <p style={{ fontSize:"0.875rem" }}>Contact admin to upload your professional documents.</p>
                        </div>
                    )}
                </Panel>
            )}

            {/* ══════════════════════════════════════════════
                TAB: SECURITY
            ══════════════════════════════════════════════ */}
            {activeTab === "security" && (
                <div style={{ display:"flex", gap:"1rem", flexWrap:"wrap", alignItems:"flex-start" }}>

                    {/* Change Password */}
                    <Panel title="Change Password" style={{ flex:1, minWidth:"280px" }}>
                        <form onSubmit={handleChangePassword}>
                            {pwError   && <p style={{ color:"#ef4444", fontSize:"0.875rem", marginBottom:"0.75rem" }}>{pwError}</p>}
                            {pwSuccess  && <p style={{ color:"#16a34a", fontSize:"0.875rem", marginBottom:"0.75rem" }}>✅ Password changed successfully.</p>}

                            {[
                                { name:"currentPassword", label:"Current Password", key:"current" },
                                { name:"newPassword",     label:"New Password",     key:"new"     },
                                { name:"confirmPassword", label:"Confirm Password", key:"confirm" },
                            ].map(f => (
                                <div key={f.name} className="form-group">
                                    <label className="form-label">{f.label}</label>
                                    <div style={{ position:"relative" }}>
                                        <input
                                            className="form-input"
                                            type={showPw[f.key] ? "text" : "password"}
                                            name={f.name}
                                            value={pwForm[f.name]}
                                            onChange={e => setPwForm({ ...pwForm, [e.target.name]: e.target.value })}
                                            required
                                            style={{ paddingRight:"2.5rem" }}
                                        />
                                        <button type="button"
                                            onClick={() => setShowPw(p => ({ ...p, [f.key]: !p[f.key] }))}
                                            style={{ position:"absolute", right:"0.625rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#6B7C78" }}>
                                            {showPw[f.key] ? "🙈" : "👁"}
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <ul style={{ fontSize:"0.75rem", color:"#6B7C78", marginBottom:"1rem", paddingLeft:"1.25rem" }}>
                                <li>Minimum 6 characters</li>
                                <li>New password must match confirmation</li>
                            </ul>

                            <button type="submit" className="btn btn-primary" disabled={pwSaving} style={{ width:"100%" }}>
                                {pwSaving ? "Changing..." : "🔒 Change Password"}
                            </button>
                        </form>
                    </Panel>

                    {/* Account security info */}
                    <Panel title="Account Security" style={{ flex:1, minWidth:"220px" }}>
                        <div className="detail-grid">
                            <Row label="Role"    value={roleLabel} />
                            <Row label="Status"  badge={<span className={account.status === "active" ? "status-active" : "status-suspended"}>{account.status}</span>} />
                            <Row label="Email"   value={account.email} />
                            <Row label="Account Created" value={fmt(account.createdAt)} />
                        </div>

                        <div style={{ marginTop:"1rem", padding:"0.75rem", background:"#f8fafc", borderRadius:"0.375rem", fontSize:"0.78rem", color:"#6B7C78" }}>
                            <p style={{ fontWeight:600, color:"#1F2D2C", marginBottom:"0.5rem" }}>🛡️ Security Tips</p>
                            <ul style={{ paddingLeft:"1.25rem", display:"flex", flexDirection:"column", gap:"0.25rem" }}>
                                <li>Use a strong, unique password</li>
                                <li>Never share your credentials</li>
                                <li>Change password periodically</li>
                                <li>Log out from shared devices</li>
                            </ul>
                        </div>

                        {account.status === "suspended" && (
                            <div style={{ marginTop:"1rem", padding:"0.75rem", background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"0.375rem", fontSize:"0.8rem", color:"#991b1b" }}>
                                ⚠️ Your account is suspended. Contact admin for assistance.
                            </div>
                        )}
                    </Panel>
                </div>
            )}

        </div>
    )
}
