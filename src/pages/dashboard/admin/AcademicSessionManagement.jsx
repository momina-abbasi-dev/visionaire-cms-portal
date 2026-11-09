import { useCallback, useEffect, useRef, useState } from "react";

import Button from "../../../components/ui/Button.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import {
    createAcademicSession,
    getAcademicSessions,
    updateAcademicSession,
} from "../../../services/academicSessionService.js";

const EMPTY_FORM = {
    name: "",
    startDate: "",
    endDate: "",
    status: "planned",
};

const STATUS_OPTIONS = ["planned", "active", "completed"];

const toDateInputValue = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return [
        date.getUTCFullYear().toString().padStart(4, "0"),
        (date.getUTCMonth() + 1).toString().padStart(2, "0"),
        date.getUTCDate().toString().padStart(2, "0"),
    ].join("-");
};

const formatDate = (value) => {
    const dateValue = toDateInputValue(value);
    if (!dateValue) return "—";
    const [year, month, day] = dateValue.split("-");
    return `${month}/${day}/${year}`;
};

const formatTimestamp = (value) =>
    value ? new Date(value).toLocaleString() : "—";

export default function AcademicSessionManagement() {
    const [sessions, setSessions] = useState([]);
    const [statusFilter, setStatusFilter] = useState("All");
    const [searchValue, setSearchValue] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const requestSequence = useRef(0);

    const loadSessions = useCallback(async () => {
        const currentRequest = ++requestSequence.current;
        setLoading(true);
        setError("");

        try {
            const params =
                statusFilter === "All" ? {} : { status: statusFilter };
            const response = await getAcademicSessions(params);
            if (currentRequest === requestSequence.current) {
                if (!Array.isArray(response.data.sessions)) {
                    throw new Error("The academic session list response was invalid.");
                }
                setSessions(response.data.sessions);
            }
        } catch (loadError) {
            if (currentRequest === requestSequence.current) {
                setError(
                    loadError.response?.data?.message ||
                        loadError.message ||
                        "Failed to load academic sessions.",
                );
            }
        } finally {
            if (currentRequest === requestSequence.current) setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const openCreateModal = () => {
        setEditingSession(null);
        setForm(EMPTY_FORM);
        setFormError("");
        setIsModalOpen(true);
    };

    const openEditModal = (session) => {
        setEditingSession(session);
        setForm({
            name: session.name || "",
            startDate: toDateInputValue(session.startDate),
            endDate: toDateInputValue(session.endDate),
            status: session.status || "planned",
        });
        setFormError("");
        setIsModalOpen(true);
    };

    const closeModal = () => {
        if (saving) return;
        setIsModalOpen(false);
        setEditingSession(null);
        setForm(EMPTY_FORM);
        setFormError("");
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
        setFormError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;

        if (form.startDate > form.endDate) {
            setFormError("End date must be on or after the start date.");
            return;
        }

        if (
            editingSession?.status === "completed" &&
            form.status === "active" &&
            !window.confirm("Reactivate this completed academic session?")
        ) {
            return;
        }

        setSaving(true);
        setFormError("");
        setSuccess("");

        try {
            const data = {
                name: form.name,
                startDate: form.startDate,
                endDate: form.endDate,
                status: form.status,
            };
            if (editingSession) {
                await updateAcademicSession(editingSession._id, data);
                setSuccess("Academic session updated successfully.");
            } else {
                await createAcademicSession(data);
                setSuccess("Academic session created successfully.");
            }
            setIsModalOpen(false);
            setEditingSession(null);
            setForm(EMPTY_FORM);
            await loadSessions();
        } catch (submitError) {
            setFormError(
                submitError.response?.data?.message ||
                    "Failed to save the academic session.",
            );
        } finally {
            setSaving(false);
        }
    };

    const columns = [
        { key: "name", label: "Session Name", className: "table-cell-primary" },
        { key: "startDate", label: "Start Date", render: formatDate },
        { key: "endDate", label: "End Date", render: formatDate },
        {
            key: "status",
            label: "Status",
            render: (status) => (
                <span
                    className={`status ${
                        status === "active"
                            ? "status-active"
                            : status === "completed"
                              ? "status-success"
                              : "status-pending"
                    }`}
                >
                    {status?.charAt(0).toUpperCase() + status?.slice(1)}
                </span>
            ),
        },
        {
            key: "createdBy",
            label: "Created By",
            render: (user) => user?.name || "—",
        },
        {
            key: "createdAt",
            label: "Created At",
            render: formatTimestamp,
        },
        {
            key: "updatedBy",
            label: "Updated By",
            render: (user) => user?.name || "—",
        },
        {
            key: "updatedAt",
            label: "Updated At",
            render: formatTimestamp,
        },
    ];

    const visibleSessions = sessions.filter((session) =>
        session.name
            ?.toLowerCase()
            .includes(searchValue.trim().toLowerCase()),
    );

    return (
        <div className="dashboard-page admin-page">
            <PageHeader
                title="Academic Session Management"
                description="Create and manage institution-defined academic periods."
                action={
                    <Button size="sm" onClick={openCreateModal}>
                        Create Session
                    </Button>
                }
            />

            {success && (
                <div className="alert alert-success" role="status">
                    <div className="alert-content">
                        <p className="alert-message">{success}</p>
                    </div>
                </div>
            )}

            <SearchFilters
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                searchPlaceholder="Search academic sessions..."
                filters={[
                    {
                        id: "session-status",
                        label: "Status",
                        value: statusFilter,
                        onChange: setStatusFilter,
                        options: ["All", ...STATUS_OPTIONS],
                    },
                ]}
            />

            <Panel
                title="Academic Sessions"
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={loadSessions}
                        disabled={loading}
                    >
                        {loading ? "Refreshing..." : "Refresh"}
                    </Button>
                }
            >
                {error && (
                    <div className="alert alert-error" role="alert">
                        <div className="alert-content">
                            <p className="alert-message">{error}</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="dashboard-loading">
                        <p>Loading academic sessions...</p>
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={visibleSessions}
                        emptyMessage={
                            error
                                ? "Academic sessions could not be loaded."
                                : searchValue.trim()
                                  ? "No academic sessions match your search."
                                  : "No academic sessions found."
                        }
                        actions={(session) => (
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditModal(session)}
                            >
                                Edit
                            </Button>
                        )}
                    />
                )}
            </Panel>

            <Modal
                isOpen={isModalOpen}
                title={editingSession ? "Edit Academic Session" : "Create Academic Session"}
                description="Session dates are stored as UTC calendar dates."
                onClose={closeModal}
                actions={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeModal}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="academic-session-form"
                            disabled={saving}
                        >
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </>
                }
            >
                <form
                    id="academic-session-form"
                    className="form-stack"
                    onSubmit={handleSubmit}
                >
                    {formError && (
                        <div className="form-error" role="alert">
                            {formError}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="academic-session-name">
                            Session Name
                        </label>
                        <input
                            id="academic-session-name"
                            className="form-input"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="academic-session-start">
                            Start Date
                        </label>
                        <input
                            id="academic-session-start"
                            className="form-input"
                            type="date"
                            name="startDate"
                            value={form.startDate}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="academic-session-end">
                            End Date
                        </label>
                        <input
                            id="academic-session-end"
                            className="form-input"
                            type="date"
                            name="endDate"
                            value={form.endDate}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="academic-session-status">
                            Status
                        </label>
                        <select
                            id="academic-session-status"
                            className="form-select"
                            name="status"
                            value={form.status}
                            onChange={handleChange}
                            required
                        >
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
