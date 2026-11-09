import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";

import {
  getStudentProfile,
  updateStudentProfile,
  changeStudentPassword,
} from "../../../services/studentProfileService.js";
import "./student-pages.css";

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString() : "—";

const formatStatus = (status) => {
  if (!status) {
    return "—";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getStatusClass = (status) => {
  return status === "active"
    ? "status status-active"
    : "status status-error";
};

const getFeeStatusClass = (status) => {
  if (status === "paid") {
    return "status status-active";
  }

  if (status === "partial") {
    return "status status-warning";
  }

  return "status status-error";
};

// ─── component ────────────────────────────────────────────────────────────────

export default function StudentProfile() {
  const navigate = useNavigate();

  // ── data state ─────────────────────────────────────────────────────────────

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("personal");

  // ── personal information ──────────────────────────────────────────────────

  const [isEditing, setIsEditing] = useState(false);

  const [editForm, setEditForm] = useState({
    contact: "",
    address: "",
    city: "",
  });

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // ── password ───────────────────────────────────────────────────────────────

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [showPw, setShowPw] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // ── fetch profile ──────────────────────────────────────────────────────────

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getStudentProfile();

      setData(response.data);

      setEditForm({
        contact: response.data.student.contact || "",
        address: response.data.student.address || "",
        city: response.data.student.city || "",
      });
    } catch (err) {
      console.error("Failed to load student profile.", err);
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ── save personal information ──────────────────────────────────────────────

  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditError(null);
    setEditSuccess(false);

    try {
      await updateStudentProfile(editForm);

      setEditSuccess(true);
      setIsEditing(false);

      await fetchProfile();

      setTimeout(() => {
        setEditSuccess(false);
      }, 3000);
    } catch (err) {
      setEditError(
        err.response?.data?.message ||
          "Failed to update profile.",
      );
    } finally {
      setEditSaving(false);
    }
  };

  // ── password change ────────────────────────────────────────────────────────

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setPwSaving(true);
    setPwError(null);
    setPwSuccess(false);

    try {
      await changeStudentPassword(pwForm);

      setPwSuccess(true);

      setPwForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setTimeout(() => {
        setPwSuccess(false);
      }, 4000);
    } catch (err) {
      setPwError(
        err.response?.data?.message ||
          "Failed to change password.",
      );
    } finally {
      setPwSaving(false);
    }
  };

  // ── loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="student-profile-state">
        <div className="student-profile-state-icon">
          Loading
        </div>

        <p>Loading your profile...</p>
      </div>
    );
  }

  // ── error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="error-state">
        <div className="error-state-icon">!</div>

        <h2 className="error-state-title">
          Unable to load profile
        </h2>

        <p className="error-state-description">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { student, account, stats } = data;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page student-profile-page">

      {/* ── PAGE HEADER ─────────────────────────────────────────────────────── */}

      <PageHeader
        title="Student Profile"
        description="View your personal, academic, and account details."
      />

      {/* ── STUDENT IDENTITY ───────────────────────────────────────────────── */}
        <Panel>
      <section className="student-profile-identity">

        <div className="student-profile-identity-main">

          <h1 className="student-profile-name">
            {student.name}
          </h1>

          <div className="student-profile-meta">

            {student.rollNo && (
              <span>
                Roll No.{" "}
                <strong className="student-profile-mono">
                  {student.rollNo}
                </strong>
              </span>
            )}

            {student.program && (
              <>
                <span className="student-profile-meta-separator">
                  •
                </span>

                <span>{student.program}</span>
              </>
            )}

            {student.department && (
              <>
                <span className="student-profile-meta-separator">
                  •
                </span>

                <span>{student.department}</span>
              </>
            )}

          </div>

          <div className="student-profile-badges">

            <span className={getStatusClass(student.status)}>
              {formatStatus(student.status)}
            </span>

            <span
              className={
                student.documentsVerified
                  ? "status status-info"
                  : "status status-warning"
              }
            >
              {student.documentsVerified
                ? "Documents Verified"
                : "Documents Pending"}
            </span>

          </div>

        </div>

      </section>
      </Panel>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}

      <Tabs
        tabs={[
          {
            id: "personal",
            label: "Personal Info",
          },
          {
            id: "academic",
            label: "Academic Info",
          },
          {
            id: "documents",
            label: "Documents",
          },
          {
            id: "security",
            label: "Security",
          },
        ]}
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setIsEditing(false);
          setEditError(null);
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: PERSONAL INFORMATION
      ═══════════════════════════════════════════════════════════════════════ */}

      {activeTab === "personal" && (
        <div className="student-profile-two-column">

          {/* ── PERSONAL INFORMATION ───────────────────────────────────────── */}

          <Panel
            title="Personal Information"
            description="Your basic personal and contact information."
            actions={
              !isEditing ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsEditing(true);
                    setEditError(null);
                  }}
                >
                  Edit
                </button>
              ) : (
                <div className="button-group">

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setEditError(null);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveEdit}
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving..." : "Save"}
                  </button>

                </div>
              )
            }
          >

            {editError && (
              <div className="form-error">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="student-profile-success">
                Profile updated successfully.
              </div>
            )}

            {/* BASIC INFORMATION */}

            <div className="student-profile-section">

              <h3 className="student-profile-section-title">
                Basic Information
              </h3>

              <DetailGrid
                columns={2}
                items={[
                  {
                    label: "Full Name",
                    value: student.name,
                  },
                  {
                    label: "Email",
                    value: student.email,
                  },
                  {
                    label: "CNIC",
                    value: (
                      <span className="student-profile-mono">
                        {student.cnic || "—"}
                      </span>
                    ),
                  },
                  {
                    label: "Date of Birth",
                    value: formatDate(student.dob),
                  },
                ]}
              />

            </div>

            {/* CONTACT & ADDRESS */}

            <div className="student-profile-section">

              <div className="student-profile-section-heading">

                <h3 className="student-profile-section-title">
                  Contact & Address
                </h3>

                {!isEditing && (
                  <span className="student-profile-edit-note">
                    Editable
                  </span>
                )}

              </div>

              {!isEditing ? (
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Contact",
                      value: student.contact,
                    },
                    {
                      label: "Address",
                      value: student.address,
                    },
                    {
                      label: "City",
                      value: student.city,
                    },
                  ]}
                />
              ) : (
                <div className="form-stack">

                  <div className="form-group">
                    <label className="form-label" htmlFor="student-profile-contact">
                      Contact Number
                    </label>

                    <input
                      className="form-input"
                      id="student-profile-contact"
                      type="text"
                      name="contact"
                      value={editForm.contact}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          contact: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="student-profile-address">
                      Address
                    </label>

                    <input
                      className="form-input"
                      id="student-profile-address"
                      type="text"
                      name="address"
                      value={editForm.address}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          address: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="student-profile-city">
                      City
                    </label>

                    <input
                      className="form-input"
                      id="student-profile-city"
                      type="text"
                      name="city"
                      value={editForm.city}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          city: event.target.value,
                        })
                      }
                    />
                  </div>

                  <p className="student-profile-help-text">
                    Only contact, address, and city can be
                    updated. For other changes, contact the
                    administration.
                  </p>

                </div>
              )}

            </div>

          </Panel>

          {/* ── ACCOUNT INFORMATION ────────────────────────────────────────── */}

          <Panel
            title="Account Information"
            description="Your account and access information."
          >
            <DetailGrid
              columns={1}
              items={[
                {
                  label: "Email",
                  value: account.email,
                },
                {
                  label: "Role",
                  value: formatStatus(account.role),
                },
                {
                  label: "Account Status",
                  value: (
                    <span className={getStatusClass(account.status)}>
                      {formatStatus(account.status)}
                    </span>
                  ),
                },
                {
                  label: "Member Since",
                  value: formatDate(account.createdAt),
                },
              ]}
            />
          </Panel>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: ACADEMIC INFORMATION
      ═══════════════════════════════════════════════════════════════════════ */}

      {activeTab === "academic" && (
        <Panel
          title="Academic Information"
          description="Your academic enrollment and institutional information."
        >

          <div className="student-profile-info-banner">
            <span className="student-profile-info-icon">
              i
            </span>

            <span>
              Academic information is managed by the institution
              and cannot be edited by students.
            </span>
          </div>

          <div className="student-profile-section student-profile-section-first">

            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Roll Number",
                  value: (
                    <span className="student-profile-mono">
                      {student.rollNo}
                    </span>
                  ),
                },
                {
                  label: "Student ID",
                  value: (
                    <span className="student-profile-mono">
                      {student._id?.toString() || "—"}
                    </span>
                  ),
                },
                {
                  label: "Program",
                  value: student.program,
                },
                {
                  label: "Department",
                  value: student.department,
                },
                ...(student.departmentCode
                  ? [
                      {
                        label: "Department Code",
                        value: student.departmentCode,
                      },
                    ]
                  : []),
                {
                  label: "Admission Date",
                  value: formatDate(
                    student.dateOfAdmission,
                  ),
                },
                {
                  label: "Academic Status",
                  value: (
                    <span className={getStatusClass(student.status)}>
                      {formatStatus(student.status)}
                    </span>
                  ),
                },
                {
                  label: "Fee Status",
                  value: (
                    <span
                      className={getFeeStatusClass(
                        student.feeStatus,
                      )}
                    >
                      {formatStatus(student.feeStatus)}
                    </span>
                  ),
                },
                {
                  label: "Documents Verified",
                  value: (
                    <span
                      className={
                        student.documentsVerified
                          ? "status status-active"
                          : "status status-suspended"
                      }
                    >
                      {student.documentsVerified
                        ? "Verified"
                        : "Pending"}
                    </span>
                  ),
                },
                {
                  label: "Enrolled Subjects",
                  value: stats.enrolledSubjects ?? "0",
                },
                {
                  label: "Attendance",
                  value:
                    stats.attendancePercent != null ? (
                      <span
                        className={
                          stats.attendancePercent < 75
                            ? "student-profile-value-danger"
                            : "student-profile-value-success"
                        }
                      >
                        {stats.attendancePercent}%
                      </span>
                    ) : (
                      "Not recorded yet"
                    ),
                },
              ]}
            />

          </div>

          {/* QUICK LINKS */}

          <div className="student-profile-quick-links">

            <h3 className="student-profile-section-title">
              Academic Modules
            </h3>

            <div className="student-profile-link-grid">

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  navigate("/student/dashboard/student-results")
                }
              >
                View Results
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  navigate("/student/dashboard/student-attendance")
                }
              >
                View Attendance
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  navigate("/student/dashboard/student-fees")
                }
              >
                View Challan
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  navigate("/student/dashboard/student-academic-records")
                }
              >
                Academic Records
              </button>

            </div>

          </div>

        </Panel>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: DOCUMENTS
      ═══════════════════════════════════════════════════════════════════════ */}

      {activeTab === "documents" && (
        <Panel
          title="Academic Documents"
          description="Documents submitted with your admission application."
        >

          {/* VERIFICATION STATUS */}

          <div
            className={
              student.documentsVerified
                ? "student-profile-document-banner student-profile-document-banner-success"
                : "student-profile-document-banner student-profile-document-banner-warning"
            }
          >

            <div className="student-profile-document-status-icon">
              {student.documentsVerified ? "✓" : "!"}
            </div>

            <div>

              <p className="student-profile-document-status-title">
                {student.documentsVerified
                  ? "Documents Verified"
                  : "Verification Pending"}
              </p>

              <p className="student-profile-document-status-text">
                {student.documentsVerified
                  ? "All your documents have been reviewed and verified by the institution."
                  : "Your documents are under review. Please contact admin if this takes too long."}
              </p>

            </div>

          </div>

          {/* DOCUMENT LIST */}

          {student.previousAcademicDocument?.length > 0 ? (
            <div className="student-profile-document-list">

              {student.previousAcademicDocument.map(
                (document, index) => (
                  <div
                    key={index}
                    className="student-profile-document-item"
                  >

                    <div className="student-profile-document-info">

                      <div className="student-profile-document-icon">
                        DOC
                      </div>

                      <div>

                        <p className="student-profile-document-name">
                          {document.name}
                        </p>

                        <p className="student-profile-document-description">
                          Uploaded with admission application
                        </p>

                      </div>

                    </div>

                    {document.fileUrl && (
                      <div className="button-group">

                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                        >
                          View
                        </a>

                        <a
                          href={document.fileUrl}
                          download
                          className="btn btn-secondary"
                        >
                          Download
                        </a>

                      </div>
                    )}

                  </div>
                ),
              )}

            </div>
          ) : (
            <div className="empty-state">

              <div className="empty-state-icon">
                —
              </div>

              <h3 className="empty-state-title">
                No Documents Found
              </h3>

              <p className="empty-state-description">
                No documents were uploaded with your admission
                application.
              </p>

            </div>
          )}

          <p className="student-profile-help-text student-profile-help-text-spaced">
            Documents are managed by the institution. Contact
            admin to add or update your documents.
          </p>

        </Panel>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB: SECURITY
      ═══════════════════════════════════════════════════════════════════════ */}

      {activeTab === "security" && (
        <div className="student-profile-two-column">

          {/* ── CHANGE PASSWORD ─────────────────────────────────────────────── */}

          <Panel
            title="Change Password"
            description="Update your account password."
          >

            <form onSubmit={handleChangePassword}>

              {pwError && (
                <div className="form-error">
                  {pwError}
                </div>
              )}

              {pwSuccess && (
                <div className="student-profile-success">
                  Password changed successfully.
                </div>
              )}

              <div className="form-stack">

                {[
                  {
                    name: "currentPassword",
                    label: "Current Password",
                    key: "current",
                  },
                  {
                    name: "newPassword",
                    label: "New Password",
                    key: "new",
                  },
                  {
                    name: "confirmPassword",
                    label: "Confirm Password",
                    key: "confirm",
                  },
                ].map((field) => (
                  <div
                    key={field.name}
                    className="form-group"
                  >

                    <label
                      className="form-label"
                      htmlFor={`student-profile-${field.name}`}
                    >
                      {field.label}
                    </label>

                    <div className="student-profile-password-field">

                      <input
                        className="form-input"
                        id={`student-profile-${field.name}`}
                        type={
                          showPw[field.key]
                            ? "text"
                            : "password"
                        }
                        name={field.name}
                        value={pwForm[field.name]}
                        onChange={(event) =>
                          setPwForm({
                            ...pwForm,
                            [event.target.name]:
                              event.target.value,
                          })
                        }
                        required
                      />

                      <button
                        type="button"
                        className="student-profile-password-toggle"
                        onClick={() =>
                          setShowPw((current) => ({
                            ...current,
                            [field.key]:
                              !current[field.key],
                          }))
                        }
                        aria-label={
                          showPw[field.key]
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPw[field.key] ? "Hide" : "Show"}
                      </button>

                    </div>

                  </div>
                ))}

                <ul className="student-profile-password-rules">
                  <li>Minimum 6 characters</li>
                  <li>
                    New password must match confirmation
                  </li>
                </ul>

                <button
                  type="submit"
                  className="btn btn-primary student-profile-password-button"
                  disabled={pwSaving}
                >
                  {pwSaving
                    ? "Changing..."
                    : "Change Password"}
                </button>

              </div>

            </form>

          </Panel>

          <Panel
            title="Security Tips"
            description="Keep your account credentials private and secure."
          >
            <div className="student-profile-security-tips">
              <ul>
                <li>Use a strong, unique password.</li>
                <li>Never share your login credentials.</li>
                <li>Log out from shared devices.</li>
              </ul>
            </div>

          </Panel>

        </div>
      )}
      {activeTab === "security" && account.status === "suspended" && (
        <div className="alert alert-warning" role="alert">
          <div className="alert-content">
            <p className="alert-message">
              Your account is suspended. Please contact the admin for assistance.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}