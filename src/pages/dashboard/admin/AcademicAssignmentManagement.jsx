import { useEffect, useMemo, useRef, useState } from "react";

import { DataTable } from "../../../components/ui/DataTable.jsx";
import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import { getClasses } from "../../../services/classService.js";
import {
    createAssignment,
    deactivateAssignment,
    getAssignments,
    updateAssignment,
} from "../../../services/academicAssignmentService.js";
import { getSubjects } from "../../../services/subjectService.js";
import { getTeachers } from "../../../services/teacherService.js";

const EMPTY_FORM = {
    teacher: "",
    session: "",
    classSection: "",
    subject: "",
    isActive: true,
};

const PAGE_SIZE = 100;

const getRelationId = (relation) => {
    const id = typeof relation === "object" ? relation?._id : relation;
    return id ? String(id) : "";
};

const getAssignmentLabel = (assignment) => {
    const teacher = assignment.teacher?.name || "Unknown teacher";
    const subject = assignment.subject?.name || "Unknown subject";
    const classSection = assignment.classSection;
    const classLabel = classSection
        ? `${classSection.name} — ${classSection.section}`
        : "Unknown class";

    return { teacher, subject, classLabel };
};

async function fetchAllActiveTeachers() {
    const firstResponse = await getTeachers({
        page: 1,
        limit: PAGE_SIZE,
        status: "active",
    });
    const firstPage = firstResponse.data;
    const pages = Number(firstPage.pagination?.pages);

    if (!Array.isArray(firstPage.teachers) || !Number.isInteger(pages) || pages < 0) {
        throw new Error("The teacher list returned an unexpected response.");
    }

    const teachers = [...firstPage.teachers];

    for (let page = 2; page <= pages; page += 1) {
        const response = await getTeachers({
            page,
            limit: PAGE_SIZE,
            status: "active",
        });

        if (!Array.isArray(response.data.teachers)) {
            throw new Error("A teacher list page returned an unexpected response.");
        }

        teachers.push(...response.data.teachers);
    }

    return teachers.filter((teacher) => teacher.status === "active");
}

export default function AcademicAssignmentManagement() {
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [classes, setClasses] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [editingAssignmentId, setEditingAssignmentId] = useState("");
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [assignmentsLoading, setAssignmentsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [loadError, setLoadError] = useState("");
    const [assignmentLoadError, setAssignmentLoadError] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const submittingRef = useRef(false);

    const loadAssignments = async () => {
        setAssignmentLoadError("");
        const response = await getAssignments();

        if (!Array.isArray(response.data.assignments)) {
            throw new Error("The assignment list returned an unexpected response.");
        }

        setAssignments(response.data.assignments);
    };

    useEffect(() => {
        let isMounted = true;

        const loadPageData = async () => {
            setLoading(true);
            setLoadError("");

            try {
                const [loadedTeachers, subjectsResponse, classesResponse] =
                    await Promise.all([
                        fetchAllActiveTeachers(),
                        getSubjects(),
                        getClasses(),
                    ]);

                if (
                    !Array.isArray(subjectsResponse.data.subjects) ||
                    !Array.isArray(classesResponse.data.classes)
                ) {
                    throw new Error("Academic reference data returned an unexpected response.");
                }

                if (!isMounted) return;

                setTeachers(loadedTeachers);
                setSubjects(subjectsResponse.data.subjects);
                setClasses(classesResponse.data.classes);
            } catch (error) {
                if (isMounted) {
                    setLoadError(
                        error.response?.data?.message ||
                            error.message ||
                            "Failed to load assignment form data.",
                    );
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadPageData();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        getAssignments()
            .then((response) => {
                if (!Array.isArray(response.data.assignments)) {
                    throw new Error("The assignment list returned an unexpected response.");
                }
                if (isMounted) setAssignments(response.data.assignments);
            })
            .catch((error) => {
                if (isMounted) {
                    setAssignmentLoadError(
                        error.response?.data?.message ||
                            error.message ||
                            "Failed to load assignments.",
                    );
                }
            })
            .finally(() => {
                if (isMounted) setAssignmentsLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const selectedTeacher = teachers.find(
        (teacher) => String(teacher._id) === form.teacher,
    );
    const teacherDepartmentId = getRelationId(selectedTeacher?.department);

    const availableClasses = useMemo(
        () =>
            teacherDepartmentId
                ? classes.filter(
                      (classSection) =>
                          getRelationId(classSection.department) ===
                          teacherDepartmentId,
                  )
                : [],
        [classes, teacherDepartmentId],
    );

    const selectedClass = availableClasses.find(
        (classSection) => String(classSection._id) === form.classSection,
    );
    const selectedProgramId = getRelationId(selectedClass?.program);

    const availableSubjects = useMemo(
        () =>
            teacherDepartmentId && selectedProgramId
                ? subjects.filter(
                      (subject) =>
                          getRelationId(subject.department) ===
                              teacherDepartmentId &&
                          getRelationId(subject.program) === selectedProgramId,
                  )
                : [],
        [subjects, teacherDepartmentId, selectedProgramId],
    );

    const handleTeacherChange = (event) => {
        setForm({
            ...EMPTY_FORM,
            teacher: event.target.value,
            session: form.session,
            isActive: form.isActive,
        });
        setSubmitError("");
        setSuccessMessage("");
    };

    const handleClassChange = (event) => {
        setForm((current) => ({
            ...current,
            classSection: event.target.value,
            subject: "",
        }));
        setSubmitError("");
        setSuccessMessage("");
    };

    const cancelEdit = () => {
        setEditingAssignmentId("");
        setForm(EMPTY_FORM);
        setSubmitError("");
        setSuccessMessage("");
    };

    const beginEdit = (assignment) => {
        setEditingAssignmentId(assignment._id);
        setForm({
            teacher: getRelationId(assignment.teacher),
            subject: getRelationId(assignment.subject),
            classSection: getRelationId(assignment.classSection),
            session: assignment.session || "",
            isActive: Boolean(assignment.isActive),
        });
        setSubmitError("");
        setSuccessMessage("");
        setAssignmentLoadError("");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submittingRef.current) return;

        submittingRef.current = true;
        setSubmitting(true);
        setSubmitError("");
        setSuccessMessage("");

        try {
            const assignmentData = {
                teacher: form.teacher,
                subject: form.subject,
                classSection: form.classSection,
                session: form.session.trim(),
                ...(editingAssignmentId ? { isActive: form.isActive } : {}),
            };
            if (editingAssignmentId) {
                await updateAssignment(editingAssignmentId, assignmentData);
            } else {
                await createAssignment(assignmentData);
            }

            const wasEditing = Boolean(editingAssignmentId);
            setEditingAssignmentId("");
            setForm(EMPTY_FORM);
            setSuccessMessage(
                wasEditing
                    ? "Academic assignment updated successfully."
                    : "Academic assignment created successfully.",
            );

            try {
                await loadAssignments();
            } catch (error) {
                setAssignmentLoadError(
                    error.response?.data?.message ||
                        error.message ||
                        `Assignment was ${wasEditing ? "updated" : "created"}, but the list could not be refreshed.`,
                );
            }
        } catch (error) {
            setSubmitError(
                error.response?.data?.message ||
                    "Failed to create the academic assignment.",
            );
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    const handleDeactivate = async (assignment) => {
        if (submittingRef.current || !assignment.isActive) return;
        if (
            !window.confirm(
                `Deactivate the assignment for ${getAssignmentLabel(assignment).subject} in ${getAssignmentLabel(assignment).classLabel}? Historical records will be retained.`,
            )
        ) {
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setSubmitError("");
        setSuccessMessage("");
        try {
            await deactivateAssignment(assignment._id);
            setSuccessMessage("Academic assignment deactivated successfully.");
            try {
                await loadAssignments();
            } catch (error) {
                setAssignmentLoadError(
                    error.response?.data?.message ||
                        error.message ||
                        "Assignment was deactivated, but the list could not be refreshed.",
                );
            }
        } catch (error) {
            setSubmitError(
                error.response?.data?.message ||
                    "Failed to deactivate the academic assignment.",
            );
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
    };

    const columns = [
        {
            key: "teacher",
            label: "Teacher",
            render: (_, assignment) => getAssignmentLabel(assignment).teacher,
        },
        {
            key: "subject",
            label: "Subject",
            render: (_, assignment) => getAssignmentLabel(assignment).subject,
        },
        {
            key: "classSection",
            label: "Class / Section",
            render: (_, assignment) => getAssignmentLabel(assignment).classLabel,
        },
        {
            key: "session",
            label: "Session",
        },
        {
            key: "isActive",
            label: "Status",
            render: (isActive) => (
                <span className={`status ${isActive ? "status-active" : "status-suspended"}`}>
                    {isActive ? "Active" : "Inactive"}
                </span>
            ),
        },
    ];

    return (
        <div className="dashboard-page admin-page">
            <PageHeader
                title="Academic Assignment Management"
                description="Assign active teachers to subjects, class sections, and academic sessions."
            />

            <Panel
                title={
                    editingAssignmentId
                        ? "Edit Academic Assignment"
                        : "Create Assignment"
                }
            >
                {loadError && (
                    <div className="alert alert-error" role="alert">
                        <div className="alert-content">
                            <p className="alert-message">{loadError}</p>
                        </div>
                    </div>
                )}

                {successMessage && (
                    <div className="alert alert-success" role="status">
                        <div className="alert-content">
                            <p className="alert-message">{successMessage}</p>
                        </div>
                    </div>
                )}

                {submitError && (
                    <div className="alert alert-error" role="alert">
                        <div className="alert-content">
                            <p className="alert-message">{submitError}</p>
                        </div>
                    </div>
                )}

                <form className="form-stack" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="assignment-teacher">
                            Teacher
                        </label>
                        <select
                            id="assignment-teacher"
                            className="form-select"
                            value={form.teacher}
                            onChange={handleTeacherChange}
                            disabled={loading || submitting || Boolean(loadError)}
                            required
                        >
                            <option value="">Select Teacher</option>
                            {teachers.map((teacher) => (
                                <option key={teacher._id} value={teacher._id}>
                                    {teacher.name} — {teacher.registrationNo}
                                </option>
                            ))}
                        </select>
                        {selectedTeacher && !teacherDepartmentId && (
                            <p className="form-help">
                                No department is assigned to this teacher.
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="assignment-session">
                            Academic Session
                        </label>
                        <input
                            id="assignment-session"
                            className="form-input"
                            type="text"
                            value={form.session}
                            onChange={(event) => {
                                setForm((current) => ({
                                    ...current,
                                    session: event.target.value,
                                }));
                                setSubmitError("");
                                setSuccessMessage("");
                            }}
                            placeholder="e.g. 2025-2026"
                            disabled={loading || submitting}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="assignment-class">
                            Class / Section
                        </label>
                        <select
                            id="assignment-class"
                            className="form-select"
                            value={form.classSection}
                            onChange={handleClassChange}
                            disabled={
                                loading ||
                                submitting ||
                                !form.teacher ||
                                Boolean(loadError)
                            }
                            required
                        >
                            <option value="">Select Class / Section</option>
                            {availableClasses.map((classSection) => (
                                <option key={classSection._id} value={classSection._id}>
                                    {classSection.name} — {classSection.section} (Semester{" "}
                                    {classSection.semester})
                                </option>
                            ))}
                        </select>
                        {selectedTeacher &&
                            teacherDepartmentId &&
                            availableClasses.length === 0 && (
                                <p className="form-help">
                                    No classes are available for this teacher&apos;s department.
                                </p>
                            )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="assignment-subject">
                            Subject
                        </label>
                        <select
                            id="assignment-subject"
                            className="form-select"
                            value={form.subject}
                            onChange={(event) => {
                                setForm((current) => ({
                                    ...current,
                                    subject: event.target.value,
                                }));
                                setSubmitError("");
                                setSuccessMessage("");
                            }}
                            disabled={
                                loading ||
                                submitting ||
                                !form.classSection ||
                                Boolean(loadError)
                            }
                            required
                        >
                            <option value="">Select Subject</option>
                            {availableSubjects.map((subject) => (
                                <option key={subject._id} value={subject._id}>
                                    {subject.name} — {subject.code}
                                </option>
                            ))}
                        </select>
                        {selectedClass && availableSubjects.length === 0 && (
                            <p className="form-help">
                                No subjects are available for this class.
                            </p>
                        )}
                    </div>

                    {editingAssignmentId && (
                        <div className="form-group">
                            <label className="form-label">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(event) => {
                                        setForm((current) => ({
                                            ...current,
                                            isActive: event.target.checked,
                                        }));
                                        setSubmitError("");
                                    }}
                                    disabled={loading || submitting}
                                />{" "}
                                Active assignment
                            </label>
                        </div>
                    )}

                    <div className="form-actions">
                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading || submitting || Boolean(loadError)}
                        >
                            {submitting
                                ? editingAssignmentId
                                    ? "Saving..."
                                    : "Creating..."
                                : editingAssignmentId
                                  ? "Save Changes"
                                  : "Create Assignment"}
                        </button>
                        {editingAssignmentId && (
                            <button
                                className="btn btn-secondary"
                                type="button"
                                onClick={cancelEdit}
                                disabled={submitting}
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </Panel>

            <Panel title="Existing Assignments">
                {assignmentLoadError && (
                    <div className="alert alert-error" role="alert">
                        <div className="alert-content">
                            <p className="alert-message">{assignmentLoadError}</p>
                        </div>
                    </div>
                )}
                {assignmentsLoading ? (
                    <p className="text-body">Loading assignments...</p>
                ) : (
                    <DataTable
                        columns={columns}
                        data={assignments}
                        actions={(assignment) => (
                            <>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    type="button"
                                    onClick={() => beginEdit(assignment)}
                                    disabled={submitting || loading}
                                >
                                    Edit
                                </button>
                                {assignment.isActive && (
                                    <button
                                        className="btn btn-danger btn-sm"
                                        type="button"
                                        onClick={() =>
                                            handleDeactivate(assignment)
                                        }
                                        disabled={submitting}
                                    >
                                        {submitting
                                            ? "Working..."
                                            : "Deactivate"}
                                    </button>
                                )}
                            </>
                        )}
                        emptyMessage="No academic assignments found."
                    />
                )}
            </Panel>
        </div>
    );
}
