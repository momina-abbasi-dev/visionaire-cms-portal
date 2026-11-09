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
  createTeacher,
  getTeachers,
  getTeacherStats,
  updateTeacher,
  deleteTeacher,
} from "../../../services/teacherService.js";

import { getDepartments } from "../../../services/departmentService.js";
import { getSubjects } from "../../../services/subjectService.js";
import { getClasses } from "../../../services/classService.js";

// ─── constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  registrationNo: "",
  email: "",
  cnic: "",
  contact: "",
  dob: "",
  city: "",
  address: "",
  education: "",
  role: "junior",
  department: "",
  password: "",
};

const ROLE_OPTIONS = ["All", "junior", "senior"];
const STATUS_OPTIONS = ["All", "active", "suspended"];

// ─── component ────────────────────────────────────────────────────────────────

export default function TeacherManagement() {
  // ── data state ──────────────────────────────────────────────────────────────

  const [teachers, setTeachers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    suspended: 0,
    senior: 0,
    junior: 0,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  // ── loading / error state ──────────────────────────────────────────────────

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // ── filter state ───────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  // ── add teacher modal state ────────────────────────────────────────────────

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState(null);

  // ── drawer state ───────────────────────────────────────────────────────────

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // ── edit state ─────────────────────────────────────────────────────────────

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // ── assignment state ───────────────────────────────────────────────────────

  /*
   * These states are kept temporarily because the assignment UI already exists.
   *
   * IMPORTANT:
   * Teacher does not own assignedSubjects / assignedClasses in its schema.
   * The actual assignment workflow will be connected to AcademicAssignment
   * after that module is audited.
   */
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const fetchStats = async () => {
    try {
      const res = await getTeacherStats();

      setStats({
        total: res.data.total || 0,
        active: res.data.active || 0,
        suspended: res.data.suspended || 0,
        senior: res.data.senior || 0,
        junior: res.data.junior || 0,
      });
    } catch (err) {
      console.error("Failed to fetch teacher stats.", err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await getDepartments();

      setDepartments(
        Array.isArray(res.data)
          ? res.data
          : res.data.departments || [],
      );
    } catch (err) {
      console.error("Failed to fetch departments.", err);
    }
  };

  const fetchSubjectsAndClasses = async (departmentId) => {
    if (!departmentId) {
      setSubjects([]);
      setClasses([]);
      return;
    }

    try {
      const [subjectsRes, classesRes] = await Promise.all([
        getSubjects(),
        getClasses(),
      ]);

      const allSubjects = Array.isArray(subjectsRes.data)
        ? subjectsRes.data
        : subjectsRes.data.subjects || [];

      const allClasses = Array.isArray(classesRes.data)
        ? classesRes.data
        : classesRes.data.classes || [];

      setSubjects(
        allSubjects.filter(
          (subject) =>
            (subject.department?._id || subject.department) ===
            departmentId,
        ),
      );

      setClasses(
        allClasses.filter(
          (academicClass) =>
            (academicClass.department?._id ||
              academicClass.department) === departmentId,
        ),
      );
    } catch (err) {
      console.error("Failed to fetch subjects and classes.", err);

      setSubjects([]);
      setClasses([]);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: 10,
        search,
      };

      if (departmentFilter !== "All") {
        params.department = departmentFilter;
      }

      if (roleFilter !== "All") {
        params.role = roleFilter;
      }

      if (statusFilter !== "All") {
        params.status = statusFilter;
      }

      const res = await getTeachers(params);

      setTeachers(res.data.teachers || []);

      setPagination(
        res.data.pagination || {
          total: 0,
          page: 1,
          pages: 1,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load teachers.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [
    search,
    departmentFilter,
    roleFilter,
    statusFilter,
    page,
  ]);

  // ── add teacher ────────────────────────────────────────────────────────────

  const handleAddChange = (e) => {
    const { name, value } = e.target;

    setAddForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    setAddError(null);
    setCreating(true);

    try {
      await createTeacher(addForm);

      setIsAddOpen(false);
      setAddForm({ ...EMPTY_FORM });

      await Promise.all([
        fetchTeachers(),
        fetchStats(),
      ]);
    } catch (err) {
      setAddError(
        err.response?.data?.message ||
          "Failed to create teacher.",
      );
    } finally {
      setCreating(false);
    }
  };

  // ── open drawer ────────────────────────────────────────────────────────────

  const openDrawer = (teacher) => {
    const departmentId =
      teacher.department?._id ||
      teacher.department ||
      "";

    setSelectedTeacher(teacher);
    setActiveTab("overview");
    setIsEditing(false);

    setEditForm({
      name: teacher.name || "",
      email: teacher.email || "",
      cnic: teacher.cnic || "",
      contact: teacher.contact || "",
      city: teacher.city || "",
      address: teacher.address || "",
      education: teacher.education || "",
      role: teacher.role || "junior",
      dob: teacher.dob
        ? teacher.dob.split("T")[0]
        : "",
      department: departmentId,
    });

    /*
     * These values are intentionally read defensively.
     * The actual assignment source will later come from
     * AcademicAssignment rather than Teacher.assignedSubjects/
     * Teacher.assignedClasses.
     */
    setAssignedSubjects(
      Array.isArray(teacher.assignedSubjects)
        ? teacher.assignedSubjects.map((item) =>
            typeof item === "string"
              ? item
              : item?._id,
          )
        : [],
    );

    setAssignedClasses(
      Array.isArray(teacher.assignedClasses)
        ? teacher.assignedClasses.map((item) =>
            typeof item === "string"
              ? item
              : item?._id,
          )
        : [],
    );

    fetchSubjectsAndClasses(departmentId);

    setIsDrawerOpen(true);
  };

  // ── edit teacher ───────────────────────────────────────────────────────────

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!selectedTeacher?._id) {
      return;
    }

    try {
      const res = await updateTeacher(
        selectedTeacher._id,
        editForm,
      );

      setSelectedTeacher(res.data.teacher);
      setIsEditing(false);

      await Promise.all([
        fetchTeachers(),
        fetchStats(),
      ]);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to update teacher.",
      );
    }
  };

  // ── subject assignment ─────────────────────────────────────────────────────

  const toggleSubject = (id) => {
    setAssignedSubjects((prev) =>
      prev.includes(id)
        ? prev.filter((subjectId) => subjectId !== id)
        : [...prev, id],
    );
  };

  const handleSaveSubjects = async () => {
    /*
     * Do not send assignedSubjects to Teacher yet.
     *
     * The Teacher schema does not own subject assignments.
     * This workflow will be connected to AcademicAssignment
     * after its architecture is audited.
     */
    alert(
      "Subject assignment will be connected through the Academic Assignment module.",
    );
  };

  // ── class assignment ───────────────────────────────────────────────────────

  const toggleClass = (id) => {
    setAssignedClasses((prev) =>
      prev.includes(id)
        ? prev.filter((classId) => classId !== id)
        : [...prev, id],
    );
  };

  const handleSaveClasses = async () => {
    /*
     * Do not send assignedClasses to Teacher yet.
     *
     * The Teacher schema does not own class assignments.
     * This workflow will be connected to AcademicAssignment
     * after its architecture is audited.
     */
    alert(
      "Class assignment will be connected through the Academic Assignment module.",
    );
  };

  // ── security actions ───────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus) => {
    if (!selectedTeacher?._id) {
      return;
    }

    if (
      !window.confirm(
        `Change status to "${newStatus}"?`,
      )
    ) {
      return;
    }

    try {
      const res = await updateTeacher(
        selectedTeacher._id,
        {
          status: newStatus,
        },
      );

      setSelectedTeacher(res.data.teacher);

      await Promise.all([
        fetchTeachers(),
        fetchStats(),
      ]);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to update status.",
      );
    }
  };

  const handleRoleChange = async (newRole) => {
    if (!selectedTeacher?._id) {
      return;
    }

    if (
      !window.confirm(
        `Change faculty role to "${newRole}"?`,
      )
    ) {
      return;
    }

    try {
      const res = await updateTeacher(
        selectedTeacher._id,
        {
          role: newRole,
        },
      );

      setSelectedTeacher(res.data.teacher);

      await Promise.all([
        fetchTeachers(),
        fetchStats(),
      ]);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to update faculty role.",
      );
    }
  };

  const handleDelete = async () => {
    if (!selectedTeacher?._id) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${selectedTeacher.name}"? This will also delete the linked teacher login account. This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteTeacher(selectedTeacher._id);

      setIsDrawerOpen(false);
      setSelectedTeacher(null);

      await Promise.all([
        fetchTeachers(),
        fetchStats(),
      ]);
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to delete teacher.",
      );
    }
  };

  // ── helpers ────────────────────────────────────────────────────────────────

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString()
      : "—";

  const formatRole = (role) =>
    role
      ? role.charAt(0).toUpperCase() +
        role.slice(1)
      : "—";

  const statusClass = (status) =>
    status === "active"
      ? "status status-active"
      : "status status-suspended";

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}

      <PageHeader
        title="Teacher Management"
        description="Manage faculty members, roles, and academic assignments."
        action={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setIsAddOpen(true);
              setAddError(null);
              setAddForm({ ...EMPTY_FORM });
            }}
          >
            + Add Teacher
          </button>
        }
      />

      {/* ── ADD TEACHER MODAL ──────────────────────────────────────────────── */}

      <Modal
        isOpen={isAddOpen}
        title="Add New Teacher"
        description="Create a new faculty member and their login account."
        size="md"
        onClose={() => {
          if (!creating) {
            setIsAddOpen(false);
          }
        }}
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
              form="add-teacher-form"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating
                ? "Creating..."
                : "Save"}
            </button>
          </>
        }
      >
        <form
          id="add-teacher-form"
          onSubmit={handleAdd}
          className="form-stack"
        >
          {addError && (
            <div className="form-error">
              {addError}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Full Name
            </label>

            <input
              className="form-input"
              type="text"
              name="name"
              value={addForm.name}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Registration No.
            </label>

            <input
              className="form-input"
              type="text"
              name="registrationNo"
              value={addForm.registrationNo}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Email
            </label>

            <input
              className="form-input"
              type="email"
              name="email"
              value={addForm.email}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              CNIC
            </label>

            <input
              className="form-input"
              type="text"
              name="cnic"
              value={addForm.cnic}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Contact
            </label>

            <input
              className="form-input"
              type="text"
              name="contact"
              value={addForm.contact}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              City
            </label>

            <input
              className="form-input"
              type="text"
              name="city"
              value={addForm.city}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Address
            </label>

            <input
              className="form-input"
              type="text"
              name="address"
              value={addForm.address}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Education
            </label>

            <input
              className="form-input"
              type="text"
              name="education"
              value={addForm.education}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Date of Birth
            </label>

            <input
              className="form-input"
              type="date"
              name="dob"
              value={addForm.dob}
              onChange={handleAddChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Password
            </label>

            <input
              className="form-input"
              type="password"
              name="password"
              value={addForm.password}
              onChange={handleAddChange}
              minLength={6}
              required
            />

            <small className="form-help">
              This password is used for the teacher's login
              account.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">
              Faculty Role
            </label>

            <select
              className="form-select"
              name="role"
              value={addForm.role}
              onChange={handleAddChange}
            >
              <option value="junior">
                Junior
              </option>

              <option value="senior">
                Senior
              </option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Department
            </label>

            <select
              className="form-select"
              name="department"
              value={addForm.department}
              onChange={handleAddChange}
              required
            >
              <option value="">
                Select Department
              </option>

              {departments.map((department) => (
                <option
                  key={department._id}
                  value={department._id}
                >
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* ── SUMMARY CARDS ──────────────────────────────────────────────────── */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Total Teachers"
          value={stats.total}
        />

        <SummaryCard
          title="Active"
          value={stats.active}
        />

        <SummaryCard
          title="Suspended"
          value={stats.suspended}
        />

        <SummaryCard
          title="Senior Faculty"
          value={stats.senior}
        />

        <SummaryCard
          title="Junior Faculty"
          value={stats.junior}
        />
      </div>

      {/* ── SEARCH & FILTERS ───────────────────────────────────────────────── */}

      <SearchFilters
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={[
          {
            label: "Department:",
            value: departmentFilter,
            onChange: (value) => {
              setDepartmentFilter(value);
              setPage(1);
            },
            options: [
              "All",
              ...departments.map(
                (department) => department._id,
              ),
            ],
            optionLabels: [
              "All",
              ...departments.map(
                (department) => department.name,
              ),
            ],
          },

          {
            label: "Role:",
            value: roleFilter,
            onChange: (value) => {
              setRoleFilter(value);
              setPage(1);
            },
            options: ROLE_OPTIONS,
          },

          {
            label: "Status:",
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value);
              setPage(1);
            },
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {/* ── STATUS MESSAGES ───────────────────────────────────────────────── */}

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">
            Loading
          </div>

          <p>Loading teachers...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <div className="error-state-icon">
            !
          </div>

          <h2 className="error-state-title">
            Unable to load teachers
          </h2>

          <p className="error-state-description">
            {error}
          </p>
        </div>
      )}

      {/* ── TEACHERS TABLE ────────────────────────────────────────────────── */}

      <Panel title="Faculty Members">
        <DataTable
          columns={[
            {
              key: "name",
              label: "Name",
              className: "table-cell-primary",
            },

            {
              key: "registrationNo",
              label: "Reg No.",
            },

            {
              key: "email",
              label: "Email",
            },

            {
              key: "department",
              label: "Department",
              render: (value) =>
                value?.name || "—",
            },

            {
              key: "education",
              label: "Education",
            },

            {
              key: "role",
              label: "Role",
              render: (value) =>
                formatRole(value),
            },

            {
              key: "status",
              label: "Status",
              render: (value) => (
                <span
                  className={statusClass(value)}
                >
                  {value}
                </span>
              ),
            },
          ]}
          data={teachers}
          actions={(row) => (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => openDrawer(row)}
            >
              View
            </button>
          )}
        />

        {/* ── PAGINATION ── */}

        {pagination.pages > 1 && (
          <div className="pagination">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() =>
                setPage(
                  (current) => current - 1,
                )
              }
            >
              ← Prev
            </button>

            <span className="pagination-info">
              Page {pagination.page} of{" "}
              {pagination.pages} (
              {pagination.total} teachers)
            </span>

            <button
              className="btn btn-secondary btn-sm"
              disabled={
                page >= pagination.pages
              }
              onClick={() =>
                setPage(
                  (current) => current + 1,
                )
              }
            >
              Next →
            </button>
          </div>
        )}
      </Panel>

      {/* ── TEACHER DETAIL DRAWER ─────────────────────────────────────────── */}

      <Drawer
        isOpen={isDrawerOpen}
        title={
          selectedTeacher?.name ||
          "Teacher Detail"
        }
        onClose={() =>
          setIsDrawerOpen(false)
        }
      >
        <Tabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
            },

            {
              id: "subjects",
              label: "Subjects",
            },

            {
              id: "classes",
              label: "Classes",
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
          }}
        />

        <div className="tab-panel">
          {/* ═════════════════════════════════════════════════════════════════
              TAB: OVERVIEW
          ═════════════════════════════════════════════════════════════════ */}

          {activeTab === "overview" && (
            <Panel
              title="Teacher Profile"
              actions={
                !isEditing ? (
                  <button
                    className="btn btn-secondary"
                    onClick={() =>
                      setIsEditing(true)
                    }
                  >
                    Edit
                  </button>
                ) : (
                  <div className="button-group">
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        setIsEditing(false)
                      }
                    >
                      Cancel
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={
                        handleSaveEdit
                      }
                    >
                      Save
                    </button>
                  </div>
                )
              }
            >
              {!isEditing ? (
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Name",
                      value:
                        selectedTeacher?.name,
                    },

                    {
                      label:
                        "Registration No.",
                      value:
                        selectedTeacher?.registrationNo,
                    },

                    {
                      label: "Email",
                      value:
                        selectedTeacher?.email,
                    },

                    {
                      label: "CNIC",
                      value:
                        selectedTeacher?.cnic,
                    },

                    {
                      label: "Contact",
                      value:
                        selectedTeacher?.contact,
                    },

                    {
                      label: "City",
                      value:
                        selectedTeacher?.city,
                    },

                    {
                      label: "Address",
                      value:
                        selectedTeacher?.address,
                    },

                    {
                      label: "Date of Birth",
                      value: formatDate(
                        selectedTeacher?.dob,
                      ),
                    },

                    {
                      label: "Education",
                      value:
                        selectedTeacher?.education,
                    },

                    {
                      label: "Department",
                      value:
                        selectedTeacher?.department
                          ?.name,
                    },

                    {
                      label: "Role",
                      value: formatRole(
                        selectedTeacher?.role,
                      ),
                    },

                    {
                      label: "Joined",
                      value: formatDate(
                        selectedTeacher?.createdAt,
                      ),
                    },

                    {
                      label: "Status",
                      value: (
                        <span
                          className={statusClass(
                            selectedTeacher?.status,
                          )}
                        >
                          {
                            selectedTeacher?.status
                          }
                        </span>
                      ),
                    },
                  ]}
                />
              ) : (
                <div className="form-stack">
                  {[
                    {
                      name: "name",
                      label: "Name",
                      type: "text",
                    },

                    {
                      name: "email",
                      label: "Email",
                      type: "email",
                    },

                    {
                      name: "cnic",
                      label: "CNIC",
                      type: "text",
                    },

                    {
                      name: "contact",
                      label: "Contact",
                      type: "text",
                    },

                    {
                      name: "city",
                      label: "City",
                      type: "text",
                    },

                    {
                      name: "address",
                      label: "Address",
                      type: "text",
                    },

                    {
                      name: "education",
                      label: "Education",
                      type: "text",
                    },

                    {
                      name: "dob",
                      label: "Date of Birth",
                      type: "date",
                    },
                  ].map((field) => (
                    <div
                      key={field.name}
                      className="form-group"
                    >
                      <label className="form-label">
                        {field.label}
                      </label>

                      <input
                        className="form-input"
                        name={field.name}
                        type={field.type}
                        value={
                          editForm[
                            field.name
                          ] || ""
                        }
                        onChange={
                          handleEditChange
                        }
                      />
                    </div>
                  ))}

                  <div className="form-group">
                    <label className="form-label">
                      Faculty Role
                    </label>

                    <select
                      className="form-select"
                      name="role"
                      value={
                        editForm.role ||
                        "junior"
                      }
                      onChange={
                        handleEditChange
                      }
                    >
                      <option value="junior">
                        Junior
                      </option>

                      <option value="senior">
                        Senior
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Department
                    </label>

                    <select
                      className="form-select"
                      name="department"
                      value={
                        editForm.department ||
                        ""
                      }
                      onChange={
                        handleEditChange
                      }
                    >
                      <option value="">
                        Select Department
                      </option>

                      {departments.map(
                        (department) => (
                          <option
                            key={
                              department._id
                            }
                            value={
                              department._id
                            }
                          >
                            {department.name}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              TAB: SUBJECT ASSIGNMENT
          ═════════════════════════════════════════════════════════════════ */}

          {activeTab === "subjects" && (
            <Panel
              title="Subject Assignment"
              description={`Subjects available in ${
                selectedTeacher?.department
                  ?.name ||
                "this department"
              }.`}
              actions={
                <button
                  className="btn btn-primary"
                  onClick={
                    handleSaveSubjects
                  }
                >
                  Save
                </button>
              }
            >
              <div className="form-info">
                Subject assignments are managed through
                the Academic Assignment workflow. This
                tab will be connected to that module after
                its integration is finalized.
              </div>

              {subjects.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-description">
                    No subjects found for this
                    department.
                  </p>
                </div>
              ) : (
                <div className="permission-list">
                  {subjects.map((subject) => (
                    <label
                      key={subject._id}
                      className="permission-item"
                    >
                      <input
                        type="checkbox"
                        checked={assignedSubjects.includes(
                          subject._id,
                        )}
                        onChange={() =>
                          toggleSubject(
                            subject._id,
                          )
                        }
                      />

                      <div className="permission-content">
                        <span className="permission-name">
                          {subject.name}
                        </span>

                        <span className="permission-description">
                          {subject.code} ·{" "}
                          {
                            subject.creditHours
                          }{" "}
                          credit hours
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              TAB: CLASS ASSIGNMENT
          ═════════════════════════════════════════════════════════════════ */}

          {activeTab === "classes" && (
            <Panel
              title="Class Assignment"
              description={`Classes available in ${
                selectedTeacher?.department
                  ?.name ||
                "this department"
              }.`}
              actions={
                <button
                  className="btn btn-primary"
                  onClick={
                    handleSaveClasses
                  }
                >
                  Save
                </button>
              }
            >
              <div className="form-info">
                Class assignments are managed through
                the Academic Assignment workflow. This
                tab will be connected to that module after
                its integration is finalized.
              </div>

              {classes.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state-description">
                    No classes found for this
                    department.
                  </p>
                </div>
              ) : (
                <div className="permission-list">
                  {classes.map(
                    (academicClass) => (
                      <label
                        key={academicClass._id}
                        className="permission-item"
                      >
                        <input
                          type="checkbox"
                          checked={assignedClasses.includes(
                            academicClass._id,
                          )}
                          onChange={() =>
                            toggleClass(
                              academicClass._id,
                            )
                          }
                        />

                        <div className="permission-content">
                          <span className="permission-name">
                            {
                              academicClass.name
                            }{" "}
                            —{" "}
                            {
                              academicClass.section
                            }
                          </span>

                          <span className="permission-description">
                            Semester{" "}
                            {
                              academicClass.semester
                            }{" "}
                            ·{" "}
                            {
                              academicClass
                                .program
                                ?.name || "—"
                            }
                          </span>
                        </div>
                      </label>
                    ),
                  )}
                </div>
              )}
            </Panel>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              TAB: DOCUMENTS
          ═════════════════════════════════════════════════════════════════ */}

          {activeTab === "documents" && (
            <Panel title="Education Documents">
              {selectedTeacher
                ?.educationDocuments
                ?.length > 0 ? (
                <div className="document-list">
                  {selectedTeacher.educationDocuments.map(
                    (document, index) => (
                      <div
                        key={index}
                        className="document-item"
                      >
                        <div className="document-info">
                          <span className="document-icon">
                            📄
                          </span>

                          <span className="document-name">
                            {document.name}
                          </span>
                        </div>

                        {document.fileUrl && (
                          <a
                            href={
                              document.fileUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            View File
                          </a>
                        )}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    📂
                  </div>

                  <p className="empty-state-description">
                    No documents uploaded yet.
                  </p>
                </div>
              )}
            </Panel>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              TAB: SECURITY
          ═════════════════════════════════════════════════════════════════ */}

          {activeTab === "security" && (
            <Panel title="Security Controls">
              <DetailGrid
                columns={1}
                items={[
                  {
                    label: "Account Status",
                    value: (
                      <span
                        className={statusClass(
                          selectedTeacher?.status,
                        )}
                      >
                        {
                          selectedTeacher?.status
                        }
                      </span>
                    ),
                  },
                ]}
              />

              <div className="section-spacing">
                <div className="form-group">
                  <label className="form-label">
                    Account Status
                  </label>

                  <div className="validation-actions">
                    <button
                      className={`btn ${
                        selectedTeacher?.status ===
                        "active"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      disabled={
                        selectedTeacher?.status ===
                        "active"
                      }
                      onClick={() =>
                        handleStatusChange(
                          "active",
                        )
                      }
                    >
                      Activate
                    </button>

                    <button
                      className={`btn ${
                        selectedTeacher?.status ===
                        "suspended"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      disabled={
                        selectedTeacher?.status ===
                        "suspended"
                      }
                      onClick={() =>
                        handleStatusChange(
                          "suspended",
                        )
                      }
                    >
                      Suspend
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Faculty Role
                  </label>

                  <div className="validation-actions">
                    <button
                      className={`btn ${
                        selectedTeacher?.role ===
                        "junior"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      disabled={
                        selectedTeacher?.role ===
                        "junior"
                      }
                      onClick={() =>
                        handleRoleChange(
                          "junior",
                        )
                      }
                    >
                      Junior
                    </button>

                    <button
                      className={`btn ${
                        selectedTeacher?.role ===
                        "senior"
                          ? "btn-primary"
                          : "btn-secondary"
                      }`}
                      disabled={
                        selectedTeacher?.role ===
                        "senior"
                      }
                      onClick={() =>
                        handleRoleChange(
                          "senior",
                        )
                      }
                    >
                      Senior
                    </button>
                  </div>
                </div>
              </div>

              <div className="danger-zone">
                <div className="form-group">
                  <label className="form-label">
                    Danger Zone
                  </label>

                  <button
                    className="btn btn-danger"
                    onClick={handleDelete}
                  >
                    Delete Teacher
                  </button>

                  <p className="danger-zone-description">
                    This permanently removes the
                    teacher record and the linked
                    teacher login account. This action
                    cannot be undone.
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </Drawer>
    </div>
  );
}