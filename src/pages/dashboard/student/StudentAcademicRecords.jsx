import { useState, useEffect } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";

import { getStudentAcademicRecords } from "../../../services/studentAcademicService.js";
import "./student-pages.css";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GRADE_COLORS = {
  A: {
    bg: "#EAF4EC",
    border: "#BFDCC5",
    text: "#356B40",
  },
  B: {
    bg: "#EAF2F7",
    border: "#C2D8E5",
    text: "#3D6379",
  },
  C: {
    bg: "#FFF6E3",
    border: "#E8D39A",
    text: "#80621F",
  },
  D: {
    bg: "#FFF6E3",
    border: "#E8D39A",
    text: "#80621F",
  },
  F: {
    bg: "#FBEDEC",
    border: "#E5C1BE",
    text: "#8F3F3B",
  },
};

const EXAM_ORDER = ["quiz", "assignment", "practical", "midterm", "final"];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pctColor = (percentage) => {
  if (percentage == null) return "#7A8783";

  if (percentage >= 80) return "#4F8A5B";
  if (percentage >= 60) return "#56809A";
  if (percentage >= 50) return "#B58A32";

  return "#B85C58";
};

const formatExamType = (value) => {
  if (!value) return "—";

  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const gradeBadge = (grade) => {
  const statusClass =
    grade === "A"
      ? "status-success"
      : grade === "B"
        ? "status-info"
        : grade === "C" || grade === "D"
          ? "status-warning"
          : grade === "F"
            ? "status-error"
            : "status-neutral";

  return (
    <span className={`status ${statusClass}`}>
      {grade || "—"}
    </span>
  );
};

const statusBadge = (status) => {
  if (!status) return "—";

  return (
    <span
      className={`status student-academic-record-status ${
        status === "pass" ? "status-success" : "status-error"
      }`}
    >
      {status}
    </span>
  );
};

const fmtNumber = (value) => {
  if (value == null || value === "") return "—";

  const number = Number(value);

  return Number.isNaN(number) ? value : number.toLocaleString();
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentAcademicRecords() {
  // ── data ──────────────────────────────────────────────────────────────────

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── session ───────────────────────────────────────────────────────────────

  const [activeSession, setActiveSession] = useState(null);

  // ── filters ───────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // ── drawer ────────────────────────────────────────────────────────────────

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH RECORDS
  // ─────────────────────────────────────────────────────────────────────────

  const fetchAcademicRecords = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getStudentAcademicRecords();

      const result = response.data;

      setData(result);

      if (result.sessions?.length > 0) {
        setActiveSession(result.sessions[result.sessions.length - 1].session);
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error("Error loading academic records:", err);

      setError(
        err.response?.data?.message || "Failed to load academic records.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcademicRecords();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-icon">Loading</div>

        <p>Loading academic records...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state-icon">!</div>

        <h2 className="error-state-title">Unable to load academic records</h2>

        <p className="error-state-description">{error}</p>

        <button
          className="btn btn-primary student-academic-records-retry"
          onClick={fetchAcademicRecords}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA
  // ─────────────────────────────────────────────────────────────────────────

  const { sessions = [], overall = {} } = data || {};

  const currentSession = sessions.find(
    (session) => session.session === activeSession,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // FILTER CURRENT SESSION
  // ─────────────────────────────────────────────────────────────────────────

  const filteredSubjects = (currentSession?.subjects || []).filter(
    (subject) => {
      const query = search.trim().toLowerCase();

      if (query) {
        const matchesName = subject.subjectName?.toLowerCase().includes(query);

        const matchesCode = subject.subjectCode?.toLowerCase().includes(query);

        if (!matchesName && !matchesCode) {
          return false;
        }
      }

      if (gradeFilter !== "All" && subject.result?.grade !== gradeFilter) {
        return false;
      }

      if (statusFilter !== "All" && subject.result?.status !== statusFilter) {
        return false;
      }

      return true;
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // PERFORMANCE DATA
  // ─────────────────────────────────────────────────────────────────────────

  const subjectsWithResults = (currentSession?.subjects || []).filter(
    (subject) => subject.result,
  );

  const topSubjects = [...subjectsWithResults]
    .sort((a, b) => b.result.marksPercentage - a.result.marksPercentage)
    .slice(0, 3);

  const weakSubjects = [...subjectsWithResults]
    .sort((a, b) => a.result.marksPercentage - b.result.marksPercentage)
    .slice(0, 3);

  // ─────────────────────────────────────────────────────────────────────────
  // ACADEMIC STANDING
  // ─────────────────────────────────────────────────────────────────────────

  const standingClass = {
    "Good Standing": "status-success",
    Satisfactory: "status-info",
    "Academic Warning": "status-warning",
    "Academic Probation": "status-error",
  }[overall.standing] || "status-neutral";

  // ─────────────────────────────────────────────────────────────────────────
  // RESET FILTERS
  // ─────────────────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setSearch("");
    setGradeFilter("All");
    setStatusFilter("All");
  };

  const hasActiveFilters =
    search || gradeFilter !== "All" || statusFilter !== "All";

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN SUBJECT DRAWER
  // ─────────────────────────────────────────────────────────────────────────

  const openSubjectDrawer = (subject) => {
    setSelectedSubject(subject);
    setIsDrawerOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page student-academic-records-page">
      {/* ═══════════════════════════════════════════════════════════════
                PAGE HEADER
            ═══════════════════════════════════════════════════════════════ */}

      <PageHeader
        title="Academic Records"
        description="Review subject marks, grades, and academic progress."
      />

      {/* ═══════════════════════════════════════════════════════════════
                SESSION SELECTOR
            ═══════════════════════════════════════════════════════════════ */}

      {sessions.length > 0 && (
        <Panel
          title="Academic Sessions"
          description="Select a session to view your academic records."
        >
          <div className="student-academic-records-session-list">
            {sessions.map((session) => (
              <button
                key={session.session}
                className={
                  activeSession === session.session
                    ? "btn btn-primary"
                    : "btn btn-secondary"
                }
                onClick={() => {
                  setActiveSession(session.session);
                  clearFilters();
                }}
              >
                {session.session}

                <span className="student-academic-records-session-count">
                  ({session.subjects?.length || 0})
                </span>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {/* ═══════════════════════════════════════════════════════════════
                NO RECORDS
            ═══════════════════════════════════════════════════════════════ */}

      {sessions.length === 0 && (
        <Panel title="Academic Records">
          <div className="empty-state student-academic-records-empty">
            <div className="student-academic-records-empty-icon">
              📚
            </div>

            <h3 className="student-academic-records-empty-title">
              No Academic Records Yet
            </h3>

            <p className="student-academic-records-empty-description">
              Your teacher-submitted marks will appear here once they are
              verified and published.
            </p>
          </div>
        </Panel>
      )}

      {sessions.length > 0 && (
        <>
          {/* ═══════════════════════════════════════════════════════
                        SEARCH & FILTERS
                    ═══════════════════════════════════════════════════════ */}

          <div className="student-academic-records-filters">
            <SearchFilters
              searchValue={search}
              onSearchChange={setSearch}
              filters={[
                {
                  label: "Grade:",
                  value: gradeFilter,
                  onChange: setGradeFilter,
                  options: ["All", "A", "B", "C", "D", "F"],
                },

                {
                  label: "Status:",
                  value: statusFilter,
                  onChange: setStatusFilter,
                  options: ["All", "pass", "fail"],
                },
              ]}
              onReset={hasActiveFilters ? clearFilters : undefined}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════
                        MAIN ACADEMIC RECORDS TABLE
                    ═══════════════════════════════════════════════════════ */}

          <Panel
            title={`Academic Records — ${activeSession || ""}`}
            description="Detailed marks, grades, results, and subject information."
          >
            {filteredSubjects.length === 0 ? (
              <div className="empty-state student-academic-records-empty student-academic-records-empty-filtered">
                <div className="student-academic-records-empty-icon">
                  🔍
                </div>

                <h3 className="student-academic-records-empty-title">
                  No Records Found
                </h3>

                <p className="student-academic-records-empty-description">
                  No academic records match your current search and filters.
                </p>

                {hasActiveFilters && (
                  <button
                    className="btn btn-secondary student-academic-records-clear-filters"
                    onClick={clearFilters}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    key: "subjectName",
                    label: "Subject",
                  },

                  {
                    key: "subjectCode",
                    label: "Code",
                    render: (value) => (
                      <span className="student-academic-records-code">
                        {value || "—"}
                      </span>
                    ),
                  },

                  ...EXAM_ORDER.map((examType) => ({
                    key: examType,
                    label: formatExamType(examType),

                    render: (_, row) => {
                      const entries = row.examTypes?.[examType] || [];

                      if (!entries.length) {
                        return "—";
                      }

                      const total = entries.reduce(
                        (sum, entry) => sum + Number(entry.marks || 0),
                        0,
                      );

                      return (
                        <span
                          className="student-academic-records-mark-total"
                          style={{
                            color: total >= 60
                              ? "var(--color-success)"
                              : "var(--color-error)",
                          }}
                        >
                          {total}
                        </span>
                      );
                    },
                  })),

                  {
                    key: "result",
                    label: "Total",
                    render: (value) =>
                      value
                        ? `${fmtNumber(value.obtainedMarks)} / ${fmtNumber(
                            value.totalMarks,
                          )}`
                        : "—",
                  },

                  {
                    key: "result",
                    label: "%",
                    render: (value) =>
                      value ? (
                        <strong
                          style={{
                            color: pctColor(value.marksPercentage),
                          }}
                        >
                          {value.marksPercentage}%
                        </strong>
                      ) : (
                        "—"
                      ),
                  },

                  {
                    key: "result",
                    label: "Grade",
                    render: (value) => (value ? gradeBadge(value.grade) : "—"),
                  },

                  {
                    key: "result",
                    label: "Status",
                    render: (value) =>
                      value ? statusBadge(value.status) : "—",
                  },

                  {
                    key: "teacherName",
                    label: "Teacher",
                    render: (value) => value || "—",
                  },
                ]}
                data={filteredSubjects}
                actions={(row) => (
                  <button
                    className="btn btn-secondary"
                    onClick={() => openSubjectDrawer(row)}
                  >
                    View
                  </button>
                )}
              />
            )}
          </Panel>

          {/* ═══════════════════════════════════════════════════════
                        PERFORMANCE OVERVIEW
                    ═══════════════════════════════════════════════════════ */}

          {subjectsWithResults.length > 0 && (
            <div className="student-academic-records-performance-grid">
              {/* ─────────────────────────────────────────────
                                BEST PERFORMING
                            ───────────────────────────────────────────── */}

              <Panel
                title="Best Performing"
                description="Your highest-performing subjects in this session."
              >
                <div className="student-academic-records-performance-list">
                  {topSubjects.map((subject, index) => (
                    <div
                      key={subject.subjectId}
                      className="student-academic-records-performance-item student-academic-records-performance-item-success"
                    >
                      <div className="student-academic-records-performance-main">
                        <span className="student-academic-records-performance-rank">
                          #{index + 1}
                        </span>

                        <span className="student-academic-records-performance-subject">
                          {subject.subjectName}
                        </span>
                      </div>

                      <div className="student-academic-records-performance-result">
                        <strong className="student-academic-records-performance-score">
                          {subject.result.marksPercentage}%
                        </strong>

                        {gradeBadge(subject.result.grade)}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* ─────────────────────────────────────────────
                                NEEDS IMPROVEMENT
                            ───────────────────────────────────────────── */}

              <Panel
                title="Needs Improvement"
                description="Subjects that may require additional attention."
              >
                <div className="student-academic-records-performance-list">
                  {weakSubjects.map((subject, index) => {
                    const isFail = subject.result.marksPercentage < 50;

                    return (
                      <div
                        key={subject.subjectId}
                        className={`student-academic-records-performance-item ${
                          isFail
                            ? "student-academic-records-performance-item-error"
                            : "student-academic-records-performance-item-warning"
                        }`}
                      >
                        <div className="student-academic-records-performance-main">
                          <span className="student-academic-records-performance-rank">
                            #{index + 1}
                          </span>

                          <span className="student-academic-records-performance-subject">
                            {subject.subjectName}
                          </span>
                        </div>

                        <div className="student-academic-records-performance-result">
                          <strong
                            className="student-academic-records-performance-score"
                            style={{ color: pctColor(subject.result.marksPercentage) }}
                          >
                            {subject.result.marksPercentage}%
                          </strong>

                          {gradeBadge(subject.result.grade)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              {/* ─────────────────────────────────────────────
                                ACADEMIC STATUS
                            ───────────────────────────────────────────── */}

              <Panel
                title="Academic Status"
                description="Overall academic standing across your records."
              >
                <p>
                  <span className={`status ${standingClass}`}>
                    {overall.standing || "No Records"}
                  </span>
                </p>

                <DetailGrid
                  columns={1}
                  items={[
                    {
                      label: "Current Average",
                      value:
                        overall.avgPercentage != null
                          ? `${overall.avgPercentage}%`
                          : "N/A",
                    },
                    {
                      label: "Subjects Passed",
                      value: overall.totalPassed ?? 0,
                    },
                    {
                      label: "Subjects Failed",
                      value: overall.totalFailed ?? 0,
                    },
                  ]}
                />

                {overall.totalFailed > 0 && (
                  <div className="alert alert-warning">
                    <div className="alert-content">
                      <p className="alert-message">
                        You have {overall.totalFailed} failed subject(s). Please
                        contact your academic advisor.
                      </p>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
                SUBJECT DETAIL DRAWER
            ═══════════════════════════════════════════════════════════════ */}

      <Drawer
        isOpen={isDrawerOpen}
        title={
          selectedSubject
            ? `${selectedSubject.subjectName} — ${selectedSubject.subjectCode || ""}`
            : "Subject Detail"
        }
        onClose={() => setIsDrawerOpen(false)}
        width="580px"
        footer={
          <button
            className="btn btn-danger"
            onClick={() => setIsDrawerOpen(false)}
          >
            Close
          </button>
        }
      >
        {selectedSubject && (
          <div className="student-academic-records-drawer-content">
            {/* ═══════════════════════════════════════════════
                            SUBJECT INFORMATION
                        ═══════════════════════════════════════════════ */}

            <Panel
              title="Subject Information"
              description="Basic information about this academic subject."
            >
              <div className="detail-grid">
                {[
                  ["Subject", selectedSubject.subjectName],

                  ["Subject Code", selectedSubject.subjectCode],

                  ["Credit Hours", selectedSubject.creditHours],

                  ["Teacher", selectedSubject.teacherName],

                  ["Class / Section", selectedSubject.classSection],

                  ["Semester", selectedSubject.semester],

                  ["Session", activeSession],
                ].map(([label, value]) => (
                  <div key={label} className="detail-row">
                    <span className="detail-label">{label}</span>

                    <span className="detail-value">{value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* ═══════════════════════════════════════════════
                            MARKS BREAKDOWN
                        ═══════════════════════════════════════════════ */}

            <Panel
              title="Marks Breakdown"
              description="Marks recorded for each examination component."
            >
              {EXAM_ORDER.map((examType) => {
                const entries = selectedSubject.examTypes?.[examType] || [];

                if (!entries.length) {
                  return null;
                }

                const total = entries.reduce(
                  (sum, entry) => sum + Number(entry.marks || 0),
                  0,
                );

                return (
                  <div key={examType} className="student-academic-records-exam">
                    <div className="student-academic-records-exam-header">
                      <span className="student-academic-records-exam-title">
                        {formatExamType(examType)}
                      </span>

                      <strong
                        className="student-academic-records-exam-total"
                        style={{ color: pctColor(total) }}
                      >
                        {total}
                      </strong>
                    </div>

                    {entries.map((entry, index) => (
                      <div key={index} className="student-academic-records-exam-entry">
                        <span>
                          Entry {index + 1}
                          {entry.remarks ? ` — ${entry.remarks}` : ""}
                        </span>

                        <strong className="student-academic-records-exam-entry-mark">
                          {entry.marks}
                        </strong>
                      </div>
                    ))}
                  </div>
                );
              })}

              {EXAM_ORDER.every(
                (examType) => !selectedSubject.examTypes?.[examType]?.length,
              ) && (
                <div className="student-academic-records-no-marks">
                  No individual marks entries found.
                </div>
              )}
            </Panel>

            {/* ═══════════════════════════════════════════════
                            FINAL RESULT
                        ═══════════════════════════════════════════════ */}

            {selectedSubject.result ? (
              <Panel
                title="Final Result"
                description="Published final result for this subject."
              >
                <div className="student-academic-records-final-grade-wrap">
                  <div
                    className="student-academic-records-final-grade"
                    style={{
                      background: (
                        GRADE_COLORS[selectedSubject.result.grade] || {
                          bg: "var(--color-surface-subtle)",
                          border: "var(--color-border)",
                          text: "var(--color-text-secondary)",
                        }
                      ).bg,
                      borderColor: (
                        GRADE_COLORS[selectedSubject.result.grade] || {
                          border: "var(--color-border)",
                        }
                      ).border,
                    }}
                  >
                    <span
                      className="student-academic-records-final-grade-value"
                      style={{
                        color: (
                          GRADE_COLORS[selectedSubject.result.grade] || {
                            text: "var(--color-text-secondary)",
                          }
                        ).text,
                      }}
                    >
                      {selectedSubject.result.grade}
                    </span>

                    <span className="student-academic-records-final-grade-label">
                      Final Grade
                    </span>
                  </div>
                </div>

                <div className="detail-grid">
                  <div className="detail-row">
                    <span className="detail-label">Obtained Marks</span>

                    <span className="detail-value">
                      {selectedSubject.result.obtainedMarks} /{" "}
                      {selectedSubject.result.totalMarks}
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Percentage</span>

                    <span
                      className="detail-value"
                      style={{
                        color: pctColor(selectedSubject.result.marksPercentage),
                      }}
                    >
                      {selectedSubject.result.marksPercentage}%
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Attendance</span>

                    <span className="detail-value">
                      {selectedSubject.result.attendancePercentage}%
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">Status</span>

                    <span className="detail-value">
                      {statusBadge(selectedSubject.result.status)}
                    </span>
                  </div>

                  {selectedSubject.result.remarks && (
                    <div className="detail-row">
                      <span className="detail-label">Remarks</span>

                      <span
                        className="detail-value student-academic-records-remarks"
                      >
                        {selectedSubject.result.remarks}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── PROGRESS ── */}

                <div className="student-academic-records-result-progress">
                  <div className="student-academic-records-result-progress-labels">
                    <span>0%</span>

                    <strong
                      style={{
                        color: pctColor(selectedSubject.result.marksPercentage),
                      }}
                    >
                      {selectedSubject.result.marksPercentage}%
                    </strong>

                    <span>100%</span>
                  </div>

                  <div className="student-academic-records-result-progress-track">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            Number(selectedSubject.result.marksPercentage || 0),
                          ),
                        )}%`,
                        background: pctColor(
                          selectedSubject.result.marksPercentage,
                        ),
                      }}
                    />
                  </div>
                </div>
              </Panel>
            ) : (
              <div className="student-academic-records-result-pending">
                ⏳ Final result has not yet been published for this subject.
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
