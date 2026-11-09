import { useState, useEffect } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import {
  getAdmissionStats,
  getAdmissions,
  applyAdmission,
  reviewAdmission,
} from "../../../services/admissionService.js";

import { getPrograms } from "../../../services/programService.js";
import { getDepartments } from "../../../services/departmentService.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  email: "",
  cnic: "",
  contact: "",
  dob: "",
  city: "",
  address: "",
  previousEducation: "",
  department: "",
  program: "",
};

const STATUS_OPTIONS = ["All", "pending", "approved", "rejected"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Admissions() {
  // Data
  const [admissions, setAdmissions] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingReview: 0,
    approved: 0,
    rejected: 0,
    missingDocuments: 0,
    admissionsThisYear: 0,
  });

  // Loading and errors
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [error, setError] = useState(null);
  const [addError, setAddError] = useState(null);
  const [reviewError, setReviewError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Application modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);

  // Detail drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Review
  const [remarks, setRemarks] = useState("");

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const fetchStats = async () => {
    setStatsLoading(true);

    try {
      const res = await getAdmissionStats();
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch admission statistics.", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await getPrograms();

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.programs || [];

      setPrograms(data);
    } catch (err) {
      console.error("Failed to fetch programs.", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await getDepartments();

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.departments || [];

      setDepartments(data);
    } catch (err) {
      console.error("Failed to fetch departments.", err);
    }
  };

  const fetchAdmissions = async (overrides = {}) => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        status: statusFilter,
        search: search.trim(),
        ...overrides,
      };

      if (params.status === "All") {
        delete params.status;
      }

      if (!params.search) {
        delete params.search;
      }

      const res = await getAdmissions(params);
      setAdmissions(res.data.admissions || []);
    } catch (err) {
      console.error("Failed to load admissions.", err);
      setError("Failed to load admissions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPrograms();
    fetchDepartments();
  }, []);

  // Search on the backend with a short debounce.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAdmissions();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [statusFilter, search]);

  // ─── Application form ─────────────────────────────────────────────────────

  const handleAddChange = (e) => {
    const { name, value } = e.target;

    setAddForm((previous) => {
      if (name === "department") {
        return {
          ...previous,
          department: value,
          program: "",
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const availablePrograms = programs.filter((program) => {
    const departmentId =
      typeof program.department === "object"
        ? program.department?._id
        : program.department;

    return departmentId === addForm.department;
  });

  const handleAdd = async (e) => {
    e.preventDefault();

    setAddError(null);
    setCreating(true);

    try {
      await applyAdmission(addForm);

      setIsAddOpen(false);
      setAddForm(EMPTY_FORM);

      await Promise.all([fetchAdmissions(), fetchStats()]);
    } catch (err) {
      setAddError(
        err.response?.data?.message || "Failed to submit application.",
      );
    } finally {
      setCreating(false);
    }
  };

  // ─── Drawer ───────────────────────────────────────────────────────────────

  const openDrawer = (admission) => {
    setSelectedAdmission(admission);
    setActiveTab("overview");
    setRemarks("");
    setReviewError(null);
    setIsDrawerOpen(true);
  };

  // ─── Review workflow ─────────────────────────────────────────────────────

  const handleReview = async (decision) => {
    if (!selectedAdmission) return;

    if (decision === "rejected" && !remarks.trim()) {
      setReviewError("Remarks are required when rejecting an application.");
      return;
    }

    const action = decision === "approved" ? "Approve" : "Reject";

    if (!window.confirm(`${action} this application?`)) {
      return;
    }

    setReviewLoading(true);
    setReviewError(null);

    try {
      const res = await reviewAdmission(selectedAdmission._id, {
        status: decision,
        remarks: remarks.trim(),
      });

      // The API returns populated department/program information.
      setSelectedAdmission(res.data.admission);
      setRemarks("");

      await Promise.all([fetchAdmissions(), fetchStats()]);
    } catch (err) {
      setReviewError(
        err.response?.data?.message || `Failed to ${decision} application.`,
      );
    } finally {
      setReviewLoading(false);
    }
  };

  // ─── Display helpers ──────────────────────────────────────────────────────

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString() : "—";

  const formatStatus = (status) =>
    status ? status.charAt(0).toUpperCase() + status.slice(1) : "—";

  const statusClass = (status) => {
    switch (status) {
      case "approved":
        return "status status-active";
      case "pending":
        return "status status-pending";
      case "rejected":
        return "status status-suspended";
      default:
        return "status";
    }
  };

  const isPending = selectedAdmission?.status === "pending";

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page">
      <PageHeader
        title="Admission Management"
        description="Review applications, inspect submitted documents, and manage admission decisions."
        action={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAddForm(EMPTY_FORM);
              setAddError(null);
              setIsAddOpen(true);
            }}
          >
            + New Application
          </button>
        }
      />

      {/* ─── New Application Modal ──────────────────────────────────── */}

      <Modal
        isOpen={isAddOpen}
        title="New Admission Application"
        description="Enter applicant details and select a department and its program."
        size="md"
        onClose={() => setIsAddOpen(false)}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddOpen(false)}
              disabled={creating}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="add-admission-form"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? "Submitting..." : "Submit"}
            </button>
          </>
        }
      >
        <form
          id="add-admission-form"
          onSubmit={handleAdd}
          className="form-stack"
        >
          {addError && <div className="form-error">{addError}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="admission-name">
              Full Name
            </label>
            <input
              id="admission-name"
              className="form-input"
              type="text"
              name="name"
              value={addForm.name}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-email">
              Email
            </label>
            <input
              id="admission-email"
              className="form-input"
              type="email"
              name="email"
              value={addForm.email}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-cnic">
              CNIC
            </label>
            <input
              id="admission-cnic"
              className="form-input"
              type="text"
              name="cnic"
              value={addForm.cnic}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-contact">
              Contact
            </label>
            <input
              id="admission-contact"
              className="form-input"
              type="text"
              name="contact"
              value={addForm.contact}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-dob">
              Date of Birth
            </label>
            <input
              id="admission-dob"
              className="form-input"
              type="date"
              name="dob"
              value={addForm.dob}
              max={new Date().toISOString().split("T")[0]}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-city">
              City
            </label>
            <input
              id="admission-city"
              className="form-input"
              type="text"
              name="city"
              value={addForm.city}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-address">
              Address
            </label>
            <input
              id="admission-address"
              className="form-input"
              type="text"
              name="address"
              value={addForm.address}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-education">
              Previous Education
            </label>
            <input
              id="admission-education"
              className="form-input"
              type="text"
              name="previousEducation"
              value={addForm.previousEducation}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-department">
              Department
            </label>
            <select
              id="admission-department"
              className="form-select"
              name="department"
              value={addForm.department}
              onChange={handleAddChange}
              required
            >
              <option value="">Select Department</option>

              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admission-program">
              Program
            </label>
            <select
              id="admission-program"
              className="form-select"
              name="program"
              value={addForm.program}
              onChange={handleAddChange}
              disabled={!addForm.department}
              required
            >
              <option value="">
                {addForm.department
                  ? "Select Program"
                  : "Select a department first"}
              </option>

              {availablePrograms.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>

            {addForm.department && availablePrograms.length === 0 && (
              <p className="danger-zone-description">
                No programs are available for this department.
              </p>
            )}
          </div>
        </form>
      </Modal>

      {/* ─── Statistics ─────────────────────────────────────────────── */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Total Applications"
          value={stats.totalApplications}
          loading={statsLoading}
        />

        <SummaryCard
          title="Pending Review"
          value={stats.pendingReview}
          loading={statsLoading}
        />

        <SummaryCard
          title="Approved"
          value={stats.approved}
          loading={statsLoading}
        />

        <SummaryCard
          title="Rejected"
          value={stats.rejected}
          loading={statsLoading}
        />

        <SummaryCard
          title="Missing Documents"
          value={stats.missingDocuments}
          loading={statsLoading}
        />

        <SummaryCard
          title="Approved This Year"
          value={stats.admissionsThisYear}
          loading={statsLoading}
        />
      </div>

      {/* ─── Search and Filters ─────────────────────────────────────── */}

      <SearchFilters
        searchValue={search}
        onSearchChange={setSearch}
        filters={[
          {
            label: "Status:",
            value: statusFilter,
            onChange: setStatusFilter,
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">Loading</div>
          <p>Loading admissions...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <div className="error-state-icon">!</div>
          <h2 className="error-state-title">Unable to load admissions</h2>
          <p className="error-state-description">{error}</p>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAdmissions()}
          >
            Retry
          </button>
        </div>
      )}

      {/* ─── Applications Table ─────────────────────────────────────── */}

      <Panel title="Admission Applications">
        <DataTable
          columns={[
            {
              key: "applicationId",
              label: "App ID",
            },
            {
              key: "name",
              label: "Applicant",
            },
            {
              key: "email",
              label: "Email",
            },
            {
              key: "contact",
              label: "Contact",
            },
            {
              key: "department",
              label: "Department",
              render: (value) => value?.name || "—",
            },
            {
              key: "program",
              label: "Program",
              render: (value) => value?.name || "—",
            },
            {
              key: "documents",
              label: "Documents",
              render: (value) => (
                <span
                  className={
                    value?.length > 0
                      ? "status status-active"
                      : "status status-suspended"
                  }
                >
                  {value?.length || 0} file
                  {value?.length !== 1 ? "s" : ""}
                </span>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (value) => (
                <span className={statusClass(value)}>
                  {formatStatus(value)}
                </span>
              ),
            },
            {
              key: "appliedAt",
              label: "Applied",
              render: (value) => formatDate(value),
            },
          ]}
          data={admissions}
          actions={(row) => (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openDrawer(row)}
            >
              View
            </button>
          )}
        />
      </Panel>

      {/* ─── Application Detail Drawer ──────────────────────────────── */}

      <Drawer
        isOpen={isDrawerOpen}
        title={
          selectedAdmission
            ? `${selectedAdmission.applicationId} — ${selectedAdmission.name}`
            : "Application Detail"
        }
        onClose={() => setIsDrawerOpen(false)}
      >
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "documents", label: "Documents" },
            { id: "workflow", label: "Approval" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="tab-panel">
          {/* Overview */}

          {activeTab === "overview" && (
            <Panel title="Applicant Profile">
              <DetailGrid
                columns={2}
                items={[
                  {
                    label: "Application ID",
                    value: selectedAdmission?.applicationId,
                  },
                  {
                    label: "Name",
                    value: selectedAdmission?.name,
                  },
                  {
                    label: "Email",
                    value: selectedAdmission?.email,
                  },
                  {
                    label: "CNIC",
                    value: selectedAdmission?.cnic,
                  },
                  {
                    label: "Contact",
                    value: selectedAdmission?.contact,
                  },
                  {
                    label: "City",
                    value: selectedAdmission?.city,
                  },
                  {
                    label: "Address",
                    value: selectedAdmission?.address,
                  },
                  {
                    label: "Date of Birth",
                    value: formatDate(selectedAdmission?.dob),
                  },
                  {
                    label: "Previous Education",
                    value: selectedAdmission?.previousEducation,
                  },
                  {
                    label: "Department",
                    value: selectedAdmission?.department?.name,
                  },
                  {
                    label: "Program",
                    value: selectedAdmission?.program?.name,
                  },
                  {
                    label: "Program Duration",
                    value: selectedAdmission?.program?.duration
                      ? `${selectedAdmission.program.duration} year(s)`
                      : "—",
                  },
                  {
                    label: "Applied At",
                    value: formatDate(selectedAdmission?.appliedAt),
                  },
                  {
                    label: "Reviewed At",
                    value: formatDate(selectedAdmission?.reviewedAt),
                  },
                  {
                    label: "Status",
                    value: (
                      <span className={statusClass(selectedAdmission?.status)}>
                        {formatStatus(selectedAdmission?.status)}
                      </span>
                    ),
                  },
                  {
                    label: "Remarks",
                    value: selectedAdmission?.remarks || "—",
                  },
                ]}
              />
            </Panel>
          )}

          {/* Documents */}

          {activeTab === "documents" && (
            <Panel title="Submitted Documents">
              <DetailGrid
                columns={1}
                items={[
                  {
                    label: "Documents Submitted",
                    value: (
                      <span
                        className={
                          selectedAdmission?.documents?.length > 0
                            ? "status status-active"
                            : "status status-suspended"
                        }
                      >
                        {selectedAdmission?.documents?.length || 0} file
                        {selectedAdmission?.documents?.length !== 1 ? "s" : ""}
                      </span>
                    ),
                  },
                ]}
              />

              {selectedAdmission?.documents?.length > 0 ? (
                <div className="document-list">
                  {selectedAdmission.documents.map((document, index) => (
                    <div
                      key={`${document.fileUrl}-${index}`}
                      className="document-item"
                    >
                      <div className="document-info">
                        <span className="document-icon">📄</span>
                        <span className="document-name">{document.name}</span>
                      </div>

                      {document.fileUrl && (
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                        >
                          View File
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📂</div>
                  <p className="empty-state-description">
                    No documents were submitted with this application.
                  </p>
                </div>
              )}

              {isPending && !selectedAdmission?.documents?.length && (
                <div className="section-spacing">
                  <p className="danger-zone-description">
                    Review the applicant's missing documents before making an
                    admission decision.
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* Approval workflow */}

          {activeTab === "workflow" && (
            <Panel title="Approval Workflow">
              <DetailGrid
                columns={1}
                items={[
                  {
                    label: "Current Status",
                    value: (
                      <span className={statusClass(selectedAdmission?.status)}>
                        {formatStatus(selectedAdmission?.status)}
                      </span>
                    ),
                  },
                ]}
              />

              {isPending ? (
                <>
                  <div className="section-spacing">
                    <div className="empty-state">
                      <p className="form-label">On Approval</p>
                      <p className="empty-state-description">
                        A Student profile and linked login account will be
                        created. One seat will be reserved in the selected
                        program, and a roll number will be generated. Documents
                        will remain unverified until handled through the
                        relevant student workflow.
                      </p>
                    </div>
                  </div>

                  <div className="form-stack">
                    <div className="form-group">
                      <label className="form-label">
                        Remarks
                        <span className="danger-zone-description">
                          {" "}
                          (required for rejection)
                        </span>
                      </label>

                      <textarea
                        className="form-input"
                        rows={4}
                        placeholder="Add remarks or the reason for rejection..."
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  {reviewError && (
                    <div className="form-error">{reviewError}</div>
                  )}

                  <div className="button-group section-spacing">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleReview("approved")}
                      disabled={reviewLoading}
                    >
                      {reviewLoading ? "Processing..." : "Approve"}
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleReview("rejected")}
                      disabled={reviewLoading}
                    >
                      {reviewLoading ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    {selectedAdmission?.status === "approved" ? "✓" : "!"}
                  </div>

                  <p className="form-label">
                    Application {formatStatus(selectedAdmission?.status)}
                  </p>

                  {selectedAdmission?.reviewedAt && (
                    <p className="empty-state-description">
                      Reviewed on {formatDate(selectedAdmission.reviewedAt)}
                    </p>
                  )}

                  {selectedAdmission?.remarks && (
                    <div className="section-spacing">
                      <div className="danger-zone">
                        <div className="form-group">
                          <label className="form-label">Review Remarks</label>
                          <p className="danger-zone-description">
                            {selectedAdmission.remarks}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}
        </div>
      </Drawer>
    </div>
  );
}
