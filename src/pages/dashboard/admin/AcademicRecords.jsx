import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";

import {
  getAcademicRecordStats,
  getRecords,
  updateRecordStatus,
} from "../../../services/academicRecordService.js";

const STATUS_OPTIONS = [
  "All",
  "pending",
  "verified",
  "needs_correction",
  "rejected",
];

const EXAM_OPTIONS = [
  "All",
  "quiz",
  "assignment",
  "practical",
  "midterm",
  "final",
];

const EMPTY_STATS = {
  totalRecords: 0,
  teachersWithRecords: 0,
  pendingReview: 0,
  verifiedRecords: 0,
  needsCorrection: 0,
  rejectedRecords: 0,
  classesWithRecords: 0,
};

const STATUS_LABELS = {
  pending: "Pending",
  verified: "Verified",
  needs_correction: "Needs Correction",
  rejected: "Rejected",
};

const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "—");

const formatLabel = (value) =>
  value
    ? value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "—";

const statusClass = (status) => {
  if (status === "verified") {
    return "status status-active";
  }

  if (status === "needs_correction" || status === "rejected") {
    return "status status-suspended";
  }

  return "status";
};

export default function AcademicRecords() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [examFilter, setExamFilter] = useState("All");

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState("");

  const fetchStats = useCallback(async () => {
    const response = await getAcademicRecordStats();
    setStats({
      ...EMPTY_STATS,
      ...response.data,
    });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        search: search.trim(),
        status: statusFilter,
        examType: examFilter,
      };

      const response = await getRecords(params);
      setRecords(response.data.records || []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load academic records.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, examFilter]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRecords();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchRecords]);

  useEffect(() => {
    fetchStats().catch(() => {
      setError("Failed to load academic record statistics.");
    });
  }, [fetchStats]);

  const openRecord = (record) => {
    setSelectedRecord(record);
    setReviewRemarks(record.reviewRemarks || "");
    setActionError("");
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (updating) return;

    setIsDrawerOpen(false);
    setSelectedRecord(null);
    setReviewRemarks("");
    setActionError("");
  };

  const refreshData = async (recordId) => {
    const [recordsResponse, statsResponse] = await Promise.all([
      getRecords({
        search: search.trim(),
        status: statusFilter,
        examType: examFilter,
      }),
      getAcademicRecordStats(),
    ]);

    const updatedRecords = recordsResponse.data.records || [];

    setRecords(updatedRecords);
    setStats({
      ...EMPTY_STATS,
      ...statsResponse.data,
    });

    if (recordId) {
      const refreshedRecord = updatedRecords.find(
        (record) => record._id === recordId,
      );

      if (refreshedRecord) {
        setSelectedRecord(refreshedRecord);
        setReviewRemarks(refreshedRecord.reviewRemarks || "");
      } else {
        setSelectedRecord(null);
        setIsDrawerOpen(false);
      }
    }
  };

  const handleReview = async (status) => {
    if (!selectedRecord?._id) return;

    if (
      ["needs_correction", "rejected"].includes(status) &&
      !reviewRemarks.trim()
    ) {
      setActionError(
        "Add review remarks before requesting corrections or rejecting this record.",
      );
      return;
    }

    setUpdating(true);
    setActionError("");

    try {
      await updateRecordStatus(selectedRecord._id, {
        status,
        reviewRemarks: reviewRemarks.trim(),
      });

      await refreshData(selectedRecord._id);
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to update the academic record.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleLockChange = async (isLocked) => {
    if (!selectedRecord?._id) return;

    if (isLocked && selectedRecord.status !== "verified") {
      setActionError("Only verified records can be locked.");
      return;
    }

    setUpdating(true);
    setActionError("");

    try {
      await updateRecordStatus(selectedRecord._id, {
        isLocked,
      });

      await refreshData(selectedRecord._id);
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to update the record lock.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const selectedStudent = selectedRecord?.student;
  const selectedTeacher = selectedRecord?.teacher;
  const selectedSubject = selectedRecord?.subject;
  const selectedClass = selectedRecord?.classSection;

  return (
    <div className="dashboard-page admin-page">
      <PageHeader
        title="Academic Records"
        description="Review teacher-submitted marks, validate academic records, and manage verified record locks."
      />

      <div className="summary-card-grid">
        <SummaryCard title="Total Records" value={stats.totalRecords} />

        <SummaryCard
          title="Teachers with Records"
          value={stats.teachersWithRecords}
        />

        <SummaryCard title="Pending Review" value={stats.pendingReview} />

        <SummaryCard title="Verified Records" value={stats.verifiedRecords} />

        <SummaryCard title="Needs Correction" value={stats.needsCorrection} />

        <SummaryCard
          title="Classes with Records"
          value={stats.classesWithRecords}
        />
      </div>

      <SearchFilters
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            label: "Status:",
            value: statusFilter,
            onChange: setStatusFilter,
            options: STATUS_OPTIONS,
            optionLabels: [
              "All",
              "Pending",
              "Verified",
              "Needs Correction",
              "Rejected",
            ],
          },
          {
            label: "Exam Type:",
            value: examFilter,
            onChange: setExamFilter,
            options: EXAM_OPTIONS,
            optionLabels: [
              "All",
              "Quiz",
              "Assignment",
              "Practical",
              "Midterm",
              "Final",
            ],
          },
        ]}
      />

      {error && (
        <div className="error-state">
          <h2 className="error-state-title">Unable to load academic records</h2>
          <p className="error-state-description">{error}</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchRecords();
              fetchStats().catch(() => {});
            }}
          >
            Retry
          </button>
        </div>
      )}

      <Panel title="Academic Records">
        {loading ? (
          <div className="dashboard-loading">
            <p>Loading academic records...</p>
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "student",
                label: "Student",
                className: "table-cell-primary",
                render: (value) => value?.name || "—",
              },
              {
                key: "rollNo",
                label: "Roll No.",
                render: (_, record) => record.student?.rollNo || "—",
              },
              {
                key: "subject",
                label: "Subject",
                render: (value) =>
                  value
                    ? `${value.name || "—"}${
                        value.code ? ` (${value.code})` : ""
                      }`
                    : "—",
              },
              {
                key: "classSection",
                label: "Class",
                render: (value) =>
                  value
                    ? `${value.name || ""}${
                        value.section ? ` - ${value.section}` : ""
                      }`
                    : "—",
              },
              {
                key: "teacher",
                label: "Teacher",
                render: (value) => value?.name || "—",
              },
              {
                key: "examType",
                label: "Exam Type",
                render: formatLabel,
              },
              {
                key: "marks",
                label: "Marks",
              },
              {
                key: "session",
                label: "Session",
              },
              {
                key: "isLocked",
                label: "Lock",
                render: (value) => (value ? "Locked" : "Unlocked"),
              },
              {
                key: "status",
                label: "Status",
                render: (value) => (
                  <span className={statusClass(value)}>
                    {STATUS_LABELS[value] || formatLabel(value)}
                  </span>
                ),
              },
              {
                key: "createdAt",
                label: "Submitted",
                render: formatDate,
              },
            ]}
            data={records}
            actions={(record) => (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openRecord(record)}
              >
                Review
              </button>
            )}
          />
        )}

        {!loading && !error && records.length === 0 && (
          <div className="empty-state">
            <p className="empty-state-description">
              No academic records match the selected filters.
            </p>
          </div>
        )}
      </Panel>

      <Drawer
        isOpen={isDrawerOpen}
        title={
          selectedStudent?.name
            ? `Academic Record — ${selectedStudent.name}`
            : "Academic Record Review"
        }
        onClose={closeDrawer}
      >
        {selectedRecord && (
          <div className="tab-panel">
            <Panel title="Record Details">
              <DetailGrid
                columns={2}
                items={[
                  {
                    label: "Student",
                    value: selectedStudent?.name || "—",
                  },
                  {
                    label: "Roll Number",
                    value: selectedStudent?.rollNo || "—",
                  },
                  {
                    label: "Teacher",
                    value: selectedTeacher?.name || "—",
                  },
                  {
                    label: "Subject",
                    value: selectedSubject?.name || "—",
                  },
                  {
                    label: "Subject Code",
                    value: selectedSubject?.code || "—",
                  },
                  {
                    label: "Class",
                    value: selectedClass?.name || "—",
                  },
                  {
                    label: "Section",
                    value: selectedClass?.section || "—",
                  },
                  {
                    label: "Semester",
                    value: selectedClass?.semester ?? "—",
                  },
                  {
                    label: "Exam Type",
                    value: formatLabel(selectedRecord.examType),
                  },
                  {
                    label: "Marks",
                    value: selectedRecord.marks,
                  },
                  {
                    label: "Session",
                    value: selectedRecord.session || "—",
                  },
                  {
                    label: "Submitted",
                    value: formatDate(selectedRecord.createdAt),
                  },
                  {
                    label: "Current Status",
                    value: (
                      <span className={statusClass(selectedRecord.status)}>
                        {STATUS_LABELS[selectedRecord.status] ||
                          formatLabel(selectedRecord.status)}
                      </span>
                    ),
                  },
                  {
                    label: "Record Lock",
                    value: selectedRecord.isLocked ? "Locked" : "Unlocked",
                  },
                  {
                    label: "Teacher Remarks",
                    value: selectedRecord.remarks || "—",
                  },
                  {
                    label: "Last Reviewed",
                    value: formatDate(selectedRecord.reviewedAt),
                  },
                  {
                    label: "Review Remarks",
                    value: selectedRecord.reviewRemarks || "—",
                  },
                ]}
              />
            </Panel>

            <Panel title="Validation">
              {selectedRecord.isLocked ? (
                <div className="form-info">
                  This record is locked. Unlock it before changing its review
                  status.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="academic-review-remarks"
                    >
                      Review Remarks
                    </label>

                    <textarea
                      id="academic-review-remarks"
                      className="form-input"
                      rows={4}
                      maxLength={1000}
                      value={reviewRemarks}
                      onChange={(event) => {
                        setReviewRemarks(event.target.value);
                        setActionError("");
                      }}
                      placeholder="Explain the decision or required corrections..."
                      disabled={updating}
                    />
                    <small className="form-help">
                      Required when requesting corrections or rejecting a
                      record.
                    </small>
                  </div>

                  {actionError && (
                    <div className="form-error">{actionError}</div>
                  )}

                  <div className="validation-actions">
                    <button
                      className="btn btn-primary"
                      disabled={updating}
                      onClick={() => handleReview("verified")}
                    >
                      {updating ? "Saving..." : "Verify"}
                    </button>

                    <button
                      className="btn btn-secondary"
                      disabled={updating || !reviewRemarks.trim()}
                      onClick={() => handleReview("needs_correction")}
                    >
                      Request Correction
                    </button>

                    <button
                      className="btn btn-danger"
                      disabled={updating || !reviewRemarks.trim()}
                      onClick={() => handleReview("rejected")}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}

              <div className="section-spacing">
                <label className="form-label">Record Lock</label>

                <p className="form-help">
                  Only verified records can be locked. A locked record must be
                  unlocked before its review status can change.
                </p>

                <div className="validation-actions">
                  {selectedRecord.isLocked ? (
                    <button
                      className="btn btn-secondary"
                      disabled={updating}
                      onClick={() => handleLockChange(false)}
                    >
                      {updating ? "Updating..." : "Unlock Record"}
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      disabled={
                        updating || selectedRecord.status !== "verified"
                      }
                      onClick={() => handleLockChange(true)}
                    >
                      {updating ? "Updating..." : "Lock Verified Record"}
                    </button>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        )}
      </Drawer>
    </div>
  );
}
