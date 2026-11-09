import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import Button from "../../../components/ui/Button.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";

import "./admin.css";

import { getAdminOverview } from "../../../services/dashboardService.js";

import {
    faUserGraduate,
    faChalkboardTeacher,
    faBuilding,
    faSchool,
    faUserPlus,
    faFileInvoiceDollar,
    faTriangleExclamation,
    faClipboardCheck,
    faLayerGroup,
    faUsers,
    faGraduationCap,
    faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


// ── Helpers ────────────────────────────────────────────────────────────────────

const timeAgo = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

    return `${Math.floor(diff / 86400)}d ago`;
};


const statusBadge = (value) => {
    const status = String(value || "").toLowerCase();

    const statusClassMap = {
        active: "status-active",
        approved: "status-success",
        verified: "status-success",

        pending: "status-pending",
        processing: "status-warning",

        suspended: "status-suspended",
        rejected: "status-error",
        inactive: "status-error",

        info: "status-info",

        archived: "status-neutral",
        neutral: "status-neutral",
    };

    const statusClass = statusClassMap[status] || "status-neutral";

    return (
        <span className={`status ${statusClass}`}>
            {status || "Unknown"}
        </span>
    );
};

const metricDisplayValue = (value) =>
    value === null || value === undefined ? "Unavailable" : value;

const metricStatusClass = (value, positiveClass) =>
    value === null || value === undefined
        ? "status-neutral"
        : value > 0
          ? positiveClass
          : "status-active";


// ── Component ─────────────────────────────────────────────────────────────────

export default function Overview() {
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOverview = async () => {
            try {
                const res = await getAdminOverview();
                setData(res.data);
            } catch (err) {
                console.error(err);
                setError("Failed to load dashboard.");
            } finally {
                setLoading(false);
            }
        };

        fetchOverview();
    }, []);


    // ── Loading ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="dashboard-loading-icon">
                    <FontAwesomeIcon icon={faCircleInfo} />
                </div>

                <p>Loading dashboard...</p>
            </div>
        );
    }


    // ── Error ─────────────────────────────────────────────────────────────────

    if (error) {
        return (
            <div className="error-state">
                <div className="error-state-icon">
                    <FontAwesomeIcon icon={faTriangleExclamation} />
                </div>

                <h2 className="error-state-title">
                    Unable to load dashboard
                </h2>

                <p className="error-state-description">
                    {error}
                </p>
            </div>
        );
    }


    const {
        summary,
        roleCounts,
        recentStudents,
        recentTeachers,
        recentAdmissions,
        activityFeed,
        alerts,
    } = data;


    // ── Quick Actions ─────────────────────────────────────────────────────────

    const quickActions = [
        {
            icon: faUserPlus,
            label: "Add Student",
            path: "/admin/dashboard/students",
        },
        {
            icon: faChalkboardTeacher,
            label: "Add Teacher",
            path: "/admin/dashboard/teachers",
        },
        {
            icon: faLayerGroup,
            label: "Create Class",
            path: "/admin/dashboard/academic-structure",
        },
        {
            icon: faFileInvoiceDollar,
            label: "Generate Challan",
            path: "/admin/dashboard/fees",
        },
        {
            icon: faUserGraduate,
            label: "New Admission",
            path: "/admin/dashboard/admissions",
        },
        {
            icon: faUsers,
            label: "Manage Users",
            path: "/admin/dashboard/users",
        },
    ];


    // ── Activity Icons ────────────────────────────────────────────────────────

    const getActivityIcon = (type) => {
        const icons = {
            student: faGraduationCap,
            teacher: faChalkboardTeacher,
            admission: faUserPlus,
            finance: faFileInvoiceDollar,
            default: faCircleInfo,
        };

        return icons[type] || icons.default;
    };


    // ── Table Columns ─────────────────────────────────────────────────────────

    const studentColumns = [
        {
            key: "name",
            label: "Name",
            className: "table-cell-primary",
        },
        {
            key: "program",
            label: "Program",
            render: (_, student) => (
                <span className="table-cell-secondary">
                    {student.program?.name || "—"}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (value) => statusBadge(value),
        },
    ];


    const teacherColumns = [
        {
            key: "name",
            label: "Name",
            className: "table-cell-primary",
        },
        {
            key: "department",
            label: "Department",
            render: (_, teacher) => (
                <span className="table-cell-secondary">
                    {teacher.department?.name || "—"}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (value) => statusBadge(value),
        },
    ];


    const admissionColumns = [
        {
            key: "name",
            label: "Name",
            className: "table-cell-primary",
        },
        {
            key: "program",
            label: "Program",
            render: (_, admission) => (
                <span className="table-cell-secondary">
                    {admission.program?.name || "—"}
                </span>
            ),
        },
        {
            key: "status",
            label: "Status",
            render: (value) => statusBadge(value),
        },
    ];


    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="dashboard-page admin-page overview-dashboard">

            <PageHeader
                title="System Overview"
                description="Real-time institutional status and activity snapshot"
            />


            {/* KPI Summary */}

            <div className="overview-kpi-grid">

                <SummaryCard
                    title="Students"
                    value={summary.totalStudents}
                    icon={faUserGraduate}
                />

                <SummaryCard
                    title="Teachers"
                    value={summary.totalTeachers}
                    icon={faChalkboardTeacher}
                />

                <SummaryCard
                    title="Departments"
                    value={summary.totalDepartments}
                    icon={faBuilding}
                />

                <SummaryCard
                    title="Classes"
                    value={summary.totalClasses}
                    icon={faSchool}
                />

                <SummaryCard
                    title="Pending Admissions"
                    value={summary.pendingAdmissions}
                    icon={faUserPlus}
                />

                <SummaryCard
                    title="Unpaid Challans"
                    value={metricDisplayValue(summary.unpaidFees)}
                    icon={faFileInvoiceDollar}
                />

                <SummaryCard
                    title="Overdue Fees"
                    value={metricDisplayValue(summary.overdueFees)}
                    icon={faTriangleExclamation}
                />

                <SummaryCard
                    title="Pending Records"
                    value={metricDisplayValue(summary.pendingRecords)}
                    icon={faClipboardCheck}
                />

            </div>

            {/* System Alerts */}

            {alerts?.length > 0 && (
                <details className="dashboard-alerts">
                    <summary className="dashboard-alerts-summary">
                        <div className="dashboard-alerts-title">
                            <span className="dashboard-alerts-icon">
                                <FontAwesomeIcon
                                    icon={faTriangleExclamation}
                                    aria-hidden="true"
                                />
                            </span>

                            <span>
                                <strong>System Alerts</strong>

                                <small>
                                    {alerts.length} alert
                                    {alerts.length !== 1 ? "s" : ""} require
                                    attention
                                </small>
                            </span>
                        </div>

                        <span className="dashboard-alerts-toggle">
                            View alerts
                        </span>
                    </summary>

                    <div className="dashboard-alerts-list">
                        {alerts.map((alert, index) => (
                            <div
                                key={index}
                                className={`alert alert-${alert.level || "info"}`}
                            >
                                <FontAwesomeIcon
                                    icon={faTriangleExclamation}
                                    aria-hidden="true"
                                />

                                <span>{alert.message}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}


            {/* Main Dashboard Grid */}

            <div className="dashboard-main-grid">

                {/* Left Column */}

                <div className="dashboard-main-column">

                    {/* Recent Data */}

                    <div className="dashboard-preview-grid">

                        {/* Students */}

                        <Panel title="Recent Students">
                            {recentStudents.length === 0 ? (
                                <p className="dashboard-empty">
                                    No students yet.
                                </p>
                            ) : (
                                <DataTable
                                    columns={studentColumns}
                                    data={recentStudents}
                                />
                            )}

                            <Button
                                variant="secondary"
                                size="sm"
                                fullWidth
                                onClick={() =>
                                    navigate("/admin/dashboard/students")
                                }
                            >
                                View All Students
                            </Button>
                        </Panel>


                        {/* Teachers */}

                        <Panel title="Recent Teachers">
                            {recentTeachers.length === 0 ? (
                                <p className="dashboard-empty">
                                    No teachers yet.
                                </p>
                            ) : (
                                <DataTable
                                    columns={teacherColumns}
                                    data={recentTeachers}
                                />
                            )}

                            <Button
                                variant="secondary"
                                size="sm"
                                fullWidth
                                onClick={() =>
                                    navigate("/admin/dashboard/teachers")
                                }
                            >
                                View All Teachers
                            </Button>
                        </Panel>


                        {/* Admissions */}

                        <Panel title="Recent Admissions">
                            {recentAdmissions.length === 0 ? (
                                <p className="dashboard-empty">
                                    No admissions yet.
                                </p>
                            ) : (
                                <DataTable
                                    columns={admissionColumns}
                                    data={recentAdmissions}
                                />
                            )}

                            <Button
                                variant="secondary"
                                size="sm"
                                fullWidth
                                onClick={() =>
                                    navigate("/admin/dashboard/admissions")
                                }
                            >
                                View All Admissions
                            </Button>
                        </Panel>

                    </div>


                    {/* System Status */}

                    <Panel title="System Status">
                        <div className="system-status-grid">

                            <div className="system-status-section">
                                <h3 className="system-status-heading">
                                    Active Counts
                                </h3>

                                {[
                                    [
                                        "Active Students",
                                        summary.activeStudents,
                                        "status-active",
                                    ],
                                    [
                                        "Active Teachers",
                                        summary.activeTeachers,
                                        "status-active",
                                    ],
                                    [
                                        "Suspended Users",
                                        summary.suspendedUsers,
                                        summary.suspendedUsers > 0
                                            ? "status-suspended"
                                            : "status-active",
                                    ],
                                    [
                                        "Total Users",
                                        summary.totalUsers,
                                        "status-neutral",
                                    ],
                                ].map(([label, value, statusClass]) => (
                                    <div
                                        key={label}
                                        className="system-status-row"
                                    >
                                        <span>{label}</span>

                                        <span className={statusClass}>
                                            {value}
                                        </span>
                                    </div>
                                ))}
                            </div>


                            <div className="system-status-section">
                                <h3 className="system-status-heading">
                                    User Roles
                                </h3>

                                {[
                                    [
                                        "Admins",
                                        roleCounts.adminCount,
                                        "status-neutral",
                                    ],
                                    [
                                        "Teachers",
                                        roleCounts.teacherUserCount,
                                        "status-neutral",
                                    ],
                                    [
                                        "Students",
                                        roleCounts.studentUserCount,
                                        "status-neutral",
                                    ],
                                    [
                                        "Admission Staff",
                                        roleCounts.admissionStaffCount,
                                        "status-neutral",
                                    ],
                                ].map(([label, value, statusClass]) => (
                                    <div
                                        key={label}
                                        className="system-status-row"
                                    >
                                        <span>{label}</span>

                                        <span className={statusClass}>
                                            {value}
                                        </span>
                                    </div>
                                ))}
                            </div>


                            <div className="system-status-section">
                                <h3 className="system-status-heading">
                                    Finance Snapshot
                                </h3>

                                {[
                                    [
                                        "Unpaid Challans",
                                        metricDisplayValue(summary.unpaidFees),
                                        metricStatusClass(
                                            summary.unpaidFees,
                                            "status-suspended",
                                        ),
                                    ],
                                    [
                                        "Overdue Challans",
                                        metricDisplayValue(summary.overdueFees),
                                        metricStatusClass(
                                            summary.overdueFees,
                                            "status-suspended",
                                        ),
                                    ],
                                    [
                                        "Students w/ Dues",
                                        metricDisplayValue(summary.studentsWithDues),
                                        metricStatusClass(
                                            summary.studentsWithDues,
                                            "status-suspended",
                                        ),
                                    ],
                                    [
                                        "Pending Records",
                                        metricDisplayValue(summary.pendingRecords),
                                        metricStatusClass(
                                            summary.pendingRecords,
                                            "status-pending",
                                        ),
                                    ],
                                ].map(([label, value, statusClass]) => (
                                    <div
                                        key={label}
                                        className="system-status-row"
                                    >
                                        <span>{label}</span>

                                        <span className={statusClass}>
                                            {value}
                                        </span>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </Panel>

                </div>


                {/* Right Column */}

                <div className="dashboard-side-column">

                    {/* Quick Actions */}

                    <Panel title="Quick Actions">
                        <div className="quick-actions">
                            {quickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    className="quick-action"
                                    onClick={() => navigate(action.path)}
                                >
                                    <span className="quick-action-icon">
                                        <FontAwesomeIcon
                                            icon={action.icon}
                                            aria-hidden="true"
                                        />
                                    </span>

                                    <span className="quick-action-label">
                                        {action.label}
                                    </span>

                                    <span className="quick-action-arrow">
                                        →
                                    </span>
                                </button>
                            ))}
                        </div>
                    </Panel>


                    {/* Activity Feed */}

                    <Panel title="Activity Feed">
                        {activityFeed.length === 0 ? (
                            <p className="dashboard-empty">
                                No recent activity.
                            </p>
                        ) : (
                            <div className="activity-feed">
                                {activityFeed.map((item, index) => (
                                    <div
                                        key={index}
                                        className="activity-item"
                                    >
                                        <div className="activity-icon-wrapper">
                                            <FontAwesomeIcon
                                                icon={getActivityIcon(item.type)}
                                                aria-hidden="true"
                                            />
                                        </div>

                                        <div className="activity-content">
                                            <p className="activity-message">
                                                {item.message}
                                            </p>

                                            <div className="activity-meta">
                                                {item.meta && (
                                                    <span>{item.meta}</span>
                                                )}

                                                {item.meta && <span>·</span>}

                                                <span>
                                                    {timeAgo(item.time)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>

                </div>

            </div>
        </div>
    );
}