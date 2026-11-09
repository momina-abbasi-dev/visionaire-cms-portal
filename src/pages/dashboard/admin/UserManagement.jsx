import { useEffect, useState } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";
import { PermissionList } from "../../../components/ui/PermissionList.jsx";
import { SecurityControls } from "../../../components/ui/SecurityControls.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import Button from "../../../components/ui/Button.jsx";

import {
  createUser,
  getUsers,
  getUserStats,
  updateUser,
  deleteUser,
} from "../../../services/users/userService.js";

import {
  faUserPlus,
  faUserShield,
  faChalkboardTeacher,
  faUserGraduate,
  faUsers,
  faUserCheck,
  faUserLock,
  faTriangleExclamation,
  faCircleInfo,
  faLink,
  faUserGear,
} from "@fortawesome/free-solid-svg-icons";

import "./admin.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_ROLES = [
  { label: "Admin", value: "admin" },
];

const ROLES = [
  ...ACCOUNT_ROLES,
  { label: "Teacher", value: "teacher" },
  { label: "Student", value: "student" },
];

const PERMISSIONS = [
  "Create Users",
  "Edit Users",
  "Delete Users",
  "View Reports",
  "Manage Departments",
  "Manage Subjects",
];

const EMPTY_FORM = {
  name: "",
  email: "",
  cnic: "",
  password: "",
  role: "admin",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getStatusClass = (status) =>
  status === "active" ? "status-active" : "status-suspended";

const getRoleLabel = (role) =>
  ROLES.find((item) => item.value === role)?.label || role || "—";

const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "—");

const getUserProfileType = (user) => {
  if (user?.studentId) {
    return "student";
  }

  if (user?.teacherId) {
    return "teacher";
  }

  return null;
};

const isProfileManagedUser = (user) => {
  if (!user) {
    return false;
  }

  const profileType = getUserProfileType(user);

  if (profileType) {
    return true;
  }

  return user.role === "student" || user.role === "teacher";
};

const getProfileLabel = (user) => {
  const profileType = getUserProfileType(user);

  if (profileType === "student") {
    return "Student Profile";
  }

  if (profileType === "teacher") {
    return "Teacher Profile";
  }

  if (user?.role === "student") {
    return "Student Account";
  }

  if (user?.role === "teacher") {
    return "Teacher Account";
  }

  return "Account Only";
};

const getProfileName = (user) => {
  if (user?.studentId) {
    return user.studentId.name || "Student Profile";
  }

  if (user?.teacherId) {
    return user.teacherId.name || "Teacher Profile";
  }

  return null;
};

const getProfileIdentifier = (user) => {
  if (user?.studentId) {
    return user.studentId.rollNo || null;
  }

  if (user?.teacherId) {
    return user.teacherId.registrationNo || null;
  }

  return null;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function UserManagement() {
  // ── Data ─────────────────────────────────────────────────────────────────

  const [users, setUsers] = useState([]);

  const [userStats, setUserStats] = useState({
    admins: 0,
    teachers: 0,
    students: 0,
    active: 0,
    suspended: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Filters ─────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // ── Drawer / Modal ──────────────────────────────────────────────────────

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // ── Add User ────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // ── Edit User ───────────────────────────────────────────────────────────

  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // ── Roles & Permissions ─────────────────────────────────────────────────

  const [selectedRole, setSelectedRole] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  // ─── Derived User State ─────────────────────────────────────────────────

  const selectedUserIsManagedProfile = isProfileManagedUser(selectedUser);

  const selectedUserProfileType = getUserProfileType(selectedUser);

  const selectedUserProfileLabel = getProfileLabel(selectedUser);

  const selectedUserProfileName = getProfileName(selectedUser);

  const selectedUserProfileIdentifier = getProfileIdentifier(selectedUser);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await getUsers({
        search,
        role: roleFilter,
        status: statusFilter,
      });

      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const res = await getUserStats();

      setUserStats(res.data);
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUserStats();
  }, []);

  // ─── Add User ───────────────────────────────────────────────────────────

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setFormData(EMPTY_FORM);
    setFormError(null);
    setIsAddOpen(true);
  };

  const closeAddModal = () => {
    setIsAddOpen(false);
    setFormError(null);
    setFormData(EMPTY_FORM);
  };

  const handleCreateUser = async () => {
    setFormError(null);

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.cnic.trim() ||
      !formData.password
    ) {
      setFormError("Name, email, CNIC and password are required.");

      return;
    }

    setIsCreating(true);

    try {
      await createUser(formData);

      closeAddModal();

      await Promise.all([fetchUsers(), fetchUserStats()]);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to create user.");
    } finally {
      setIsCreating(false);
    }
  };

  // ─── User Drawer ────────────────────────────────────────────────────────

  const openDrawer = (user) => {
    const managedProfile = isProfileManagedUser(user);

    setSelectedUser(user);
    setActiveTab("overview");
    setIsEditing(false);

    setEditFormData({
      name: user.name || "",
      email: user.email || "",
      cnic: user.cnic || "",
      role: user.role || "admin",
    });

    setSelectedRole(
      managedProfile ? user.role || "" : user.role || "admin",
    );

    setSelectedPermissions([]);

    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedUser(null);
    setIsEditing(false);
    setSelectedPermissions([]);
  };

  // ─── Edit User ──────────────────────────────────────────────────────────

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStartEditing = () => {
    if (selectedUserIsManagedProfile) {
      return;
    }

    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (selectedUserIsManagedProfile) {
      window.alert(
        "Student and Teacher identity information must be managed from their respective modules.",
      );

      return;
    }

    try {
      const res = await updateUser(selectedUser._id, {
        name: editFormData.name,
        email: editFormData.email,
        cnic: editFormData.cnic,
      });

      setSelectedUser(res.data.user);

      setEditFormData({
        name: res.data.user.name || "",
        email: res.data.user.email || "",
        cnic: res.data.user.cnic || "",
        role: res.data.user.role || "admin",
      });

      setIsEditing(false);

      await Promise.all([fetchUsers(), fetchUserStats()]);
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to update user.");
    }
  };

  // ─── Roles & Permissions ────────────────────────────────────────────────

  const handleSaveRole = async () => {
    if (selectedUserIsManagedProfile) {
      window.alert(
        "Student and Teacher roles are managed by their respective profile modules.",
      );

      return;
    }

    if (!ACCOUNT_ROLES.some((role) => role.value === selectedRole)) {
      window.alert(
        "Only the Admin role can be managed from User Management.",
      );

      return;
    }

    try {
      const res = await updateUser(selectedUser._id, {
        role: selectedRole,
      });

      setSelectedUser(res.data.user);

      await Promise.all([fetchUsers(), fetchUserStats()]);

      window.alert("Role updated successfully.");
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to update role.");
    }
  };

  const handlePermissionToggle = (permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((item) => item !== permission)
        : [...prev, permission],
    );
  };

  // ─── Security ───────────────────────────────────────────────────────────

  const handleSuspend = async () => {
    if (!selectedUser) {
      return;
    }

    if (!window.confirm("Suspend this user?")) {
      return;
    }

    try {
      const res = await updateUser(selectedUser._id, {
        status: "suspended",
      });

      setSelectedUser(res.data.user);

      await Promise.all([fetchUsers(), fetchUserStats()]);
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to suspend user.");
    }
  };

  const handleActivate = async () => {
    if (!selectedUser) {
      return;
    }

    if (!window.confirm("Activate this user?")) {
      return;
    }

    try {
      const res = await updateUser(selectedUser._id, {
        status: "active",
      });

      setSelectedUser(res.data.user);

      await Promise.all([fetchUsers(), fetchUserStats()]);
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to activate user.");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) {
      return;
    }

    const newPassword = window.prompt("Enter new password for this user:");

    if (!newPassword) {
      return;
    }

    try {
      await updateUser(selectedUser._id, {
        password: newPassword,
      });

      window.alert("Password reset successfully.");
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to reset password.");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) {
      return;
    }

    if (selectedUserIsManagedProfile) {
      window.alert(
        "Student and Teacher accounts cannot be deleted from User Management. Suspend the account instead.",
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete user "${selectedUser.name}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(selectedUser._id);

      closeDrawer();

      await Promise.all([fetchUsers(), fetchUserStats()]);
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to delete user.");
    }
  };

  // ─── Table Configuration ────────────────────────────────────────────────

  const userColumns = [
    {
      key: "name",
      label: "Name",
      className: "table-cell-primary",
    },
    {
      key: "cnic",
      label: "CNIC",
    },
    {
      key: "email",
      label: "Email",
    },
    {
      key: "role",
      label: "Role",
      render: (value) => (
        <span className="table-cell-secondary">{getRoleLabel(value)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value) => (
        <span className={`status ${getStatusClass(value)}`}>
          {value || "Unknown"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created Date",
      render: (value) => formatDate(value),
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page">
      {/* Header */}

      <PageHeader
        title="User Management"
        description="Manage system users, roles, and account security"
        action={
          <Button
            size="sm"
            icon={<FontAwesomeIcon icon={faUserPlus} />}
            onClick={openAddModal}
          >
            Add User
          </Button>
        }
      />

      {/* Add User Modal */}

      <Modal
        isOpen={isAddOpen}
        title="Add New User"
        description="Create an account-only user and assign an administrative role."
        size="md"
        onClose={closeAddModal}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={closeAddModal}
              disabled={isCreating}
            >
              Cancel
            </Button>

            <Button onClick={handleCreateUser} disabled={isCreating}>
              {isCreating ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <form
          id="add-user-form"
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateUser();
          }}
        >
          {formError && <div className="form-error">{formError}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="user-name">
              Full Name
            </label>

            <input
              id="user-name"
              className="form-input"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-email">
              Email
            </label>

            <input
              id="user-email"
              className="form-input"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-cnic">
              CNIC
            </label>

            <input
              id="user-cnic"
              className="form-input"
              type="text"
              name="cnic"
              value={formData.cnic}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-password">
              Password
            </label>

            <input
              id="user-password"
              className="form-input"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleFormChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-role">
              Role
            </label>

            <select
              id="user-role"
              className="form-select"
              name="role"
              value={formData.role}
              onChange={handleFormChange}
            >
              {ACCOUNT_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-help">
            Student and Teacher accounts are created from their respective
            management modules so their profile and login account remain
            synchronized.
          </div>
        </form>
      </Modal>

      {/* Summary */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Admins"
          value={userStats.admins}
          icon={faUserShield}
        />

        <SummaryCard
          title="Teachers"
          value={userStats.teachers}
          icon={faChalkboardTeacher}
        />

        <SummaryCard
          title="Students"
          value={userStats.students}
          icon={faUserGraduate}
        />

        <SummaryCard
          title="Active Users"
          value={userStats.active}
          icon={faUserCheck}
        />

        <SummaryCard
          title="Suspended"
          value={userStats.suspended}
          icon={faUserLock}
        />
      </div>

      {/* Search & Filters */}

      <SearchFilters
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users..."
        filters={[
          {
            label: "Role",
            value: roleFilter,
            onChange: setRoleFilter,
            options: ["All", "admin", "teacher", "student"],
          },
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: ["All", "active", "suspended"],
          },
        ]}
      />

      {/* Loading */}

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">
            <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
          </div>

          <p>Loading users...</p>
        </div>
      )}

      {/* Error */}

      {error && !loading && (
        <div className="error-state">
          <div className="error-state-icon">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
          </div>

          <h2 className="error-state-title">Unable to load users</h2>

          <p className="error-state-description">{error}</p>
        </div>
      )}

      {/* Users Table */}

      {!loading && !error && (
        <Panel title="System Users">
          <DataTable
            columns={userColumns}
            data={users}
            emptyMessage="No users found."
            actions={(row) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openDrawer(row)}
              >
                View
              </Button>
            )}
          />
        </Panel>
      )}

      {/* User Detail Drawer */}

      <Drawer
        isOpen={isDrawerOpen}
        title={selectedUser?.name || "User Detail"}
        onClose={closeDrawer}
        size="lg"
      >
        <Tabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
            },
            {
              id: "roles",
              label: "Roles & Permissions",
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
          {/* Overview */}

          {activeTab === "overview" && (
            <Panel
              title="User Overview"
              actions={
                !selectedUserIsManagedProfile && !isEditing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleStartEditing}
                  >
                    Edit
                  </Button>
                ) : !selectedUserIsManagedProfile && isEditing ? (
                  <div className="user-detail-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </Button>

                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                  </div>
                ) : null
              }
            >
              {selectedUserIsManagedProfile ? (
                <div className="form-stack">
                  <div className="section-spacing">
                    <div className="form-group">
                      <label className="form-label">Account Ownership</label>

                      <div className="table-cell-secondary">
                        <FontAwesomeIcon icon={faLink} aria-hidden="true" />{" "}
                        {selectedUserProfileLabel}
                      </div>
                    </div>
                  </div>

                  <DetailGrid
                    columns={2}
                    items={[
                      {
                        label: "Name",
                        value: selectedUser?.name,
                      },
                      {
                        label: "Email",
                        value: selectedUser?.email,
                      },
                      {
                        label: "CNIC",
                        value: selectedUser?.cnic,
                      },
                      {
                        label: "Role",
                        value: getRoleLabel(selectedUser?.role),
                      },
                      {
                        label: "Status",
                        value: (
                          <span
                            className={`status ${getStatusClass(
                              selectedUser?.status,
                            )}`}
                          >
                            {selectedUser?.status}
                          </span>
                        ),
                      },
                      {
                        label: "Created",
                        value: formatDate(selectedUser?.createdAt),
                      },
                      {
                        label: "Last Updated",
                        value: formatDate(selectedUser?.updatedAt),
                      },
                      {
                        label: "Linked Profile",
                        value: selectedUserProfileName || "Profile exists",
                      },
                      ...(selectedUserProfileIdentifier
                        ? [
                            {
                              label:
                                selectedUserProfileType === "student"
                                  ? "Roll No."
                                  : "Registration No.",
                              value: selectedUserProfileIdentifier,
                            },
                          ]
                        : []),
                    ]}
                  />

                  <div className="form-help">
                    Identity information and role are managed from the{" "}
                    {selectedUserProfileType === "student"
                      ? "Student Management"
                      : "Teacher Management"}{" "}
                    module. User Management only controls this account's
                    security.
                  </div>
                </div>
              ) : isEditing ? (
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-user-name">
                      Name
                    </label>

                    <input
                      id="edit-user-name"
                      className="form-input"
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-user-email">
                      Email
                    </label>

                    <input
                      id="edit-user-email"
                      className="form-input"
                      type="email"
                      name="email"
                      value={editFormData.email}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-user-cnic">
                      CNIC
                    </label>

                    <input
                      id="edit-user-cnic"
                      className="form-input"
                      type="text"
                      name="cnic"
                      value={editFormData.cnic}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="form-help">
                    Role is managed separately under Roles & Permissions.
                  </div>
                </div>
              ) : (
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Name",
                      value: selectedUser?.name,
                    },
                    {
                      label: "Email",
                      value: selectedUser?.email,
                    },
                    {
                      label: "CNIC",
                      value: selectedUser?.cnic,
                    },
                    {
                      label: "Role",
                      value: getRoleLabel(selectedUser?.role),
                    },
                    {
                      label: "Account Type",
                      value: "Account Only",
                    },
                    {
                      label: "Status",
                      value: (
                        <span
                          className={`status ${getStatusClass(
                            selectedUser?.status,
                          )}`}
                        >
                          {selectedUser?.status}
                        </span>
                      ),
                    },
                    {
                      label: "Created",
                      value: formatDate(selectedUser?.createdAt),
                    },
                    {
                      label: "Last Updated",
                      value: formatDate(selectedUser?.updatedAt),
                    },
                  ]}
                />
              )}
            </Panel>
          )}

          {/* Roles & Permissions */}

          {activeTab === "roles" && (
            <Panel
              title="Roles & Permissions"
              actions={
                !selectedUserIsManagedProfile ? (
                  <Button size="sm" onClick={handleSaveRole}>
                    Save Role
                  </Button>
                ) : null
              }
            >
              {selectedUserIsManagedProfile ? (
                <div className="form-stack">
                  <DetailGrid
                    columns={1}
                    items={[
                      {
                        label: "Current Role",
                        value: getRoleLabel(selectedUser?.role),
                      },
                      {
                        label: "Account Owner",
                        value: selectedUserProfileLabel,
                      },
                    ]}
                  />

                  <div className="form-help">
                    <FontAwesomeIcon icon={faUserGear} aria-hidden="true" />{" "}
                    This role is controlled by the linked{" "}
                    {selectedUserProfileType === "student"
                      ? "Student"
                      : "Teacher"}{" "}
                    profile. Change the role only through that profile's
                    management workflow.
                  </div>
                </div>
              ) : (
                <div className="form-stack">
                  <div className="form-group">
                    <label className="form-label" htmlFor="assign-user-role">
                      Assign Role
                    </label>

                    <select
                      id="assign-user-role"
                      className="form-select"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                    >
                      {ACCOUNT_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Permissions</label>

                    <PermissionList
                      permissions={PERMISSIONS}
                      selectedPermissions={selectedPermissions}
                      onChange={handlePermissionToggle}
                    />
                  </div>

                  <div className="section-spacing">
                    <DetailGrid
                      columns={1}
                      items={[
                        {
                          label: "Current Role",
                          value: getRoleLabel(selectedUser?.role),
                        },
                      ]}
                    />
                  </div>

                  <div className="form-help">
                    Permissions are currently displayed for the administration
                    interface only. They are not persisted as backend access
                    rules yet.
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* Security */}

          {activeTab === "security" && (
            <Panel title="Security Controls">
              <SecurityControls
                status={selectedUser?.status}
                onSuspend={handleSuspend}
                onActivate={handleActivate}
                onResetPassword={handleResetPassword}
                onDelete={
                  selectedUserIsManagedProfile ? undefined : handleDeleteUser
                }
              />

              {selectedUserIsManagedProfile && (
                <div className="form-help section-spacing">
                  <FontAwesomeIcon icon={faLink} aria-hidden="true" /> This
                  account is linked to a{" "}
                  {selectedUserProfileType === "student"
                    ? "Student"
                    : "Teacher"}{" "}
                  profile. It cannot be deleted from User Management. Suspend
                  the account if login access needs to be disabled.
                </div>
              )}
            </Panel>
          )}
        </div>
      </Drawer>
    </div>
  );
}
