import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard as SharedSummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import {
  getTeacherStudents,
  getStudentProfileForTeacher,
} from "../../../services/teacherStudentsService.js";

// ── style maps ─────────────────────────────────────────────────────────────────

const ACADEMIC_STATUS_CLASS = {
  Excellent: "status-success",
  Good: "status-info",
  Average: "status-neutral",
  "Needs Attention": "status-error",
  "In Progress": "status-pending",
  "No Records": "status-neutral",
};

const GRADE_STATUS_CLASS = {
  A: "status-success",
  B: "status-info",
  C: "status-warning",
  D: "status-warning",
  F: "status-error",
};

// ── helpers ────────────────────────────────────────────────────────────────────

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const attColor = (pct) =>
  pct == null
    ? "#6B7C78"
    : pct >= 75
      ? "#16a34a"
      : pct >= 60
        ? "#f59e0b"
        : "#ef4444";

const attLabel = (pct) =>
  pct == null ? "N/A" : pct >= 75 ? "Good" : pct >= 60 ? "Low" : "Critical";

// ── reusable mini components ───────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, urgent }) => (
  <SharedSummaryCard
    title={label}
    value={value ?? "—"}
    supporting={sub}
    variant={urgent ? "warning" : "default"}
  />
);

const AcademicBadge = ({ status }) => {
  const className = ACADEMIC_STATUS_CLASS[status] || "status-neutral";
  return <span className={`status ${className}`}>{status}</span>;
};

const GradeBadge = ({ grade }) => {
  if (!grade) return <span className="status status-neutral">—</span>;
  const className = GRADE_STATUS_CLASS[grade] || "status-neutral";
  return <span className={`status ${className}`}>{grade}</span>;
};

const AttBadge = ({ pct }) => (
  <span
    style={{
      fontWeight: 700,
      fontSize: "0.875rem",
      color: attColor(pct),
    }}
  >
    {pct != null ? `${pct}%` : "N/A"}
  </span>
);

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function TeacherStudents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── list state ─────────────────────────────────────────────────────────────
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── filters ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState(searchParams.get("class") || "All");
  const [subjectId, setSubjectId] = useState(
    searchParams.get("subject") || "All",
  );
  const [attStatus, setAttStatus] = useState("All");
  const [page, setPage] = useState(1);

  // ── drawer: list view ──────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [drawerTab, setDrawerTab] = useState("profile");

  // ── fetch list ─────────────────────────────────────────────────────────────

  const fetchStudents = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (classId !== "All") params.classId = classId;
    if (subjectId !== "All") params.subjectId = subjectId;
    if (attStatus !== "All") params.attStatus = attStatus;

    getTeacherStudents(params)
      .then((r) => setData(r.data))
      .catch((e) => {
        setError("Failed to load students.");
        console.error(e);
      })
      .finally(() => setLoading(false));
  }, [search, classId, subjectId, attStatus, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ── reset page on filter change ────────────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [search, classId, subjectId, attStatus]);

  // ── open student profile drawer ────────────────────────────────────────────

  const openProfile = (student) => {
    setDrawerOpen(true);
    setDrawerTab("profile");
    setDrawerError(null);
    setProfile(null);
    setDrawerLoading(true);

    getStudentProfileForTeacher(student._id)
      .then((r) => setProfile(r.data))
      .catch((e) =>
        setDrawerError(e.response?.data?.message || "Failed to load profile."),
      )
      .finally(() => setDrawerLoading(false));
  };

  // ── loading / error ────────────────────────────────────────────────────────

  if (loading && !data)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          flexDirection: "column",
          gap: "1rem",
          color: "#6B7C78",
        }}
      >
        <p style={{ fontSize: "2rem" }}>⏳</p>
        <p>Loading students...</p>
      </div>
    );
  if (error && !data)
    return <div style={{ padding: "2rem", color: "#ef4444" }}>{error}</div>;

  const { stats, students, pagination, classes, subjects } = data || {};

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page teacher-page">
      {/* ══════════════════════════════════════════════
                HEADER
            ══════════════════════════════════════════════ */}
      <PageHeader
        title="Students"
        description="View students currently enrolled in classes and sessions assigned to you."
        action={<button className="btn btn-secondary" onClick={fetchStudents}>Refresh</button>}
      />

      {/* ══════════════════════════════════════════════
                SUMMARY CARDS
            ══════════════════════════════════════════════ */}
      {stats && (
        <div className="summary-card-grid">
          <SummaryCard
            icon="👨‍🎓"
            label="Total Students"
            value={stats.totalStudents}
            sub="Currently enrolled"
            valueColor="#3b82f6"
          />
          <SummaryCard
            icon="🏫"
            label="Classes"
            value={stats.totalClasses}
            sub="Assigned to you"
            valueColor="#8b5cf6"
          />
          <SummaryCard
            icon="📚"
            label="Subjects"
            value={stats.totalSubjects}
            sub="You teach"
            valueColor="#10b981"
          />
          <SummaryCard
            icon="📅"
            label="Att. Pending"
            value={stats.attendancePending}
            sub="Classes today"
            valueColor={stats.attendancePending > 0 ? "#ef4444" : "#16a34a"}
            urgent={stats.attendancePending > 0}
          />
          <SummaryCard
            icon="📝"
            label="Marks Pending"
            sub="Students"
            value={stats.marksPending ?? "N/A"}
            valueColor={stats.marksPending == null
              ? "#6B7C78"
              : stats.marksPending > 0 ? "#f59e0b" : "#16a34a"}
            urgent={stats.marksPending != null && stats.marksPending > 0}
          />
          <SummaryCard
            icon="📄"
            label="Results Pending"
            sub="Classes"
            value={stats.resultsPending ?? "N/A"}
            valueColor={stats.resultsPending == null
              ? "#6B7C78"
              : stats.resultsPending > 0 ? "#92400e" : "#16a34a"}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════
                SEARCH & FILTERS
            ══════════════════════════════════════════════ */}
      <SearchFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by student name or roll number..."
        filters={[
          {
            id: "class",
            label: "Class:",
            value: classId,
            onChange: setClassId,
            options: [
              { value: "All", label: "All Classes" },
              ...(classes || []).map((c) => ({
                value: c._id,
                label: `${c.name} — ${c.section}`,
              })),
            ],
          },
          {
            id: "subject",
            label: "Subject:",
            value: subjectId,
            onChange: setSubjectId,
            options: [
              { value: "All", label: "All Subjects" },
              ...(subjects || []).map((s) => ({
                value: s._id,
                label: s.name,
              })),
            ],
          },
          {
            id: "attendance",
            label: "Attendance:",
            value: attStatus,
            onChange: setAttStatus,
            options: [
              { value: "All", label: "All" },
              { value: "good", label: "Good (≥75%)" },
              { value: "low", label: "Low (<75%)" },
            ],
          },
        ]}
        onReset={search || classId !== "All" || subjectId !== "All" || attStatus !== "All"
          ? () => {
              setSearch("");
              setClassId("All");
              setSubjectId("All");
              setAttStatus("All");
            }
          : undefined}
      />

      {/* ══════════════════════════════════════════════
                STUDENTS TABLE
            ══════════════════════════════════════════════ */}
      {(students || []).length === 0 && !loading ? (
        <div
          className="card"
          style={{ padding: "3rem", textAlign: "center", color: "#6B7C78" }}
        >
          <p style={{ fontSize: "2.5rem" }}>👨‍🎓</p>
          <p style={{ fontWeight: 600, marginTop: "0.5rem" }}>
            {search || classId !== "All" || subjectId !== "All" || attStatus !== "All"
              ? "No Students Match Your Filters"
              : "No Enrolled Students Available"}
          </p>
          <p style={{ fontSize: "0.875rem" }}>
            {search || classId !== "All" || subjectId !== "All" || attStatus !== "All"
              ? "Try adjusting your search or filters."
              : "Currently enrolled students in your active class and session assignments appear here."}
          </p>
        </div>
      ) : (
        <Panel title={`Students (${pagination?.total || 0})`}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No.</th>
                  <th>Program</th>
                  <th style={{ textAlign: "center" }}>Attendance</th>
                  <th style={{ textAlign: "center" }}>Att. Status</th>
                  <th style={{ textAlign: "center" }}>Grade</th>
                  <th>Academic Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(students || []).map((stu) => (
                  <tr key={stu._id}>
                    {/* Student name + avatar */}
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.625rem",
                        }}
                      >
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: "#3b82f6",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.875rem",
                            overflow: "hidden",
                          }}
                        >
                          {stu.image ? (
                            <img
                              src={stu.image}
                              alt={stu.name}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            "🎓"
                          )}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                          {stu.name}
                        </span>
                      </div>
                    </td>

                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        color: "#6B7C78",
                      }}
                    >
                      {stu.rollNo}
                    </td>

                    <td style={{ fontSize: "0.8rem", color: "#6B7C78" }}>
                      {stu.program || "—"}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <AttBadge pct={stu.attPct} />
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: attColor(stu.attPct),
                          background:
                            stu.attPct == null
                              ? "#f8fafc"
                              : stu.attPct >= 75
                                ? "#f0fdf4"
                                : stu.attPct >= 60
                                  ? "#fffbeb"
                                  : "#fef2f2",
                          border: `1px solid ${
                            stu.attPct == null
                              ? "#e2e8f0"
                              : stu.attPct >= 75
                                ? "#bbf7d0"
                                : stu.attPct >= 60
                                  ? "#fde68a"
                                  : "#fecaca"
                          }`,
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                        }}
                      >
                        {attLabel(stu.attPct)}
                      </span>
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <GradeBadge grade={stu.latestGrade} />
                    </td>

                    <td>
                      <AcademicBadge status={stu.academicStatus} />
                    </td>

                    {/* Action buttons */}
                    <td>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.25rem 0.5rem",
                          }}
                          onClick={() => openProfile(stu)}
                          title="View Profile"
                        >
                          👁
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.25rem 0.5rem",
                          }}
                          onClick={() =>
                            navigate(`/teacher/attendance?student=${stu._id}`)
                          }
                          title="Attendance"
                        >
                          📅
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.25rem 0.5rem",
                          }}
                          onClick={() =>
                            navigate(`/teacher/marks?student=${stu._id}`)
                          }
                          title="Enter Marks"
                        >
                          📝
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.7rem",
                            padding: "0.25rem 0.5rem",
                          }}
                          onClick={() =>
                            navigate(`/teacher/results?student=${stu._id}`)
                          }
                          title="Results"
                        >
                          📄
                        </button>
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
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages}
                &nbsp;({pagination.total} students)
              </span>
              <button
                className="btn btn-secondary"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </Panel>
      )}

      {/* ══════════════════════════════════════════════
                            STUDENT PROFILE DRAWER
                        ══════════════════════════════════════════════ */}
      <Drawer
        isOpen={drawerOpen}
        title={
          profile
            ? `${profile.student.name} — ${profile.student.rollNo}`
            : "Student Profile"
        }
        onClose={() => setDrawerOpen(false)}
        width="560px"
        footer={
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {profile && (
              <>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem" }}
                  onClick={() =>
                    navigate(
                      `/teacher/attendance?student=${profile.student._id}`,
                    )
                  }
                >
                  📅 Attendance
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem" }}
                  onClick={() =>
                    navigate(`/teacher/marks?student=${profile.student._id}`)
                  }
                >
                  📝 Marks
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: "0.8rem" }}
                  onClick={() =>
                    navigate(`/teacher/results?student=${profile.student._id}`)
                  }
                >
                  📄 Results
                </button>
              </>
            )}
            <button
              className="btn btn-danger"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>
        }
      >
        {/* ── drawer loading ── */}
        {drawerLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              flexDirection: "column",
              gap: "1rem",
              color: "#6B7C78",
            }}
          >
            <p style={{ fontSize: "1.5rem" }}>⏳</p>
            <p style={{ fontSize: "0.875rem" }}>Loading student profile...</p>
          </div>
        )}

        {/* ── drawer error ── */}
        {drawerError && !drawerLoading && (
          <div
            style={{ padding: "1.5rem", textAlign: "center", color: "#ef4444" }}
          >
            <p style={{ fontSize: "1.5rem" }}>⚠️</p>
            <p style={{ fontSize: "0.875rem" }}>{drawerError}</p>
          </div>
        )}

        {/* ── drawer content ── */}
        {profile && !drawerLoading && (
          <>
            {/* Student header card */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                marginBottom: "0.5rem",
                background: "linear-gradient(135deg, #1e3a5f 0%, #1a4a6b 100%)",
                borderRadius: "0.5rem",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#3b82f6",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.5rem",
                  border: "3px solid rgba(255,255,255,0.2)",
                  overflow: "hidden",
                }}
              >
                {profile.student.image ? (
                  <img
                    src={profile.student.image}
                    alt={profile.student.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "🎓"
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <p
                  style={{
                    fontWeight: 700,
                    fontSize: "1rem",
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  {profile.student.name}
                </p>
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "rgba(255,255,255,0.7)",
                    margin: "0.2rem 0 0",
                    fontFamily: "monospace",
                  }}
                >
                  {profile.student.rollNo}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.6)",
                    margin: "0.2rem 0 0",
                  }}
                >
                  🎓 {profile.student.program}
                </p>
              </div>

              {/* Status */}
              <span
                style={{
                  background:
                    profile.student.status === "active" ? "#16a34a" : "#ef4444",
                  color: "#fff",
                  padding: "0.2rem 0.625rem",
                  borderRadius: "9999px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  textTransform: "capitalize",
                  flexShrink: 0,
                }}
              >
                {profile.student.status}
              </span>
            </div>

            {/* Tabs */}
            <Tabs
              tabs={[
                { id: "profile", label: "Profile" },
                { id: "subjects", label: "Subjects" },
                { id: "activity", label: "Recent Activity" },
                { id: "actions", label: "Quick Actions" },
              ]}
              activeTab={drawerTab}
              onChange={setDrawerTab}
            />

            {/* ── TAB: PROFILE ── */}
            {drawerTab === "profile" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                {/* Personal info */}
                <Panel title="Personal Information">
                  <div className="detail-grid">
                    {[
                      ["Name", profile.student.name],
                      ["Email", profile.student.email],
                      ["Contact", profile.student.contact],
                      ["Program", profile.student.program],
                      ["Admitted", fmt(profile.student.dateOfAdmission)],
                    ].map(([label, val]) => (
                      <div key={label} className="detail-row">
                        <span className="detail-label">{label}</span>
                        <span className="detail-value">{val ?? "—"}</span>
                      </div>
                    ))}
                    <div className="detail-row">
                      <span className="detail-label">Fee Status</span>
                      <span
                        style={{
                          fontWeight: 600,
                          textTransform: "capitalize",
                          color:
                            profile.student.feeStatus === "paid"
                              ? "#16a34a"
                              : profile.student.feeStatus === "partial"
                                ? "#f59e0b"
                                : "#ef4444",
                        }}
                      >
                        {profile.student.feeStatus || "—"}
                      </span>
                    </div>
                  </div>
                </Panel>

                {/* Attendance summary */}
                <Panel title="Attendance Summary">
                  {/* Big percentage */}
                  <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                    <p
                      style={{
                        fontSize: "2.5rem",
                        fontWeight: 800,
                        margin: 0,
                        color: attColor(profile.attendance.attPct),
                      }}
                    >
                      {profile.attendance.attPct != null
                        ? `${profile.attendance.attPct}%`
                        : "N/A"}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#6B7C78",
                        margin: 0,
                      }}
                    >
                      Overall Attendance
                    </p>
                  </div>

                  {/* Progress bar */}
                  {profile.attendance.attPct != null && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div
                        style={{
                          background: "#e2e8f0",
                          borderRadius: "9999px",
                          height: "8px",
                          position: "relative",
                        }}
                      >
                        {/* 75% threshold marker */}
                        <div
                          style={{
                            position: "absolute",
                            left: "75%",
                            top: "-3px",
                            width: "2px",
                            height: "14px",
                            background: "#f59e0b",
                            borderRadius: "1px",
                            zIndex: 1,
                          }}
                        />
                        <div
                          style={{
                            width: `${Math.min(profile.attendance.attPct, 100)}%`,
                            height: "100%",
                            borderRadius: "9999px",
                            background: attColor(profile.attendance.attPct),
                            transition: "width 0.5s",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          fontSize: "0.65rem",
                          color: "#f59e0b",
                          margin: "0.2rem 0 0",
                          textAlign: "right",
                        }}
                      >
                        ▲ 75% min required
                      </p>
                    </div>
                  )}

                  {/* Stat boxes */}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {[
                      {
                        label: "Present",
                        val: profile.attendance.presentAtt,
                        color: "#16a34a",
                      },
                      {
                        label: "Late",
                        val: profile.attendance.lateAtt,
                        color: "#f59e0b",
                      },
                      {
                        label: "Absent",
                        val: profile.attendance.absentAtt,
                        color: "#ef4444",
                      },
                      {
                        label: "Total",
                        val: profile.attendance.totalAtt,
                        color: "#6B7C78",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          padding: "0.5rem 0.25rem",
                          background: "#f8fafc",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: "1.1rem",
                            color: item.color,
                            margin: 0,
                          }}
                        >
                          {item.val}
                        </p>
                        <p
                          style={{
                            fontSize: "0.65rem",
                            color: "#6B7C78",
                            margin: 0,
                          }}
                        >
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Eligibility verdict */}
                  <div
                    style={{
                      marginTop: "0.75rem",
                      padding: "0.5rem 0.875rem",
                      borderRadius: "0.375rem",
                      textAlign: "center",
                      background: profile.attendance.attPct == null
                      ? "#f8fafc"
                      : profile.attendance.attPct >= 75 ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${
                      profile.attendance.attPct == null
                        ? "#e2e8f0"
                        : profile.attendance.attPct >= 75 ? "#bbf7d0" : "#fecaca"
                      }`,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: profile.attendance.attPct == null
                          ? "#6B7C78"
                          : profile.attendance.attPct >= 75 ? "#166534" : "#991b1b",
                      }}
                    >
                      {profile.attendance.attPct == null
                        ? "N/A — attendance data unavailable"
                        : profile.attendance.attPct >= 75
                          ? "✅ Eligible for exams"
                          : `❌ ${75 - profile.attendance.attPct}% more needed for eligibility`}
                    </p>
                  </div>
                </Panel>

                {/* Academic summary */}
                <Panel title="Academic Summary">
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {[
                      {
                        icon: "📝",
                        label: "Records",
                        val: profile.academic.totalRecords,
                        color: "#8b5cf6",
                      },
                      {
                        icon: "📊",
                        label: "Avg Marks",
                        val:
                          profile.academic.avgMarks != null
                            ? `${profile.academic.avgMarks}`
                            : "N/A",
                        color: "#3b82f6",
                      },
                      {
                        icon: "🏆",
                        label: "Grade",
                        val: profile.academic.latestGrade || "N/A",
                        color: "#10b981",
                      },
                      {
                        icon: "📄",
                        label: "Result",
                        val: profile.academic.latestStatus || "N/A",
                        color:
                          profile.academic.latestStatus === "pass"
                            ? "#16a34a"
                            : "#ef4444",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          flex: 1,
                          minWidth: "70px",
                          textAlign: "center",
                          padding: "0.625rem 0.5rem",
                          background: "#f8fafc",
                          borderRadius: "0.375rem",
                        }}
                      >
                        <p style={{ fontSize: "0.875rem", margin: 0 }}>
                          {item.icon}
                        </p>
                        <p
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            color: item.color,
                            margin: "0.2rem 0 0",
                            textTransform: "capitalize",
                          }}
                        >
                          {item.val}
                        </p>
                        <p
                          style={{
                            fontSize: "0.65rem",
                            color: "#6B7C78",
                            margin: 0,
                          }}
                        >
                          {item.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {profile.academic.latestSubject && (
                    <div style={{ fontSize: "0.8rem", color: "#6B7C78" }}>
                      Latest result:{" "}
                      <strong style={{ color: "#1F2D2C" }}>
                        {profile.academic.latestSubject}
                      </strong>
                      {profile.academic.latestSession &&
                        ` · ${profile.academic.latestSession}`}
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {/* ── TAB: ENROLLED SUBJECTS ── */}
            {drawerTab === "subjects" && (
              <Panel title="Teacher's Assigned Subjects">
                {profile.enrolledSubjects.length === 0 ? (
                  <p style={{ color: "#6B7C78", fontSize: "0.875rem" }}>
                    No subjects are assigned to your teacher profile.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {profile.enrolledSubjects.map((subj) => (
                      <div
                        key={subj._id}
                        style={{
                          padding: "0.875rem 1rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.375rem",
                          background: "#fafafa",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <div>
                            <p
                              style={{
                                fontWeight: 600,
                                fontSize: "0.875rem",
                                margin: 0,
                              }}
                            >
                              {subj.name}
                            </p>
                            <p
                              style={{
                                fontSize: "0.75rem",
                                color: "#6B7C78",
                                margin: "0.125rem 0 0",
                                fontFamily: "monospace",
                              }}
                            >
                              {subj.code}
                              {subj.creditHours &&
                                ` · ${subj.creditHours} cr hr${subj.creditHours !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <span
                            style={{
                              background: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            🧑‍🏫 You
                          </span>
                        </div>

                        {/* Classes teaching this subject */}
                        {subj.classes?.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.25rem",
                            }}
                          >
                            {subj.classes.map((cls, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: "0.7rem",
                                  background: "#eff6ff",
                                  color: "#1e40af",
                                  border: "1px solid #bfdbfe",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "9999px",
                                }}
                              >
                                {cls}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* ── TAB: RECENT ACTIVITY ── */}
            {drawerTab === "activity" && (
              <Panel title="Recent Activity">
                {profile.recentActivity.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem",
                      color: "#6B7C78",
                    }}
                  >
                    <p style={{ fontSize: "1.5rem" }}>📋</p>
                    <p style={{ fontSize: "0.875rem" }}>
                      No recent activity for this student.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 0 }}
                  >
                    {profile.recentActivity.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: "0.625rem",
                          padding: "0.75rem 0",
                          borderBottom:
                            i < profile.recentActivity.length - 1
                              ? "1px solid #f1f5f9"
                              : "none",
                        }}
                      >
                        {/* Timeline */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: "1rem", lineHeight: 1 }}>
                            {item.icon}
                          </span>
                          {i < profile.recentActivity.length - 1 && (
                            <div
                              style={{
                                width: "1px",
                                flex: 1,
                                background: "#e2e8f0",
                                marginTop: "0.25rem",
                              }}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              fontSize: "0.8rem",
                              fontWeight: 500,
                              color: "#1F2D2C",
                              margin: 0,
                            }}
                          >
                            {item.message}
                          </p>
                          {item.meta && (
                            <p
                              style={{
                                fontSize: "0.72rem",
                                color: "#6B7C78",
                                margin: "0.125rem 0 0",
                              }}
                            >
                              {item.meta}
                            </p>
                          )}
                          <p
                            style={{
                              fontSize: "0.7rem",
                              color: "#9ca3af",
                              margin: "0.125rem 0 0",
                            }}
                          >
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.625rem",
                  }}
                >
                  {[
                    {
                      icon: "📅",
                      label: "Mark Attendance",
                      sub: `Record attendance for ${profile.student.name}`,
                      path: `/teacher/attendance?student=${profile.student._id}`,
                      color: "#10b981",
                    },
                    {
                      icon: "📝",
                      label: "Enter Marks",
                      sub: `Add quiz, midterm, or final marks`,
                      path: `/teacher/marks?student=${profile.student._id}`,
                      color: "#8b5cf6",
                    },
                    {
                      icon: "📊",
                      label: "View Academic Records",
                      sub: `${profile.academic.totalRecords} record(s) submitted`,
                      path: `/teacher/records?student=${profile.student._id}`,
                      color: "#f59e0b",
                    },
                    {
                      icon: "📄",
                      label: "View Results",
                      sub: profile.academic.latestGrade
                        ? `Latest grade: ${profile.academic.latestGrade} — ${profile.academic.latestStatus}`
                        : "No results published yet",
                      path: `/teacher/results?student=${profile.student._id}`,
                      color: "#ef4444",
                    },
                  ].map((action) => (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.875rem 1rem",
                        background: `${action.color}08`,
                        border: `1px solid ${action.color}20`,
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = `${action.color}15`)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = `${action.color}08`)
                      }
                    >
                      <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>
                        {action.icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: "#1F2D2C",
                            margin: 0,
                          }}
                        >
                          {action.label}
                        </p>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#6B7C78",
                            margin: 0,
                          }}
                        >
                          {action.sub}
                        </p>
                      </div>
                      <span style={{ color: "#6B7C78", flexShrink: 0 }}>→</span>
                    </button>
                  ))}
                </div>

                {/* Read-only notice */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.75rem",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "0.375rem",
                    fontSize: "0.78rem",
                    color: "#1e40af",
                  }}
                >
                  ℹ️ Student enrollment, program, and department changes are
                  managed by the admin only.
                </div>
              </Panel>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
