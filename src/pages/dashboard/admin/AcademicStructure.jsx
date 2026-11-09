
import { useState, useEffect, useMemo } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { AcademicTree } from "../../../components/ui/AcademicTree.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import {
  getAcademicStructureStats,
  getRelationshipTree,
} from "../../../services/academicStructureService.js";

import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../../services/departmentService.js";

import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} from "../../../services/programService.js";

import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
} from "../../../services/classService.js";

import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from "../../../services/subjectService.js";

import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_DEPT = {
  name: "",
  code: "",
  description: "",
  totalSeats: "",
  availableSeats: "",
};

const EMPTY_PROGRAM = {
  name: "",
  duration: "",
  totalSeats: "",
  availableSeats: "",
  department: "",
};

const EMPTY_SUBJECT = {
  name: "",
  code: "",
  creditHours: "",
  program: "",
  department: "",
};

const EMPTY_CLASS = {
  name: "",
  section: "",
  semester: "",
  program: "",
  department: "",
};

const TAB_OPTIONS = [
  { id: "departments", label: "Departments" },
  { id: "programs", label: "Programs" },
  { id: "classes", label: "Classes" },
  { id: "subjects", label: "Subjects" },
  { id: "tree", label: "Relationship Tree" },
];

const ADD_LABELS = {
  departments: "Add Department",
  programs: "Add Program",
  classes: "Add Class",
  subjects: "Add Subject",
};

const PANEL_TITLES = {
  departments: "Department Management",
  programs: "Program Management",
  classes: "Class & Section Management",
  subjects: "Subject Management",
};

const validateSeatFields = (form) => {
  if (
    form.totalSeats === "" ||
    form.totalSeats === undefined ||
    form.availableSeats === "" ||
    form.availableSeats === undefined
  ) {
    return "Total Seats and Available Seats are required.";
  }

  const totalSeats = Number(form.totalSeats);
  const availableSeats = Number(form.availableSeats);

  if (
    !Number.isInteger(totalSeats) ||
    !Number.isInteger(availableSeats) ||
    totalSeats < 0 ||
    availableSeats < 0
  ) {
    return "Seat values must be non-negative whole numbers.";
  }

  if (availableSeats > totalSeats) {
    return "Available Seats cannot exceed Total Seats.";
  }

  return "";
};

const validateClassFields = (form) => {
  if (!form.name?.trim()) {
    return "Class name is required.";
  }

  if (!form.section?.trim()) {
    return "Section is required.";
  }

  if (
    form.semester === "" ||
    form.semester === undefined ||
    !Number.isInteger(Number(form.semester)) ||
    Number(form.semester) < 1
  ) {
    return "Semester must be a positive whole number.";
  }

  if (!form.department || !form.program) {
    return "Please select both a department and a program.";
  }

  const departmentId =
    typeof form.department === "object"
      ? form.department?._id
      : form.department;

  const programDepartmentId =
    typeof form.program === "object"
      ? form.program?.department?._id || form.program?.department
      : null;

  if (
    programDepartmentId &&
    String(programDepartmentId) !== String(departmentId)
  ) {
    return "The selected program does not belong to this department.";
  }

  return "";
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AcademicStructure() {
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tree, setTree] = useState([]);

  const [stats, setStats] = useState({
    departments: 0,
    programs: 0,
    classes: 0,
    subjects: 0,
    teachers: 0,
    students: 0,
  });

  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("departments");
  const [search, setSearch] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({});
  const [addError, setAddError] = useState(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [expandedDepts, setExpandedDepts] = useState({});
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchStats = async () => {
    setStatsLoading(true);

    try {
      const response = await getAcademicStructureStats();
      const data = response.data?.stats || response.data || {};

      setStats({
        departments: data.departments ?? 0,
        programs: data.programs ?? 0,
        classes: data.classes ?? 0,
        subjects: data.subjects ?? 0,
        teachers: data.teachers ?? 0,
        students: data.students ?? 0,
      });
    } catch (err) {
      console.error("Failed to fetch academic structure stats.", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchDepartments = async () => {
    const response = await getDepartments();
    setDepartments(response.data?.departments || response.data || []);
  };

  const fetchPrograms = async () => {
    const response = await getPrograms();
    setPrograms(response.data?.programs || response.data || []);
  };

  const fetchClasses = async () => {
    const response = await getClasses();
    setClasses(response.data?.classes || response.data || []);
  };

  const fetchSubjects = async () => {
    const response = await getSubjects();
    setSubjects(response.data?.subjects || response.data || []);
  };

  const fetchTree = async () => {
    const response = await getRelationshipTree();
    setTree(response.data?.tree || response.data || []);
  };

  const fetchTab = async (tab) => {
    setLoading(true);
    setError(null);

    try {
      switch (tab) {
        case "departments":
          await fetchDepartments();
          break;
        case "programs":
          await fetchPrograms();
          break;
        case "classes":
          await fetchClasses();
          break;
        case "subjects":
          await fetchSubjects();
          break;
        case "tree":
          await fetchTree();
          break;
        default:
          break;
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load academic structure data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab]);

  // Load dropdown data only when a form needs it.
  useEffect(() => {
    if (!isAddOpen && !isDrawerOpen) return;

    const preloadDropdownData = async () => {
      try {
        const requests = [];

        if (departments.length === 0) {
          requests.push(fetchDepartments());
        }

        if (programs.length === 0) {
          requests.push(fetchPrograms());
        }

        await Promise.all(requests);
      } catch (err) {
        console.error("Failed to load form dropdown data.", err);
      }
    };

    preloadDropdownData();
  }, [isAddOpen, isDrawerOpen]);

  // ─── Relationship helpers ──────────────────────────────────────────────────

  const getDepartmentId = (department) => {
    if (!department) return "";
    return typeof department === "object"
      ? department._id || ""
      : department;
  };

  const getProgramId = (program) => {
    if (!program) return "";
    return typeof program === "object" ? program._id || "" : program;
  };

  const addDepartmentId = getDepartmentId(addForm.department);
  const editDepartmentId = getDepartmentId(editForm.department);

  const filteredAddPrograms = useMemo(() => {
    if (!addDepartmentId) return [];

    return programs.filter(
      (program) =>
        getDepartmentId(program.department) === addDepartmentId
    );
  }, [programs, addDepartmentId]);

  const filteredEditPrograms = useMemo(() => {
    if (!editDepartmentId) return [];

    return programs.filter(
      (program) =>
        getDepartmentId(program.department) === editDepartmentId
    );
  }, [programs, editDepartmentId]);

  // ─── Add handlers ───────────────────────────────────────────────────────────

  const openAdd = () => {
    const defaults = {
      departments: EMPTY_DEPT,
      programs: EMPTY_PROGRAM,
      subjects: EMPTY_SUBJECT,
      classes: EMPTY_CLASS,
    };

    setAddForm({ ...(defaults[activeTab] || {}) });
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddChange = (event) => {
    const { name, value } = event.target;

    setAddForm((previous) => {
      const next = { ...previous, [name]: value };

      if (name === "department") {
        if (activeTab === "subjects" || activeTab === "classes") {
          next.program = "";
        }
      }

      return next;
    });
  };

  const handleAdd = async (event) => {
    event?.preventDefault();
    setAddError(null);

    if (activeTab === "departments") {
      const validationError = validateSeatFields(addForm);

      if (validationError) {
        setAddError(validationError);
        return;
      }
    }

    if (activeTab === "classes") {
      const validationError = validateClassFields(addForm);

      if (validationError) {
        setAddError(validationError);
        return;
      }
    }

    try {
      if (activeTab === "departments") {
        await createDepartment({
          ...addForm,
          totalSeats: Number(addForm.totalSeats),
          availableSeats: Number(addForm.availableSeats),
        });
      } else if (activeTab === "programs") {
        await createProgram({
          ...addForm,
          duration: Number(addForm.duration),
          totalSeats: Number(addForm.totalSeats),
          availableSeats: Number(addForm.availableSeats),
        });
      } else if (activeTab === "subjects") {
        await createSubject({
          ...addForm,
          creditHours: Number(addForm.creditHours),
        });
      } else if (activeTab === "classes") {
        await createClass({
          name: addForm.name.trim(),
          section: addForm.section.trim(),
          semester: Number(addForm.semester),
          program: getProgramId(addForm.program),
          department: getDepartmentId(addForm.department),
        });
      }

      setIsAddOpen(false);
      setAddForm({});
      await fetchTab(activeTab);
      await fetchStats();
    } catch (err) {
      setAddError(
        err.response?.data?.message ||
          "Failed to create academic structure record."
      );
    }
  };

  // ─── Drawer and editing handlers ────────────────────────────────────────────

  const openDrawer = (row) => {
    setSelected(row);
    setIsEditing(false);
    setError(null);

    setEditForm({
      ...row,
      department: getDepartmentId(row.department),
      program: getProgramId(row.program),
    });

    setIsDrawerOpen(true);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => {
      const next = { ...previous, [name]: value };

      if (
        name === "department" &&
        (activeTab === "classes" || activeTab === "subjects")
      ) {
        next.program = "";
      }

      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!selected?._id) return;

    setError(null);

    if (activeTab === "departments") {
      const validationError = validateSeatFields(editForm);

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (activeTab === "classes") {
      const validationError = validateClassFields(editForm);

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    try {
      let response;

      if (activeTab === "departments") {
        response = await updateDepartment(selected._id, {
          ...editForm,
          totalSeats: Number(editForm.totalSeats),
          availableSeats: Number(editForm.availableSeats),
        });
      } else if (activeTab === "programs") {
        response = await updateProgram(selected._id, {
          ...editForm,
          duration: Number(editForm.duration),
          totalSeats: Number(editForm.totalSeats),
          availableSeats: Number(editForm.availableSeats),
        });
      } else if (activeTab === "subjects") {
        response = await updateSubject(selected._id, {
          ...editForm,
          creditHours: Number(editForm.creditHours),
        });
      } else if (activeTab === "classes") {
        response = await updateClass(selected._id, {
          name: editForm.name.trim(),
          section: editForm.section.trim(),
          semester: Number(editForm.semester),
          program: getProgramId(editForm.program),
          department: getDepartmentId(editForm.department),
        });
      } else {
        return;
      }

      const updatedRecord =
        response?.data?.department ||
        response?.data?.program ||
        response?.data?.subject ||
        response?.data?.class ||
        response?.data;

      await fetchTab(activeTab);
      await fetchStats();

      setSelected((previous) => ({
        ...previous,
        ...editForm,
        ...(updatedRecord || {}),
      }));

      setIsEditing(false);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to update academic structure record."
      );
    }
  };

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Delete "${row.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      if (activeTab === "departments") {
        await deleteDepartment(row._id);
      } else if (activeTab === "programs") {
        await deleteProgram(row._id);
      } else if (activeTab === "subjects") {
        await deleteSubject(row._id);
      } else if (activeTab === "classes") {
        await deleteClass(row._id);
      }

      if (selected?._id === row._id) {
        setSelected(null);
        setIsDrawerOpen(false);
      }

      await fetchTab(activeTab);
      await fetchStats();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to delete academic structure record."
      );
    }
  };

  // ─── Relationship tree handlers ─────────────────────────────────────────────

  const toggleDept = (id) => {
    setExpandedDepts((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const toggleProgram = (id) => {
    setExpandedPrograms((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const toggleClass = (id) => {
    setExpandedClasses((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  // ─── Add form fields ────────────────────────────────────────────────────────

  const renderAddFields = () => {
    if (activeTab === "departments") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Department Name</label>
            <input className="form-input" name="name" value={addForm.name || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" name="code" placeholder="e.g. CS" value={addForm.code || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" name="description" value={addForm.description || ""} onChange={handleAddChange} rows="3" />
          </div>

          <div className="form-group">
            <label className="form-label">Total Seats</label>
            <input className="form-input" type="number" name="totalSeats" value={addForm.totalSeats || ""} onChange={handleAddChange} min="0" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Available Seats</label>
            <input className="form-input" type="number" name="availableSeats" value={addForm.availableSeats || ""} onChange={handleAddChange} min="0" step="1" required />
          </div>
        </>
      );
    }

    if (activeTab === "programs") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Program Name</label>
            <input className="form-input" name="name" value={addForm.name || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Duration (Years)</label>
            <input className="form-input" type="number" name="duration" value={addForm.duration || ""} onChange={handleAddChange} min="1" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Total Seats</label>
            <input className="form-input" type="number" name="totalSeats" value={addForm.totalSeats || ""} onChange={handleAddChange} min="0" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Available Seats</label>
            <input className="form-input" type="number" name="availableSeats" value={addForm.availableSeats || ""} onChange={handleAddChange} min="0" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={addForm.department || ""} onChange={handleAddChange} required>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }

    if (activeTab === "subjects") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Subject Name</label>
            <input className="form-input" name="name" value={addForm.name || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" name="code" placeholder="e.g. CS101" value={addForm.code || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Credit Hours</label>
            <input className="form-input" type="number" name="creditHours" value={addForm.creditHours || ""} onChange={handleAddChange} min="1" max="6" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={addForm.department || ""} onChange={handleAddChange} required>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Program</label>
            <select className="form-select" name="program" value={addForm.program || ""} onChange={handleAddChange} required disabled={!addForm.department}>
              <option value="">
                {addForm.department ? "Select Program" : "Select Department First"}
              </option>
              {filteredAddPrograms.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }

    if (activeTab === "classes") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Class Name</label>
            <input className="form-input" name="name" value={addForm.name || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Section</label>
            <input className="form-input" name="section" placeholder="e.g. A" value={addForm.section || ""} onChange={handleAddChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Semester</label>
            <input className="form-input" type="number" name="semester" value={addForm.semester || ""} onChange={handleAddChange} min="1" step="1" required />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={addForm.department || ""} onChange={handleAddChange} required>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Program</label>
            <select className="form-select" name="program" value={addForm.program || ""} onChange={handleAddChange} required disabled={!addForm.department}>
              <option value="">
                {addForm.department ? "Select Program" : "Select Department First"}
              </option>
              {filteredAddPrograms.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }

    return null;
  };

  // ─── Edit form fields ───────────────────────────────────────────────────────

  const renderEditFields = () => {
    if (activeTab === "departments") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" name="name" value={editForm.name || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" name="code" value={editForm.code || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" name="description" value={editForm.description || ""} onChange={handleEditChange} rows="3" />
          </div>

          <div className="form-group">
            <label className="form-label">Total Seats</label>
            <input className="form-input" type="number" name="totalSeats" value={editForm.totalSeats ?? ""} onChange={handleEditChange} min="0" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Available Seats</label>
            <input className="form-input" type="number" name="availableSeats" value={editForm.availableSeats ?? ""} onChange={handleEditChange} min="0" step="1" />
          </div>
        </>
      );
    }

    if (activeTab === "programs") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" name="name" value={editForm.name || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Duration (Years)</label>
            <input className="form-input" type="number" name="duration" value={editForm.duration ?? ""} onChange={handleEditChange} min="1" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Total Seats</label>
            <input className="form-input" type="number" name="totalSeats" value={editForm.totalSeats ?? ""} onChange={handleEditChange} min="0" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Available Seats</label>
            <input className="form-input" type="number" name="availableSeats" value={editForm.availableSeats ?? ""} onChange={handleEditChange} min="0" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={editForm.department || ""} onChange={handleEditChange}>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
            <small className="form-help">
              Moving a program with dependent records will be rejected by the server.
            </small>
          </div>
        </>
      );
    }

    if (activeTab === "subjects") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" name="name" value={editForm.name || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Code</label>
            <input className="form-input" name="code" value={editForm.code || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Credit Hours</label>
            <input className="form-input" type="number" name="creditHours" value={editForm.creditHours ?? ""} onChange={handleEditChange} min="1" max="6" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={editForm.department || ""} onChange={handleEditChange}>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Program</label>
            <select className="form-select" name="program" value={editForm.program || ""} onChange={handleEditChange} disabled={!editForm.department}>
              <option value="">
                {editForm.department ? "Select Program" : "Select Department First"}
              </option>
              {filteredEditPrograms.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
            <small className="form-help">
              Relationship changes may be rejected if academic assignments already exist.
            </small>
          </div>
        </>
      );
    }

    if (activeTab === "classes") {
      return (
        <>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" name="name" value={editForm.name || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Section</label>
            <input className="form-input" name="section" value={editForm.section || ""} onChange={handleEditChange} />
          </div>

          <div className="form-group">
            <label className="form-label">Semester</label>
            <input className="form-input" type="number" name="semester" value={editForm.semester ?? ""} onChange={handleEditChange} min="1" step="1" />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" name="department" value={editForm.department || ""} onChange={handleEditChange}>
              <option value="">Select Department</option>
              {departments.map((department) => (
                <option key={department._id} value={department._id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Program</label>
            <select className="form-select" name="program" value={editForm.program || ""} onChange={handleEditChange} disabled={!editForm.department}>
              <option value="">
                {editForm.department ? "Select Program" : "Select Department First"}
              </option>
              {filteredEditPrograms.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    }

    return null;
  };

  // ─── Detail drawer data ─────────────────────────────────────────────────────

  const getDetailItems = () => {
    if (!selected) return [];

    const formatDate = (value) =>
      value ? new Date(value).toLocaleDateString() : "—";

    if (activeTab === "departments") {
      return [
        { label: "Name", value: selected.name },
        { label: "Code", value: selected.code },
        { label: "Description", value: selected.description || "—" },
        { label: "Total Seats", value: selected.totalSeats },
        { label: "Available Seats", value: selected.availableSeats },
        { label: "Created", value: formatDate(selected.createdAt) },
      ];
    }

    if (activeTab === "programs") {
      return [
        { label: "Name", value: selected.name },
        { label: "Duration", value: `${selected.duration} year(s)` },
        {
          label: "Department",
          value: selected.department?.name || selected.department || "—",
        },
        { label: "Total Seats", value: selected.totalSeats },
        { label: "Available Seats", value: selected.availableSeats },
        { label: "Created", value: formatDate(selected.createdAt) },
      ];
    }

    if (activeTab === "subjects") {
      return [
        { label: "Name", value: selected.name },
        { label: "Code", value: selected.code },
        { label: "Credit Hours", value: selected.creditHours },
        {
          label: "Department",
          value: selected.department?.name || selected.department || "—",
        },
        {
          label: "Program",
          value: selected.program?.name || selected.program || "—",
        },
        { label: "Created", value: formatDate(selected.createdAt) },
      ];
    }

    if (activeTab === "classes") {
      return [
        { label: "Name", value: selected.name },
        { label: "Section", value: selected.section },
        { label: "Semester", value: selected.semester },
        {
          label: "Department",
          value: selected.department?.name || selected.department || "—",
        },
        {
          label: "Program",
          value: selected.program?.name || selected.program || "—",
        },
        { label: "Created", value: formatDate(selected.createdAt) },
      ];
    }

    return [];
  };

  // ─── Table configuration ───────────────────────────────────────────────────

  const tableConfig = {
    departments: {
      columns: [
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "totalSeats", label: "Total Seats" },
        { key: "availableSeats", label: "Available Seats" },
        {
          key: "createdAt",
          label: "Created Date",
          render: (value) => value ? new Date(value).toLocaleDateString() : "—",
        },
      ],
      data: departments,
    },

    programs: {
      columns: [
        { key: "name", label: "Name" },
        { key: "duration", label: "Duration", render: (value) => `${value} yrs` },
        {
          key: "department",
          label: "Department",
          render: (value) => value?.name || "—",
        },
        { key: "totalSeats", label: "Total Seats" },
        { key: "availableSeats", label: "Available Seats" },
        {
          key: "createdAt",
          label: "Created Date",
          render: (value) => value ? new Date(value).toLocaleDateString() : "—",
        },
      ],
      data: programs,
    },

    classes: {
      columns: [
        { key: "name", label: "Class" },
        { key: "section", label: "Section" },
        { key: "semester", label: "Semester" },
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
      ],
      data: classes,
    },

    subjects: {
      columns: [
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "creditHours", label: "Credit Hours" },
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
      ],
      data: subjects,
    },
  };

  const currentTable = tableConfig[activeTab];

  const filteredData = useMemo(() => {
    if (!currentTable) return [];

    const data = currentTable.data || [];
    const query = search.trim().toLowerCase();

    if (!query) return data;

    return data.filter((item) => {
      const searchableValues = [
        item.name,
        item.code,
        item.section,
        item.description,
        item.department?.name,
        item.program?.name,
      ];

      return searchableValues.some((value) =>
        String(value || "").toLowerCase().includes(query)
      );
    });
  }, [currentTable, search, departments, programs, classes, subjects]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page">
      <PageHeader
        title="Academic Structure"
        description="Manage departments, programs, classes, subjects, and academic relationships."
        action={
          activeTab !== "tree" ? (
            <button className="btn btn-primary btn-sm" onClick={openAdd}>
              <FontAwesomeIcon icon={faPlus} />
              {ADD_LABELS[activeTab]}
            </button>
          ) : null
        }
      />

      <Modal
        isOpen={isAddOpen}
        title={ADD_LABELS[activeTab] || "Add Record"}
        description={`Create a new ${
          activeTab === "departments"
            ? "department"
            : activeTab === "programs"
              ? "program"
              : activeTab === "classes"
                ? "class"
                : "subject"
        }.`}
        size="md"
        onClose={() => setIsAddOpen(false)}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="academic-add-form"
              className="btn btn-primary"
            >
              Save
            </button>
          </>
        }
      >
        <form
          id="academic-add-form"
          onSubmit={handleAdd}
          className="form-stack"
        >
          {addError && <div className="form-error">{addError}</div>}
          {renderAddFields()}
        </form>
      </Modal>

      <div className="summary-card-grid">
        <SummaryCard title="Departments" value={stats.departments} loading={statsLoading} />
        <SummaryCard title="Programs" value={stats.programs} loading={statsLoading} />
        <SummaryCard title="Classes" value={stats.classes} loading={statsLoading} />
        <SummaryCard title="Subjects" value={stats.subjects} loading={statsLoading} />
        <SummaryCard title="Teachers" value={stats.teachers} loading={statsLoading} />
        <SummaryCard title="Students" value={stats.students} loading={statsLoading} />
      </div>

      <Tabs
        tabs={TAB_OPTIONS}
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setSearch("");
          setError(null);
        }}
      />

      {activeTab !== "tree" && (
        <SearchFilters
          searchValue={search}
          onSearchChange={setSearch}
          filters={[]}
        />
      )}

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">Loading</div>
          <p>Loading academic structure...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <div className="error-state-icon">!</div>
          <h2 className="error-state-title">Unable to complete the request</h2>
          <p className="error-state-description">{error}</p>
        </div>
      )}

      {activeTab !== "tree" && currentTable && (
        <Panel title={PANEL_TITLES[activeTab]}>
          <DataTable
            columns={currentTable.columns}
            data={filteredData}
            actions={(row) => (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openDrawer(row)}
                >
                  View
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(row)}
                >
                  Delete
                </button>
              </>
            )}
          />
        </Panel>
      )}

      {activeTab === "tree" && (
        <Panel
          title="Academic Relationship Tree"
          description="Explore the hierarchy: Department → Program → Classes / Sections."
        >
          <AcademicTree
            tree={tree}
            expandedDepts={expandedDepts}
            expandedPrograms={expandedPrograms}
            expandedClasses={expandedClasses}
            onToggleDept={toggleDept}
            onToggleProgram={toggleProgram}
            onToggleClass={toggleClass}
          />
        </Panel>
      )}

      <Drawer
        isOpen={isDrawerOpen}
        title={selected?.name || "Academic Detail"}
        onClose={() => {
          setIsDrawerOpen(false);
          setIsEditing(false);
          setError(null);
        }}
      >
        <Panel
          title={`${PANEL_TITLES[activeTab] || "Details"} Overview`}
          actions={
            !isEditing ? (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => selected && handleDelete(selected)}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    setEditForm({
                      ...selected,
                      department: getDepartmentId(selected?.department),
                      program: getProgramId(selected?.program),
                    });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveEdit}
                >
                  Save
                </button>
              </>
            )
          }
        >
          {error && <div className="form-error">{error}</div>}

          {!isEditing ? (
            <DetailGrid columns={2} items={getDetailItems()} />
          ) : (
            <div className="form-stack">{renderEditFields()}</div>
          )}
        </Panel>
      </Drawer>
    </div>
  );
}