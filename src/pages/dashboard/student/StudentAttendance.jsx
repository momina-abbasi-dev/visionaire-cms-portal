import { useState, useEffect } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import { getStudentAttendance } from "../../../services/studentAttendanceService.js";
import "./student-pages.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  faCalendarCheck,
  faChartLine,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faCircleInfo,
  faClock,
  faEye,
} from "@fortawesome/free-solid-svg-icons";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MIN_REQUIRED = 75;

const STATUS_CLASS_MAP = {
  Excellent: "status-success",
  Good: "status-info",
  Average: "status-info",
  Warning: "status-warning",
  Critical: "status-error",
};

const ATTENDANCE_CLASS_MAP = {
  present: "status-success",
  absent: "status-error",
  late: "status-warning",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const getPercentage = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return 0;

  return Math.min(Math.max(number, 0), 100);
};

const getPercentageLevel = (percentage) => {
  const pct = Number(percentage);

  if (pct >= 90) return "excellent";
  if (pct >= 80) return "good";
  if (pct >= 75) return "acceptable";
  if (pct >= 60) return "warning";

  return "critical";
};

const getStatusClass = (status) => STATUS_CLASS_MAP[status] || "status-neutral";

const getAttendanceStatusClass = (status) =>
  ATTENDANCE_CLASS_MAP[status] || "status-neutral";

const getEligibilityClass = (percentage) =>
  Number(percentage) >= MIN_REQUIRED
    ? "attendance-eligibility-success"
    : "attendance-eligibility-error";

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGES
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`status ${getStatusClass(status)}`}>
    {status || "Unknown"}
  </span>
);

const AttendanceBadge = ({ status }) => {
  const normalizedStatus = String(status || "").toLowerCase();

  const iconMap = {
    present: faCircleCheck,
    absent: faCircleXmark,
    late: faClock,
  };

  const icon = iconMap[normalizedStatus];

  return (
    <span className={`status ${getAttendanceStatusClass(normalizedStatus)}`}>
      {icon && <FontAwesomeIcon icon={icon} />}
      {status
        ? `${status.charAt(0).toUpperCase()}${status.slice(1)}`
        : "Unknown"}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

const AttendanceProgress = ({ percentage, showLabel = false, size = "md" }) => {
  const pct = getPercentage(percentage);
  const level = getPercentageLevel(pct);

  return (
    <div className={`attendance-progress attendance-progress-${size}`}>
      {showLabel && (
        <div className="attendance-progress-labels">
          <span>0%</span>

          <strong
            className={`attendance-progress-value attendance-progress-value-${level}`}
          >
            {pct}%
          </strong>

          <span>100%</span>
        </div>
      )}

      <div className="attendance-progress-track">
        <progress
          className={`attendance-progress-meter attendance-progress-meter-${level}`}
          value={pct}
          max="100"
          aria-label={`Attendance ${pct}%`}
        />

        <span
          className="attendance-progress-threshold"
          aria-label="Minimum attendance requirement: 75%"
          title="Minimum attendance requirement: 75%"
        />
      </div>

      {showLabel && (
        <div className="attendance-progress-threshold-label">
          <span>75% minimum</span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

const AttendanceEmptyState = ({
  title = "No Attendance Records Yet",
  description = "Your teacher-submitted attendance will appear here.",
}) => (
  <div className="attendance-empty-state">
    <div className="attendance-empty-icon">
      <FontAwesomeIcon icon={faCalendarCheck} />
    </div>

    <h3 className="attendance-empty-title">{title}</h3>

    <p className="attendance-empty-description">{description}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentAttendance() {
  // ── data ──────────────────────────────────────────────────────────────────

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── filters ────────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // ── drawer ─────────────────────────────────────────────────────────────────

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getStudentAttendance();

        setData(response.data);
      } catch (err) {
        console.error("Failed to load attendance:", err);

        setError("Failed to load attendance records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-icon">
          <FontAwesomeIcon icon={faCalendarCheck} />
        </div>

        <p>Loading attendance...</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state-icon">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </div>

        <h2 className="error-state-title">Unable to load attendance</h2>

        <p className="error-state-description">{error}</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA
  // ─────────────────────────────────────────────────────────────────────────

  const {
    overall = {},
    subjects = [],
    recentHistory = [],
    warnings = [],
  } = data || {};

  const overallPercentage = getPercentage(overall.overallPercentage);

  // ─────────────────────────────────────────────────────────────────────────
  // FILTERED SUBJECTS
  // ─────────────────────────────────────────────────────────────────────────

  const normalizedSearch = search.trim().toLowerCase();

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch =
      !normalizedSearch ||
      subject.subjectName?.toLowerCase().includes(normalizedSearch) ||
      subject.subjectCode?.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) return false;

    if (statusFilter === "Eligible") {
      return Number(subject.percentage) >= MIN_REQUIRED;
    }

    if (statusFilter === "Warning") {
      return Number(subject.percentage) < MIN_REQUIRED;
    }

    return true;
  });

  const hasActiveFilters = Boolean(search) || statusFilter !== "All";

  // ─────────────────────────────────────────────────────────────────────────
  // ELIGIBILITY COUNTS
  // ─────────────────────────────────────────────────────────────────────────

  const eligibleSubjects = subjects.filter(
    (subject) => Number(subject.percentage) >= MIN_REQUIRED,
  ).length;

  const atRiskSubjects = subjects.filter(
    (subject) =>
      Number(subject.percentage) >= 60 &&
      Number(subject.percentage) < MIN_REQUIRED,
  ).length;

  const ineligibleSubjects = subjects.filter(
    (subject) => Number(subject.percentage) < 60,
  ).length;

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  const classesAttended =
    Number(overall.totalPresent || 0) + Number(overall.totalLate || 0);

  const classesMissed = Number(overall.totalAbsent || 0);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page student-attendance-page">
      {/* ================================================================
                PAGE HEADER
            ================================================================ */}
      <PageHeader
        title="Attendance"
        description="Review attendance, subject-level records, and exam eligibility."
      />

      {/* ================================================================
                SUMMARY / KPI CARDS
            ================================================================ */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Overall Attendance"
          value={`${overallPercentage}%`}
          icon={faChartLine}
        />

        <SummaryCard
          title="Classes Attended"
          value={classesAttended}
          icon={faCircleCheck}
        />

        <SummaryCard
          title="Classes Missed"
          value={classesMissed}
          icon={faCircleXmark}
        />

      </div>

      {/* ================================================================
                ATTENDANCE WARNINGS
            ================================================================ */}

      {warnings.length > 0 && (
        <section className="attendance-warning-list">
          {warnings.map((warning, index) => {
            const isCritical = warning.level === "critical";

            return (
              <div
                key={`${warning.subjectId || warning.subjectName || "warning"}-${index}`}
                className={`alert attendance-warning ${
                  isCritical ? "alert-error" : "alert-warning"
                }`}
              >
                <div className="alert-icon">
                  <FontAwesomeIcon
                    icon={isCritical ? faTriangleExclamation : faCircleInfo}
                  />
                </div>

                <div className="alert-content">
                  <p className="alert-message">
                    {warning.message}
                  </p>
                </div>

                <div className="attendance-warning-metric">
                  <strong>{getPercentage(warning.percentage)}%</strong>

                  <span>
                    {warning.absent || 0} absence
                    {warning.absent !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ================================================================
                SEARCH & FILTERS
            ================================================================ */}

      <SearchFilters
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            id: "attendance-status",
            label: "Show:",
            value: statusFilter,
            onChange: setStatusFilter,
            options: ["All", "Eligible", "Warning"],
          },
        ]}
        onReset={
          hasActiveFilters
            ? () => {
                setSearch("");
                setStatusFilter("All");
              }
            : undefined
        }
      />

      {/* ================================================================
                SUBJECT-WISE ATTENDANCE
            ================================================================ */}

      <Panel title="Subject-wise Attendance">
        {subjects.length === 0 ? (
          <AttendanceEmptyState />
        ) : filteredSubjects.length === 0 ? (
          <AttendanceEmptyState
            title="No Matching Subjects"
            description="No subjects match the current search or attendance filter."
          />
        ) : (
          <DataTable
            columns={[
                {
                  key: "subjectName",
                  label: "Subject",
                  render: (value) => (
                    <span className="table-primary">{value || "—"}</span>
                  ),
                },

                {
                  key: "subjectCode",
                  label: "Code",
                  render: (value) => (
                    <span className="table-code">{value || "—"}</span>
                  ),
                },

                {
                  key: "teacherName",
                  label: "Teacher",
                  render: (value) => (
                    <span className="table-secondary">{value || "—"}</span>
                  ),
                },

                {
                  key: "total",
                  label: "Total",
                  render: (value) => (
                    <span className="table-number">{value ?? "—"}</span>
                  ),
                },

                {
                  key: "present",
                  label: "Present",
                  render: (value) => (
                    <span className="table-number table-number-success">
                      {value ?? "—"}
                    </span>
                  ),
                },

                {
                  key: "late",
                  label: "Late",
                  render: (value) => (
                    <span className="table-number table-number-warning">
                      {value ?? "—"}
                    </span>
                  ),
                },

                {
                  key: "absent",
                  label: "Absent",
                  render: (value) => (
                    <span className="table-number table-number-error">
                      {value ?? "—"}
                    </span>
                  ),
                },

                {
                  key: "percentage",
                  label: "Attendance",
                  render: (value) => (
                    <div className="attendance-table-progress">
                      <AttendanceProgress percentage={value} size="sm" />

                      <span
                        className={`attendance-table-percentage attendance-table-percentage-${getPercentageLevel(value)}`}
                      >
                        {getPercentage(value)}%
                      </span>
                    </div>
                  ),
                },

                {
                  key: "attendanceStatus",
                  label: "Status",
                  render: (value) => <StatusBadge status={value} />,
                },
            ]}
            data={filteredSubjects}
            actions={(subject) => (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSelectedSubject(subject);
                  setDrawerOpen(true);
                }}
              >
                <FontAwesomeIcon icon={faEye} />
                View
              </button>
            )}
          />
        )}
      </Panel>

      {/* ================================================================
                HISTORY + ELIGIBILITY
            ================================================================ */}

      <div className="page-grid page-grid-2 attendance-secondary-grid">
        {/* ============================================================
                    RECENT HISTORY
                ============================================================ */}

        <Panel title="Recent Attendance History">
          {recentHistory.length === 0 ? (
            <AttendanceEmptyState
              title="No Attendance History"
              description="Recent attendance activity will appear here."
            />
          ) : (
            <DataTable
              columns={[
                  {
                    key: "date",
                    label: "Date",
                    render: (value) => (
                      <span className="table-nowrap">{fmt(value)}</span>
                    ),
                  },

                  {
                    key: "subjectName",
                    label: "Subject",
                    render: (value) => (
                      <span className="table-primary">{value || "—"}</span>
                    ),
                  },

                  {
                    key: "subjectCode",
                    label: "Code",
                    render: (value) => (
                      <span className="table-code">{value || "—"}</span>
                    ),
                  },

                  {
                    key: "session",
                    label: "Session",
                    render: (value) => (
                      <span className="table-secondary">{value || "—"}</span>
                    ),
                  },

                  {
                    key: "status",
                    label: "Status",
                    render: (value) => <AttendanceBadge status={value} />,
                  },
              ]}
              data={recentHistory}
            />
          )}
        </Panel>

        {/* ============================================================
                    EXAM ELIGIBILITY
                ============================================================ */}

        <Panel title="Exam Eligibility">
          <div className="eligibility-panel">
            <div className="eligibility-metrics">
              <div className="eligibility-metric">
                <span className="eligibility-metric-label">
                  Minimum Required
                </span>

                <strong className="eligibility-metric-value eligibility-metric-warning">
                  {MIN_REQUIRED}%
                </strong>
              </div>

              <div className="eligibility-metric">
                <span className="eligibility-metric-label">Gap</span>

                <strong
                  className={`eligibility-metric-value ${
                    overallPercentage >= MIN_REQUIRED
                      ? "eligibility-metric-success"
                      : "eligibility-metric-error"
                  }`}
                >
                  {overallPercentage >= MIN_REQUIRED
                    ? `+${overallPercentage - MIN_REQUIRED}%`
                    : `-${MIN_REQUIRED - overallPercentage}%`}
                </strong>
              </div>
            </div>

            <div
              className={`eligibility-verdict ${getEligibilityClass(overallPercentage)}`}
            >
              <div className="eligibility-verdict-icon">
                <FontAwesomeIcon
                  icon={
                    overallPercentage >= MIN_REQUIRED
                      ? faCircleCheck
                      : faCircleXmark
                  }
                />
              </div>

              <div>
                <strong>
                  {overallPercentage >= MIN_REQUIRED
                    ? "Eligible for Exams"
                    : "Not Eligible for Exams"}
                </strong>

                {overallPercentage < MIN_REQUIRED && (
                  <p>
                    Improve attendance to reach the
                    {MIN_REQUIRED}% minimum requirement.
                  </p>
                )}
              </div>
            </div>

            <div className="eligibility-breakdown">
              <div className="eligibility-breakdown-heading">
                Subject Breakdown
              </div>

              <div className="eligibility-breakdown-row">
                <span>
                  <FontAwesomeIcon icon={faCircleCheck} />
                  Eligible subjects
                </span>

                <strong className="eligibility-breakdown-success">
                  {eligibleSubjects}
                </strong>
              </div>

              <div className="eligibility-breakdown-row">
                <span>
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  At-risk subjects
                </span>

                <strong className="eligibility-breakdown-warning">
                  {atRiskSubjects}
                </strong>
              </div>

              <div className="eligibility-breakdown-row">
                <span>
                  <FontAwesomeIcon icon={faCircleXmark} />
                  Ineligible subjects
                </span>

                <strong className="eligibility-breakdown-error">
                  {ineligibleSubjects}
                </strong>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* ================================================================
                SUBJECT DETAIL DRAWER
            ================================================================ */}

      <Drawer
        isOpen={drawerOpen}
        title={
          selectedSubject
            ? `${selectedSubject.subjectName || "Subject"} — Attendance`
            : "Subject Attendance"
        }
        onClose={() => setDrawerOpen(false)}
        width="480px"
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDrawerOpen(false)}
          >
            Close
          </button>
        }
      >
        {selectedSubject && (
          <div className="attendance-drawer">
            {/* ====================================================
                            SUBJECT INFORMATION
                        ==================================================== */}

            <Panel title="Subject Information">
              <div className="detail-grid">
                {[
                  ["Subject", selectedSubject.subjectName],
                  ["Code", selectedSubject.subjectCode],
                  ["Credit Hours", selectedSubject.creditHours],
                  ["Teacher", selectedSubject.teacherName],
                  ["Class", selectedSubject.classSection],
                ].map(([label, value]) => (
                  <div key={label} className="detail-row">
                    <span className="detail-label">{label}</span>

                    <span className="detail-value">{value ?? "—"}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* ====================================================
                            ATTENDANCE SUMMARY
                        ==================================================== */}

            <Panel title="Attendance Summary">
              <div className="drawer-attendance-summary">
                <div className="drawer-attendance-score">
                  <strong>{getPercentage(selectedSubject.percentage)}%</strong>

                  <StatusBadge status={selectedSubject.attendanceStatus} />
                </div>

                <AttendanceProgress
                  percentage={selectedSubject.percentage}
                  showLabel
                  size="lg"
                />

                <div className="attendance-stat-grid">
                  <div className="attendance-stat attendance-stat-success">
                    <strong>{selectedSubject.present ?? 0}</strong>

                    <span>Present</span>
                  </div>

                  <div className="attendance-stat attendance-stat-warning">
                    <strong>{selectedSubject.late ?? 0}</strong>

                    <span>Late</span>
                  </div>

                  <div className="attendance-stat attendance-stat-error">
                    <strong>{selectedSubject.absent ?? 0}</strong>

                    <span>Absent</span>
                  </div>

                  <div className="attendance-stat attendance-stat-neutral">
                    <strong>{selectedSubject.total ?? 0}</strong>

                    <span>Total</span>
                  </div>
                </div>

                <div
                  className={`subject-eligibility ${getEligibilityClass(selectedSubject.percentage)}`}
                >
                  <FontAwesomeIcon
                    icon={
                      Number(selectedSubject.percentage) >= MIN_REQUIRED
                        ? faCircleCheck
                        : faCircleXmark
                    }
                  />

                  <span>
                    {Number(selectedSubject.percentage) >= MIN_REQUIRED
                      ? "Eligible for this subject's exam"
                      : `${MIN_REQUIRED - Number(selectedSubject.percentage)}% more attendance required`}
                  </span>
                </div>
              </div>
            </Panel>

            {/* ====================================================
                            RECENT ATTENDANCE
                        ==================================================== */}

            <Panel title="Recent Attendance">
              {!selectedSubject.history ||
              selectedSubject.history.length === 0 ? (
                <AttendanceEmptyState
                  title="No Subject History"
                  description="No attendance entries have been recorded for this subject."
                />
              ) : (
                <div className="drawer-history-list">
                  {selectedSubject.history.map((history, index) => {
                    const status = String(history.status || "").toLowerCase();

                    return (
                      <div
                        key={`${history.date || "entry"}-${index}`}
                        className={`drawer-history-item drawer-history-${status}`}
                      >
                        <div className="drawer-history-date">
                          <span className="drawer-history-icon">
                            <FontAwesomeIcon
                              icon={
                                status === "present"
                                  ? faCircleCheck
                                  : status === "late"
                                    ? faClock
                                    : faCircleXmark
                              }
                            />
                          </span>

                          <span>{fmt(history.date)}</span>
                        </div>

                        <AttendanceBadge status={history.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        )}
      </Drawer>
    </div>
  );
}
