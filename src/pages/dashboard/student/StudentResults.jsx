import { useState, useEffect } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import { getStudentResults } from "../../../services/studentResultService.js";
import "./student-pages.css";

import {
  faBookOpen,
  faCheckCircle,
  faCircleInfo,
  faCircleXmark,
  faDownload,
  faLock,
  faPrint,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const pctStatusClass = (percentage) => {
  if (percentage >= 80) return "status-success";
  if (percentage >= 65) return "status-info";
  if (percentage >= 50) return "status-warning";
  return "status-error";
};

const gradeStatusClass = (grade) => {
  switch (grade) {
    case "A":
      return "status-success";
    case "B":
      return "status-info";
    case "C":
      return "status-warning";
    case "D":
      return "status-warning";
    case "F":
      return "status-error";
    default:
      return "status-neutral";
  }
};

const resultStatusClass = (status) => {
  switch (String(status || "").toLowerCase()) {
    case "pass":
      return "status-success";
    case "fail":
      return "status-error";
    default:
      return "status-neutral";
  }
};

const standingStatusClass = (standing) => {
  switch (standing) {
    case "Excellent Standing":
      return "status-success";

    case "Good Standing":
      return "status-info";

    case "Satisfactory":
      return "status-info";

    case "Academic Warning":
      return "status-warning";

    case "Academic Probation":
      return "status-error";

    default:
      return "status-neutral";
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const GradeBadge = ({ grade, large = false }) => (
  <span
    className={`status ${gradeStatusClass(grade)} ${
      large ? "grade-badge-lg" : ""
    }`}
  >
    {grade || "—"}
  </span>
);

const ResultStatusBadge = ({ status }) => {
  const normalized = String(status || "").toLowerCase();

  return (
    <span className={`status ${resultStatusClass(normalized)}`}>
      {normalized === "pass" ? (
        <FontAwesomeIcon icon={faCheckCircle} />
      ) : normalized === "fail" ? (
        <FontAwesomeIcon icon={faCircleXmark} />
      ) : (
        <FontAwesomeIcon icon={faCircleInfo} />
      )}

      {normalized || "Unknown"}
    </span>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <span className="detail-label">{label}</span>
    <span className="detail-value">{value || "—"}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSession, setActiveSession] = useState(null);

  // ───────────────────────────────────────────────────────────────────────────
  // FETCH RESULTS
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getStudentResults();

        const resultData = response.data;

        setData(resultData);

        if (resultData.sessions?.length > 0) {
          setActiveSession(
            resultData.sessions[resultData.sessions.length - 1].session,
          );
        }
      } catch (err) {
        console.error("Failed to load student results:", err);
        setError("Failed to load results. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // PRINT
  // ───────────────────────────────────────────────────────────────────────────

  const handlePrint = () => {
    window.print();
  };

  // ───────────────────────────────────────────────────────────────────────────
  // LOADING
  // ───────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-icon">
          <FontAwesomeIcon icon={faCircleInfo} />
        </div>

        <p>Loading results...</p>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ERROR
  // ───────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state-icon">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>

        <h2 className="error-state-title">
          Unable to load results
        </h2>

        <p className="error-state-description">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="error-state">
        <div className="error-state-icon">
          <FontAwesomeIcon icon={faCircleInfo} />
        </div>

        <h2 className="error-state-title">
          Results unavailable
        </h2>

        <p className="error-state-description">
          No result data was returned.
        </p>
      </div>
    );
  }

  const {
    student = {},
    sessions = [],
    overall = {},
  } = data;

  const currentSession = sessions.find(
    (session) => session.session === activeSession,
  );

  const sum = currentSession?.summary;

  const sessionTabs = sessions.map((session) => ({
    id: session.session,
    label: session.session,
  }));

  // ───────────────────────────────────────────────────────────────────────────
  // TABLE CONFIGURATION
  // ───────────────────────────────────────────────────────────────────────────

  const subjectColumns = [
    {
      key: "subjectName",
      label: "Subject",
      render: (value) => value || "—",
    },
    {
      key: "subjectCode",
      label: "Code",
      render: (value) => (
        <span className="table-code">
          {value || "—"}
        </span>
      ),
    },
    {
      key: "creditHours",
      label: "Cr. Hrs",
      render: (value) => value || "—",
    },
    {
      key: "obtainedMarks",
      label: "Obtained",
      render: (value) => (
        <span className="table-value-emphasis">
          {value ?? "—"}
        </span>
      ),
    },
    {
      key: "totalMarks",
      label: "Total",
      render: (value) => value ?? "—",
    },
    {
      key: "marksPercentage",
      label: "Percentage",
      render: (value) => (
        <span className={`table-percentage ${pctStatusClass(value)}`}>
          {value != null ? `${value}%` : "—"}
        </span>
      ),
    },
    {
      key: "attendancePercentage",
      label: "Attendance",
      render: (value) =>
        value != null ? `${value}%` : "—",
    },
    {
      key: "grade",
      label: "Grade",
      render: (value) => <GradeBadge grade={value} />,
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <ResultStatusBadge status={value} />,
    },
    {
      key: "remarks",
      label: "Remarks",
      render: (value) => value || "—",
    },
  ];

  const historyColumns = [
    {
      key: "session",
      label: "Session",
      render: (value) => (
        <span className="table-value-emphasis">
          {value}
        </span>
      ),
    },
    {
      key: "summary",
      label: "Total Marks",
      render: (_, row) => row.summary?.totalMarks ?? "—",
    },
    {
      key: "summary",
      label: "Obtained",
      render: (_, row) => row.summary?.totalObtained ?? "—",
    },
    {
      key: "summary",
      label: "Percentage",
      render: (_, row) => (
        <span
          className={`table-percentage ${pctStatusClass(
            row.summary?.avgPct,
          )}`}
        >
          {row.summary?.avgPct != null
            ? `${row.summary.avgPct}%`
            : "—"}
        </span>
      ),
    },
    {
      key: "summary",
      label: "GPA",
      render: (_, row) =>
        row.summary?.gpa != null
          ? row.summary.gpa.toFixed(2)
          : "—",
    },
    {
      key: "summary",
      label: "Grade",
      render: (_, row) => (
        <GradeBadge
          grade={row.summary?.overallGrade}
        />
      ),
    },
    {
      key: "summary",
      label: "Subjects",
      render: (_, row) =>
        `${row.summary?.passed ?? 0}/${row.summary?.totalSubjects ?? 0}`,
    },
    {
      key: "summary",
      label: "Status",
      render: (_, row) => (
        <ResultStatusBadge
          status={row.summary?.overallStatus}
        />
      ),
    },
    {
      key: "summary",
      label: "Published",
      render: (_, row) =>
        fmt(row.summary?.publishedAt),
    },
  ];

  return (
    <div className="dashboard-page admin-page results-page student-results-page">

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE HEADER
      ══════════════════════════════════════════════════════════════════════ */}

      <PageHeader
        title="Results"
        description="Review official results and academic standing."
        action={
          currentSession && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handlePrint}
              >
                <FontAwesomeIcon icon={faPrint} />
                Print
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handlePrint}
              >
                <FontAwesomeIcon icon={faDownload} />
                Save as PDF
              </button>
            </>
          )
        }
      />

      {/* ══════════════════════════════════════════════════════════════════════
          NO RESULTS
      ══════════════════════════════════════════════════════════════════════ */}

      {sessions.length === 0 ? (
        <Panel>
          <div className="empty-state">
            <div className="empty-state-icon">
              <FontAwesomeIcon icon={faBookOpen} />
            </div>

            <h3 className="empty-state-title">
              No Results Published Yet
            </h3>

            <p className="empty-state-description">
              Your official results will appear here once
              published by the institution.
            </p>
          </div>
        </Panel>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════════
              SESSION SELECTOR
          ═══════════════════════════════════════════════════════════════════ */}

          <Panel title="Academic Sessions">
            <Tabs
              tabs={sessionTabs}
              activeTab={activeSession}
              onChange={setActiveSession}
            />
          </Panel>

          {/* ═══════════════════════════════════════════════════════════════════
              OFFICIAL RESULT CARD
          ═══════════════════════════════════════════════════════════════════ */}

          {currentSession && sum && (
            <Panel className="results-print-target">

              {/* Result Header */}

              <header className="result-card-header">
                <div className="result-card-heading">
                  <span className="result-card-eyebrow">
                    Official Result Card
                  </span>

                  <h2 className="result-card-title">
                    {currentSession.session}
                  </h2>
                </div>

                <div className="result-card-status-group">
                  <span className="result-official-badge">
                    <FontAwesomeIcon icon={faLock} />
                    Official Result
                  </span>

                  <ResultStatusBadge
                    status={sum.overallStatus}
                  />
                </div>
              </header>

              {/* Student Information */}

              <div className="result-student-meta">

                <DetailItem
                  label="Student"
                  value={student.name}
                />

                <DetailItem
                  label="Roll No."
                  value={student.rollNo}
                />

                <DetailItem
                  label="Program"
                  value={student.program}
                />

                <DetailItem
                  label="Department"
                  value={student.department}
                />

                <DetailItem
                  label="Published"
                  value={fmt(sum.publishedAt)}
                />

              </div>

              {/* Overall Statistics */}

              <div className="result-stat-grid">

                <div className="result-stat">
                  <span className="result-stat-value">
                    {sum.totalMarks ?? "—"}
                  </span>

                  <span className="result-stat-label">
                    Total Marks
                  </span>
                </div>

                <div className="result-stat">
                  <span className="result-stat-value">
                    {sum.totalObtained ?? "—"}
                  </span>

                  <span className="result-stat-label">
                    Obtained
                  </span>
                </div>

                <div className="result-stat">
                  <span
                    className={`result-stat-value ${pctStatusClass(
                      sum.avgPct,
                    )}`}
                  >
                    {sum.avgPct != null
                      ? `${sum.avgPct}%`
                      : "—"}
                  </span>

                  <span className="result-stat-label">
                    Percentage
                  </span>
                </div>

                <div className="result-stat">
                  <span className="result-stat-value">
                    {sum.gpa != null
                      ? sum.gpa.toFixed(2)
                      : "—"}
                  </span>

                  <span className="result-stat-label">
                    GPA
                  </span>
                </div>

                <div className="result-stat">
                  <span className="result-stat-value">
                    {sum.passed ?? 0}/{sum.totalSubjects ?? 0}
                  </span>

                  <span className="result-stat-label">
                    Subjects
                  </span>
                </div>

                <div className="result-stat">
                  <GradeBadge
                    grade={sum.overallGrade}
                    large
                  />

                  <span className="result-stat-label">
                    Overall Grade
                  </span>
                </div>

              </div>

              {/* Subject Results */}

              <div className="result-card-section">

                <div className="section-heading">
                  <div>
                    <h3 className="section-title">
                      Subject Results
                    </h3>

                    <p className="section-description">
                      Official marks, grades, attendance, and
                      subject-level result status.
                    </p>
                  </div>
                </div>

                <DataTable
                  columns={subjectColumns}
                  data={currentSession.subjects || []}
                />

              </div>

              {/* Official Remarks */}

              <div className="result-card-footer">

                <div className="result-remarks">
                  <span className="result-footer-label">
                    Official Remarks
                  </span>

                  <p className="result-footer-value">
                    {sum.overallRemarks || "—"}
                  </p>
                </div>

                <div className="result-publication-meta">
                  <span>
                    Generated by:{" "}
                    <strong>
                      {sum.generatedBy || "—"}
                    </strong>
                  </span>

                  <span>
                    Published:{" "}
                    <strong>
                      {fmt(sum.publishedAt)}
                    </strong>
                  </span>

                  <span className="result-lock-notice">
                    <FontAwesomeIcon icon={faLock} />
                    Official result — no modifications allowed
                  </span>
                </div>

              </div>

            </Panel>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              RESULT HISTORY
          ═══════════════════════════════════════════════════════════════════ */}

          <Panel title="Result History">

            <DataTable
              columns={historyColumns}
              data={sessions}
              actions={(row) => (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setActiveSession(row.session)
                  }
                >
                  <FontAwesomeIcon icon={faBookOpen} />
                  View
                </button>
              )}
            />

          </Panel>

          {/* ═══════════════════════════════════════════════════════════════════
              ACADEMIC STANDING + DOWNLOAD
          ═══════════════════════════════════════════════════════════════════ */}

          <Panel title="Academic Standing">

              <div className="academic-standing">

                <div className="academic-standing-main">
                  <span
                    className={`status ${standingStatusClass(
                      overall.academicStanding,
                    )}`}
                  >
                    {overall.academicStanding || "No Results"}
                  </span>
                </div>

                <div className="academic-standing-metrics">

                  <div className="academic-metric">
                    <span className="academic-metric-value">
                      {overall.cumulativeAvg != null
                        ? `${overall.cumulativeAvg}%`
                        : "N/A"}
                    </span>

                    <span className="academic-metric-label">
                      Cumulative Average
                    </span>
                  </div>

                  <div className="academic-metric">
                    <span className="academic-metric-value">
                      {overall.totalSessions ?? 0}
                    </span>

                    <span className="academic-metric-label">
                      Sessions
                    </span>
                  </div>

                  <div className="academic-metric">
                    <span className="academic-metric-value academic-metric-success">
                      {overall.allPassed ?? 0}
                    </span>

                    <span className="academic-metric-label">
                      Total Passed
                    </span>
                  </div>

                  <div className="academic-metric">
                    <span
                      className={`academic-metric-value ${
                        overall.allFailed > 0
                          ? "academic-metric-error"
                          : "academic-metric-success"
                      }`}
                    >
                      {overall.allFailed ?? 0}
                    </span>

                    <span className="academic-metric-label">
                      Total Failed
                    </span>
                  </div>

                </div>

              </div>

          </Panel>
        </>
      )}
    </div>
  );
}