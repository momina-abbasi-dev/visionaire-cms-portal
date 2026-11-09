import { useEffect, useRef, useState } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";
import Button from "../../../components/ui/Button.jsx";

import {
  getStudentStats,
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "../../../services/studentService.js";

import { getPrograms } from "../../../services/programService.js";
import { getAcademicSessions } from "../../../services/academicSessionService.js";
import { getClasses } from "../../../services/classService.js";
import {
  closeStudentEnrollment,
  bulkPromoteStudentEnrollments,
  createStudentEnrollment,
  getEligibleStudents,
  getStudentEnrollments,
  promoteStudentEnrollment,
} from "../../../services/studentEnrollmentService.js";

import {
  faUserPlus,
  faUserGraduate,
  faUserCheck,
  faUserLock,
  faUserClock,
  faMoneyBillWave,
  faFileCircleCheck,
  faTriangleExclamation,
  faCircleInfo,
  faFile,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";

import "./admin.css";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  rollNo: "",
  email: "",
  cnic: "",
  contact: "",
  city: "",
  address: "",
  dob: "",
  program: "",
  password: "",
};

const STATUS_OPTIONS = ["All", "active", "suspended", "graduated", "pending"];

const FEE_OPTIONS = ["All", "paid", "partial", "pending"];

const STUDENT_STATUSES = ["active", "suspended", "graduated", "pending"];

const FEE_STATUSES = ["paid", "partial", "pending"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : "—");

const formatStatus = (value) => {
  if (!value) return "—";

  return value.charAt(0).toUpperCase() + value.slice(1);
};

const getStatusClass = (value) => {
  switch (value) {
    case "active":
    case "paid":
      return "status-active";

    case "pending":
    case "partial":
      return "status-pending";

    case "suspended":
      return "status-suspended";

    case "graduated":
      return "status-success";

    default:
      return "status-neutral";
  }
};

const StatusBadge = ({ value }) => (
  <span className={`status ${getStatusClass(value)}`}>
    {formatStatus(value)}
  </span>
);

// ─── Component ───────────────────────────────────────────────────────────────

export default function StudentManagement() {
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    suspendedStudents: 0,
    newAdmissions: 0,
    feeDefaulters: 0,
    pendingDocuments: 0,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    search: "",
    status: "All",
    program: "All",
    feeStatus: "All",
    page: 1,
    limit: 10,
  });

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [enrollmentHistory, setEnrollmentHistory] = useState([]);
  const [enrollmentHistoryLoading, setEnrollmentHistoryLoading] = useState(false);
  const [enrollmentHistoryError, setEnrollmentHistoryError] = useState("");
  const [enrollmentHistoryPagination, setEnrollmentHistoryPagination] = useState({
    page: 1,
    pages: 1,
  });
  const [enrollmentHistoryStudentId, setEnrollmentHistoryStudentId] = useState("");
  const [enrollmentHistoryStudentLabel, setEnrollmentHistoryStudentLabel] =
    useState("");
  const enrollmentHistoryRequestRef = useRef(0);
  const drawerInstanceSequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const enrollmentHistoryContextRef = useRef({
    studentId: "",
    drawerId: "",
    active: false,
  });
  const [enrollmentOptionsLoading, setEnrollmentOptionsLoading] = useState(false);
  const [enrollmentOptionsError, setEnrollmentOptionsError] = useState("");
  const [enrollmentClasses, setEnrollmentClasses] = useState([]);
  const [enrollmentSessions, setEnrollmentSessions] = useState([]);
  const [eligibleStudents, setEligibleStudents] = useState([]);
  const [eligibleStudentsLoading, setEligibleStudentsLoading] = useState(false);
  const [eligibleStudentsError, setEligibleStudentsError] = useState("");
  const [eligiblePage, setEligiblePage] = useState(1);
  const [eligiblePagination, setEligiblePagination] = useState({
    page: 1,
    pages: 1,
  });
  const [eligibilityRefresh, setEligibilityRefresh] = useState(0);
  const [enrollmentForm, setEnrollmentForm] = useState({
    student: "",
    classSection: "",
    academicSession: "",
    startDate: "",
  });
  const [creatingEnrollment, setCreatingEnrollment] = useState(false);
  const [enrollmentCreateError, setEnrollmentCreateError] = useState("");
  const [enrollmentCreateSuccess, setEnrollmentCreateSuccess] = useState("");
  const [enrollmentClosure, setEnrollmentClosure] = useState({
    enrollmentId: "",
    status: "",
    endDate: "",
  });
  const [closingEnrollment, setClosingEnrollment] = useState(false);
  const [enrollmentClosureError, setEnrollmentClosureError] = useState("");
  const [enrollmentClosureSuccess, setEnrollmentClosureSuccess] = useState("");
  const [enrollmentPromotion, setEnrollmentPromotion] = useState({
    enrollmentId: "",
    destinationAcademicSession: "",
    destinationClassSection: "",
    promotionDate: "",
  });
  const [promotingEnrollment, setPromotingEnrollment] = useState(false);
  const [enrollmentPromotionError, setEnrollmentPromotionError] = useState("");
  const [enrollmentPromotionSuccess, setEnrollmentPromotionSuccess] = useState("");
  const [bulkSourceEnrollments, setBulkSourceEnrollments] = useState([]);
  const [bulkSourceLoading, setBulkSourceLoading] = useState(false);
  const [bulkSourceError, setBulkSourceError] = useState("");
  const [bulkSourcePagination, setBulkSourcePagination] = useState({
    page: 1,
    pages: 1,
  });
  const [bulkSourcePage, setBulkSourcePage] = useState(1);
  const [bulkRefresh, setBulkRefresh] = useState(0);
  const [bulkPromotions, setBulkPromotions] = useState([]);
  const [bulkDestinationSession, setBulkDestinationSession] = useState("");
  const [bulkPromotionDate, setBulkPromotionDate] = useState("");
  const [bulkPromotionRunning, setBulkPromotionRunning] = useState(false);
  const [bulkPromotionError, setBulkPromotionError] = useState("");
  const [bulkPromotionSuccess, setBulkPromotionSuccess] = useState("");
  const bulkSourceRequestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      enrollmentHistoryRequestRef.current += 1;
      enrollmentHistoryContextRef.current = {
        studentId: "",
        drawerId: "",
        active: false,
      };
    };
  }, []);

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchStats = async () => {
    try {
      const response = await getStudentStats();
      setStats(response.data);
    } catch (err) {
      console.error("Failed to fetch student stats:", err);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await getPrograms();

      const programData = Array.isArray(response.data)
        ? response.data
        : response.data.programs || [];

      setPrograms(programData);
    } catch (err) {
      console.error("Failed to fetch programs:", err);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page: filters.page,
        limit: filters.limit,
      };

      if (filters.search) {
        params.search = filters.search;
      }

      if (filters.status !== "All") {
        params.status = filters.status;
      }

      if (filters.program !== "All") {
        params.program = filters.program;
      }

      if (filters.feeStatus !== "All") {
        params.feeStatus = filters.feeStatus;
      }

      const response = await getStudents(params);

      setStudents(response.data.students || []);

      setPagination(
        response.data.pagination || {
          total: 0,
          page: 1,
          pages: 1,
        },
      );
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setError("Failed to load students.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEnrollmentHistory = async (studentId, page = 1) => {
    const context = enrollmentHistoryContextRef.current;
    if (!studentId || !context.active || context.studentId !== studentId) return;

    const requestId = ++enrollmentHistoryRequestRef.current;
    const isCurrentRequest = () =>
      mountedRef.current &&
      requestId === enrollmentHistoryRequestRef.current &&
      enrollmentHistoryContextRef.current.active &&
      enrollmentHistoryContextRef.current.drawerId === context.drawerId &&
      enrollmentHistoryContextRef.current.studentId === studentId;

    setEnrollmentHistoryLoading(true);
    setEnrollmentHistoryError("");
    setEnrollmentHistory([]);
    setEnrollmentHistoryPagination({ page: 1, pages: 1 });
    try {
      const response = await getStudentEnrollments({
        student: studentId,
        page,
        limit: 10,
      });
      if (!Array.isArray(response.data.enrollments)) {
        throw new Error("Enrollment history returned an unexpected response.");
      }
      if (!isCurrentRequest()) return;

      setEnrollmentHistory(response.data.enrollments);
      setEnrollmentHistoryPagination(
        response.data.pagination || { page: 1, pages: 1 },
      );
      setEnrollmentHistoryStudentId(studentId);
    } catch (requestError) {
      if (!isCurrentRequest()) return;

      setEnrollmentHistory([]);
      setEnrollmentHistoryError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to load enrollment history.",
      );
    } finally {
      if (isCurrentRequest()) setEnrollmentHistoryLoading(false);
    }
  };

  const loadEnrollmentOptions = async () => {
    setEnrollmentOptionsLoading(true);
    setEnrollmentOptionsError("");
    try {
      const [classesResponse, sessionsResponse] = await Promise.all([
        getClasses(),
        getAcademicSessions(),
      ]);
      if (
        !Array.isArray(classesResponse.data.classes) ||
        !Array.isArray(sessionsResponse.data.sessions)
      ) {
        throw new Error("Enrollment choices returned an unexpected response.");
      }
      if (!mountedRef.current) return;

      setEnrollmentClasses(classesResponse.data.classes);
      setEnrollmentSessions(
        sessionsResponse.data.sessions.filter((session) =>
          ["planned", "active"].includes(session.status),
        ),
      );
    } catch (requestError) {
      if (!mountedRef.current) return;

      setEnrollmentOptionsError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to load enrollment choices.",
      );
    } finally {
      if (mountedRef.current) setEnrollmentOptionsLoading(false);
    }
  };

  useEffect(() => {
    if (!isDrawerOpen || activeTab !== "enrollment") return undefined;

    const requestId = ++bulkSourceRequestRef.current;
    const drawerId = enrollmentHistoryContextRef.current.drawerId;
    const isCurrentRequest = () =>
      mountedRef.current &&
      requestId === bulkSourceRequestRef.current &&
      enrollmentHistoryContextRef.current.active &&
      enrollmentHistoryContextRef.current.drawerId === drawerId;

    setBulkSourceLoading(true);
    setBulkSourceError("");
    getStudentEnrollments({
      status: "active",
      page: bulkSourcePage,
      limit: 100,
    })
      .then((response) => {
        if (!Array.isArray(response.data.enrollments)) {
          throw new Error("Active enrollments returned an unexpected response.");
        }
        if (!isCurrentRequest()) return;

        setBulkSourceEnrollments(response.data.enrollments);
        setBulkSourcePagination(
          response.data.pagination || { page: 1, pages: 1 },
        );
      })
      .catch((requestError) => {
        if (!isCurrentRequest()) return;

        setBulkSourceEnrollments([]);
        setBulkSourceError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Failed to load active enrollments.",
        );
      })
      .finally(() => {
        if (isCurrentRequest()) setBulkSourceLoading(false);
      });

    return () => {
      if (requestId === bulkSourceRequestRef.current) {
        bulkSourceRequestRef.current += 1;
      }
    };
  }, [isDrawerOpen, activeTab, bulkSourcePage, bulkRefresh]);

  const handleCreateEnrollment = async (event) => {
    event.preventDefault();
    if (creatingEnrollment || bulkPromotionRunning) return;

    const submittedDrawerId = enrollmentHistoryContextRef.current.drawerId;
    const isCurrentDrawer = () =>
      mountedRef.current &&
      Boolean(submittedDrawerId) &&
      enrollmentHistoryContextRef.current.drawerId === submittedDrawerId;
    if (!isCurrentDrawer()) return;

    setEnrollmentCreateError("");
    setEnrollmentCreateSuccess("");
    setCreatingEnrollment(true);
    try {
      const response = await createStudentEnrollment(enrollmentForm);
      if (!isCurrentDrawer()) return;

      const createdStudent = response.data.enrollment?.student;
      const historyStudentId = enrollmentForm.student;
      setEnrollmentCreateSuccess("Student enrollment created successfully.");
      if (enrollmentHistoryContextRef.current.active) {
        enrollmentHistoryContextRef.current.studentId = historyStudentId;
        setEnrollmentHistoryStudentId(historyStudentId);
        setEnrollmentHistoryStudentLabel(
          createdStudent
            ? `${createdStudent.name} (${createdStudent.rollNo || "no roll number"})`
            : `Student ${historyStudentId}`,
        );
        await fetchEnrollmentHistory(historyStudentId, 1);
        if (!isCurrentDrawer()) return;
      }
      setEnrollmentForm((current) => ({ ...current, student: "" }));
      setEligiblePage(1);
      setEligibilityRefresh((value) => value + 1);
    } catch (requestError) {
      if (!isCurrentDrawer()) return;
      setEnrollmentCreateError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to create student enrollment.",
      );
    } finally {
      if (isCurrentDrawer()) setCreatingEnrollment(false);
    }
  };

  const handleEnrollmentHistoryPage = (page) => {
    fetchEnrollmentHistory(enrollmentHistoryStudentId, page);
  };

  const handleCloseEnrollment = async (event) => {
    event.preventDefault();
    if (
      closingEnrollment ||
      bulkPromotionRunning ||
      !enrollmentClosure.enrollmentId
    ) return;

    const drawerId = enrollmentHistoryContextRef.current.drawerId;
    const historyStudentId = enrollmentHistoryStudentId;
    const isCurrentDrawer = () =>
      mountedRef.current &&
      Boolean(drawerId) &&
      enrollmentHistoryContextRef.current.drawerId === drawerId &&
      enrollmentHistoryContextRef.current.active &&
      enrollmentHistoryContextRef.current.studentId === historyStudentId;
    if (!isCurrentDrawer()) return;

    if (
      !window.confirm(
        `Confirm ${enrollmentClosure.status} for this enrollment effective ${enrollmentClosure.endDate}?`,
      )
    ) {
      return;
    }

    setClosingEnrollment(true);
    setEnrollmentClosureError("");
    setEnrollmentClosureSuccess("");
    try {
      await closeStudentEnrollment(enrollmentClosure.enrollmentId, {
        status: enrollmentClosure.status,
        endDate: enrollmentClosure.endDate,
      });
      if (!isCurrentDrawer()) return;

      setEnrollmentClosureSuccess(
        `Enrollment ${enrollmentClosure.status} successfully.`,
      );
      setEnrollmentClosure({ enrollmentId: "", status: "", endDate: "" });
      await fetchEnrollmentHistory(
        historyStudentId,
        enrollmentHistoryPagination.page,
      );
    } catch (requestError) {
      if (!isCurrentDrawer()) return;
      setEnrollmentClosureError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to close student enrollment.",
      );
    } finally {
      if (isCurrentDrawer()) setClosingEnrollment(false);
    }
  };

  const handlePromoteEnrollment = async (event) => {
    event.preventDefault();
    if (
      promotingEnrollment ||
      bulkPromotionRunning ||
      !enrollmentPromotion.enrollmentId
    ) return;

    const drawerId = enrollmentHistoryContextRef.current.drawerId;
    const historyStudentId = enrollmentHistoryStudentId;
    const isCurrentDrawer = () =>
      mountedRef.current &&
      Boolean(drawerId) &&
      enrollmentHistoryContextRef.current.drawerId === drawerId &&
      enrollmentHistoryContextRef.current.active &&
      enrollmentHistoryContextRef.current.studentId === historyStudentId;
    if (!isCurrentDrawer()) return;

    if (
      !window.confirm(
        `Promote this Student to the selected ClassSection effective ${enrollmentPromotion.promotionDate}?`,
      )
    ) {
      return;
    }

    setPromotingEnrollment(true);
    setEnrollmentPromotionError("");
    setEnrollmentPromotionSuccess("");
    try {
      await promoteStudentEnrollment(enrollmentPromotion.enrollmentId, {
        destinationAcademicSession:
          enrollmentPromotion.destinationAcademicSession,
        destinationClassSection: enrollmentPromotion.destinationClassSection,
        promotionDate: enrollmentPromotion.promotionDate,
      });
      if (!isCurrentDrawer()) return;

      setEnrollmentPromotionSuccess("Student promoted successfully.");
      setEnrollmentPromotion({
        enrollmentId: "",
        destinationAcademicSession: "",
        destinationClassSection: "",
        promotionDate: "",
      });
      await fetchEnrollmentHistory(
        historyStudentId,
        enrollmentHistoryPagination.page,
      );
    } catch (requestError) {
      if (!isCurrentDrawer()) return;
      setEnrollmentPromotionError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to promote Student.",
      );
    } finally {
      if (isCurrentDrawer()) setPromotingEnrollment(false);
    }
  };

  const handleBulkPromotionSelection = (enrollment, selected) => {
    if (bulkPromotionRunning) return;
    setBulkPromotionError("");
    if (!selected) {
      setBulkPromotions((current) =>
        current.filter(
          (promotion) =>
            promotion.sourceEnrollment !== enrollment._id,
        ),
      );
      return;
    }

    if (
      bulkPromotions.some(
        (promotion) => promotion.sourceEnrollment === enrollment._id,
      )
    ) return;
    if (bulkPromotions.length >= 100) {
      setBulkPromotionError("A batch can include at most 100 enrollments.");
      return;
    }

    const studentId = enrollment.student?._id || enrollment.student;
    if (
      bulkPromotions.some(
        (promotion) => promotion.studentId === studentId,
      )
    ) {
      setBulkPromotionError("A Student can be selected only once per batch.");
      return;
    }

    const sourceSessionId =
      enrollment.academicSession?._id || enrollment.academicSession;
    if (sourceSessionId === bulkDestinationSession) {
      setBulkDestinationSession("");
      setBulkPromotionDate("");
    }
    setBulkPromotions((current) => [
      ...current,
      {
        sourceEnrollment: enrollment._id,
        destinationClassSection: "",
        sourceSessionId,
        studentId,
      },
    ]);
  };

  const handleBulkPromotion = async (event) => {
    event.preventDefault();
    if (
      bulkPromotionRunning ||
      closingEnrollment ||
      promotingEnrollment ||
      bulkPromotions.length === 0
    ) return;

    if (bulkPromotions.length > 100) {
      setBulkPromotionError("A batch can include at most 100 enrollments.");
      return;
    }
    if (
      !bulkDestinationSession ||
      !bulkPromotionDate ||
      bulkPromotions.some(
        (promotion) =>
          !promotion.destinationClassSection ||
          promotion.sourceSessionId === bulkDestinationSession,
      )
    ) {
      setBulkPromotionError(
        "Choose a different destination session, promotion date, and compatible destination ClassSection for every selected Student.",
      );
      return;
    }

    if (
      !window.confirm(
        `Promote ${bulkPromotions.length} Students to the selected AcademicSession effective ${bulkPromotionDate}? This operation succeeds or fails for the entire batch.`,
      )
    ) {
      return;
    }

    const drawerId = enrollmentHistoryContextRef.current.drawerId;
    const historyStudentId = enrollmentHistoryStudentId;
    const selectedPromotions = bulkPromotions.map((promotion) => ({
      sourceEnrollment: promotion.sourceEnrollment,
      destinationClassSection: promotion.destinationClassSection,
    }));
    const selectedStudentIds = new Set(
      bulkPromotions.map((promotion) => promotion.studentId).filter(Boolean),
    );
    const isCurrentDrawer = () =>
      mountedRef.current &&
      Boolean(drawerId) &&
      enrollmentHistoryContextRef.current.drawerId === drawerId;
    if (!isCurrentDrawer()) return;

    setBulkPromotionRunning(true);
    setBulkPromotionError("");
    setBulkPromotionSuccess("");
    try {
      const response = await bulkPromoteStudentEnrollments({
        promotions: selectedPromotions,
        destinationAcademicSession: bulkDestinationSession,
        promotionDate: bulkPromotionDate,
      });
      if (!isCurrentDrawer()) return;

      setBulkPromotionSuccess(
        response.data.message || "Students promoted successfully.",
      );
      setBulkPromotions([]);
      setBulkDestinationSession("");
      setBulkPromotionDate("");
      setBulkSourcePage(1);
      setBulkRefresh((current) => current + 1);
      if (selectedStudentIds.has(historyStudentId)) {
        await fetchEnrollmentHistory(
          historyStudentId,
          enrollmentHistoryPagination.page,
        );
      }
      if (!isCurrentDrawer()) return;
    } catch (requestError) {
      if (!isCurrentDrawer()) return;
      setBulkPromotionError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Failed to promote the selected Students.",
      );
    } finally {
      if (isCurrentDrawer()) setBulkPromotionRunning(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPrograms();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [filters]);

  useEffect(() => {
    if (
      !isDrawerOpen ||
      activeTab !== "enrollment" ||
      !enrollmentForm.classSection ||
      !enrollmentForm.academicSession
    ) {
      setEligibleStudents([]);
      setEligibleStudentsError("");
      setEligibleStudentsLoading(false);
      return undefined;
    }

    let isMounted = true;
    setEligibleStudentsLoading(true);
    setEligibleStudentsError("");
    getEligibleStudents({
      classSection: enrollmentForm.classSection,
      academicSession: enrollmentForm.academicSession,
      page: eligiblePage,
      limit: 100,
    })
      .then((response) => {
        if (!Array.isArray(response.data.eligibleStudents)) {
          throw new Error("Eligible students returned an unexpected response.");
        }
        if (isMounted) {
          setEligibleStudents(response.data.eligibleStudents);
          setEligiblePagination(
            response.data.pagination || { page: 1, pages: 1 },
          );
        }
      })
      .catch((requestError) => {
        if (isMounted) {
          setEligibleStudents([]);
          setEligibleStudentsError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Failed to load eligible students.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setEligibleStudentsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    isDrawerOpen,
    activeTab,
    enrollmentForm.classSection,
    enrollmentForm.academicSession,
    eligiblePage,
    eligibilityRefresh,
  ]);

  // ─── Filters ─────────────────────────────────────────────────────────────

  const setFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  // ─── Add Student ─────────────────────────────────────────────────────────

  const handleAddChange = (e) => {
    const { name, value } = e.target;

    setAddForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setAddForm(EMPTY_FORM);
    setAddError(null);
    setIsAddOpen(true);
  };

  const closeAddModal = () => {
    setIsAddOpen(false);
    setAddForm(EMPTY_FORM);
    setAddError(null);
  };

  const handleAdd = async () => {
    setAddError(null);
    setCreating(true);

    try {
      await createStudent(addForm);

      closeAddModal();

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch (err) {
      setAddError(err.response?.data?.message || "Failed to create student.");
    } finally {
      setCreating(false);
    }
  };

  // ─── Drawer ──────────────────────────────────────────────────────────────

  const openDrawer = (student) => {
    enrollmentHistoryRequestRef.current += 1;
    bulkSourceRequestRef.current += 1;
    const drawerId = ++drawerInstanceSequenceRef.current;
    enrollmentHistoryContextRef.current = {
      studentId: student._id,
      drawerId,
      active: false,
    };
    setSelectedStudent(student);
    setActiveTab("overview");
    setIsEditing(false);
    setEnrollmentHistory([]);
    setEnrollmentHistoryLoading(false);
    setEnrollmentHistoryError("");
    setEnrollmentHistoryStudentId(student._id);
    setEnrollmentHistoryStudentLabel(
      `${student.name} (${student.rollNo || "no roll number"})`,
    );
    setEnrollmentForm({
      student: "",
      classSection: "",
      academicSession: "",
      startDate: "",
    });
    setEnrollmentCreateError("");
    setEnrollmentCreateSuccess("");
    setEnrollmentClosure({ enrollmentId: "", status: "", endDate: "" });
    setEnrollmentClosureError("");
    setEnrollmentClosureSuccess("");
    setEnrollmentPromotion({
      enrollmentId: "",
      destinationAcademicSession: "",
      destinationClassSection: "",
      promotionDate: "",
    });
    setEnrollmentPromotionError("");
    setEnrollmentPromotionSuccess("");
    setBulkSourceEnrollments([]);
    setBulkSourcePage(1);
    setBulkPromotions([]);
    setBulkDestinationSession("");
    setBulkPromotionDate("");
    setBulkPromotionRunning(false);
    setBulkPromotionError("");
    setBulkPromotionSuccess("");
    setCreatingEnrollment(false);
    setEnrollmentOptionsError("");
    setEligiblePage(1);

    setEditForm({
      name: student.name || "",
      email: student.email || "",
      cnic: student.cnic || "",
      contact: student.contact || "",
      city: student.city || "",
      address: student.address || "",
      dob: student.dob ? student.dob.split("T")[0] : "",
      program: student.program?._id || student.program || "",
    });

    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    enrollmentHistoryRequestRef.current += 1;
    bulkSourceRequestRef.current += 1;
    drawerInstanceSequenceRef.current += 1;
    enrollmentHistoryContextRef.current = {
      studentId: "",
      drawerId: "",
      active: false,
    };
    setIsDrawerOpen(false);
    setSelectedStudent(null);
    setIsEditing(false);
    setEnrollmentHistory([]);
    setEnrollmentHistoryLoading(false);
    setEnrollmentHistoryError("");
    setEnrollmentHistoryStudentId("");
    setEnrollmentHistoryStudentLabel("");
    setCreatingEnrollment(false);
    setEnrollmentClosure({ enrollmentId: "", status: "", endDate: "" });
    setEnrollmentClosureError("");
    setEnrollmentClosureSuccess("");
    setClosingEnrollment(false);
    setEnrollmentPromotion({
      enrollmentId: "",
      destinationAcademicSession: "",
      destinationClassSection: "",
      promotionDate: "",
    });
    setEnrollmentPromotionError("");
    setEnrollmentPromotionSuccess("");
    setPromotingEnrollment(false);
    setBulkSourceEnrollments([]);
    setBulkSourceLoading(false);
    setBulkSourceError("");
    setBulkSourcePage(1);
    setBulkPromotions([]);
    setBulkDestinationSession("");
    setBulkPromotionDate("");
    setBulkPromotionRunning(false);
    setBulkPromotionError("");
    setBulkPromotionSuccess("");
  };

  // ─── Edit ────────────────────────────────────────────────────────────────

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    try {
      const response = await updateStudent(selectedStudent._id, editForm);

      setSelectedStudent(response.data.student);
      setIsEditing(false);

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to update student.");
    }
  };

  // ─── Enrollment ──────────────────────────────────────────────────────────

  const handleStudentStatusChange = async (newStatus) => {
    if (!window.confirm(`Change Student status to "${newStatus}"?`)) {
      return;
    }

    try {
      const response = await updateStudent(selectedStudent._id, {
        status: newStatus,
      });
      setSelectedStudent(response.data.student);
      await Promise.all([fetchStudents(), fetchStats()]);
    } catch (requestError) {
      window.alert(
        requestError.response?.data?.message ||
          "Failed to update Student status.",
      );
    }
  };

  const handleFeeStatusChange = async (newFeeStatus) => {
    if (!window.confirm(`Change fee status to "${newFeeStatus}"?`)) {
      return;
    }

    try {
      const response = await updateStudent(selectedStudent._id, {
        feeStatus: newFeeStatus,
      });

      setSelectedStudent(response.data.student);

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch {
      window.alert("Failed to update fee status.");
    }
  };

  const handleProgramTransfer = async (newProgramId) => {
    const currentProgram =
      selectedStudent?.program?._id || selectedStudent?.program;

    if (!newProgramId || newProgramId === currentProgram) {
      return;
    }

    if (
      !window.confirm(
        "Transfer student to the selected program? Seats will be updated.",
      )
    ) {
      return;
    }

    try {
      const response = await updateStudent(selectedStudent._id, {
        program: newProgramId,
      });

      setSelectedStudent(response.data.student);

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch (err) {
      window.alert(
        err.response?.data?.message || "Failed to transfer program.",
      );
    }
  };

  // ─── Documents ───────────────────────────────────────────────────────────

  const handleVerifyDocuments = async () => {
    try {
      const response = await updateStudent(selectedStudent._id, {
        documentsVerified: true,
      });

      setSelectedStudent(response.data.student);

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch {
      window.alert("Failed to verify documents.");
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDeleteStudent = async () => {
    if (
      !window.confirm(
        `Delete "${selectedStudent?.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteStudent(selectedStudent._id);

      closeDrawer();

      await Promise.all([fetchStudents(), fetchStats()]);
    } catch {
      window.alert("Failed to delete student.");
    }
  };

  // ─── Table ───────────────────────────────────────────────────────────────

  const studentColumns = [
    {
      key: "name",
      label: "Name",
      className: "table-cell-primary",
    },
    {
      key: "rollNo",
      label: "Roll No.",
    },
    {
      key: "program",
      label: "Program",
      render: (value) => (
        <span className="table-cell-secondary">{value?.name || "—"}</span>
      ),
    },
    {
      key: "department",
      label: "Department",
      render: (_, row) => (
        <span className="table-cell-secondary">
          {row?.program?.department?.name || "—"}
        </span>
      ),
    },
    {
      key: "contact",
      label: "Contact",
    },
    {
      key: "feeStatus",
      label: "Fee",
      render: (value) => <StatusBadge value={value} />,
    },
    {
      key: "status",
      label: "Status",
      render: (value) => <StatusBadge value={value} />,
    },
  ];

  const selectedEnrollmentSession = enrollmentSessions.find(
    (session) => session._id === enrollmentForm.academicSession,
  );
  const unavailableBulkSessionIds = new Set(
    bulkPromotions.map((promotion) => promotion.sourceSessionId),
  );
  const availableBulkSessions = enrollmentSessions.filter(
    (session) => !unavailableBulkSessionIds.has(session._id),
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page">
      <PageHeader
        title="Student Management"
        description="Manage student records, enrollment, and academic information."
        action={
          <Button
            size="sm"
            icon={<FontAwesomeIcon icon={faUserPlus} />}
            onClick={openAddModal}
          >
            Add Student
          </Button>
        }
      />

      {/* Add Student */}

      <Modal
        isOpen={isAddOpen}
        title="Add New Student"
        description="Create a student record and assign the student to an academic program."
        size="md"
        onClose={closeAddModal}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={closeAddModal}
              disabled={creating}
            >
              Cancel
            </Button>

            <Button onClick={handleAdd} disabled={creating}>
              {creating ? "Creating..." : "Save"}
            </Button>
          </>
        }
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          {addError && <div className="form-error">{addError}</div>}

          {[
            {
              name: "name",
              label: "Full Name",
              type: "text",
            },
            {
              name: "rollNo",
              label: "Roll Number",
              type: "text",
              placeholder: "e.g. 2026-CS-001",
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
              name: "dob",
              label: "Date of Birth",
              type: "date",
            },
            {
              name: "password",
              label: "Login Password",
              type: "password",
              placeholder: "Create student login password",
            },
          ].map((field) => (
            <div key={field.name} className="form-group">
              <label
                className="form-label"
                htmlFor={`add-student-${field.name}`}
              >
                {field.label}
              </label>

              <input
                id={`add-student-${field.name}`}
                className="form-input"
                type={field.type}
                name={field.name}
                placeholder={field.placeholder}
                value={addForm[field.name]}
                onChange={handleAddChange}
                required
              />
            </div>
          ))}

          <div className="form-group">
            <label className="form-label" htmlFor="add-student-program">
              Program
            </label>

            <select
              id="add-student-program"
              className="form-select"
              name="program"
              value={addForm.program}
              onChange={handleAddChange}
              required
            >
              <option value="">Select Program</option>

              {programs.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Summary */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Total Students"
          value={stats.totalStudents}
          icon={faUserGraduate}
        />

        <SummaryCard
          title="Active"
          value={stats.activeStudents}
          icon={faUserCheck}
        />

        <SummaryCard
          title="Suspended"
          value={stats.suspendedStudents}
          icon={faUserLock}
        />

        <SummaryCard
          title="New Admissions"
          value={stats.newAdmissions}
          icon={faUserClock}
        />

        <SummaryCard
          title="Fee Defaulters"
          value={stats.feeDefaulters}
          icon={faMoneyBillWave}
        />

        <SummaryCard
          title="Pending Documents"
          value={stats.pendingDocuments}
          icon={faFileCircleCheck}
        />
      </div>

      {/* Filters */}

      <SearchFilters
        searchValue={filters.search}
        onSearchChange={(value) => setFilter("search", value)}
        searchPlaceholder="Search students..."
        filters={[
          {
            label: "Program",
            value: filters.program,
            onChange: (value) => setFilter("program", value),
            options: ["All", ...programs.map((program) => program._id)],
            optionLabels: ["All", ...programs.map((program) => program.name)],
          },
          {
            label: "Status",
            value: filters.status,
            onChange: (value) => setFilter("status", value),
            options: STATUS_OPTIONS,
          },
          {
            label: "Fee Status",
            value: filters.feeStatus,
            onChange: (value) => setFilter("feeStatus", value),
            options: FEE_OPTIONS,
          },
        ]}
      />

      {/* Loading */}

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-loading-icon">
            <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
          </div>

          <p>Loading students...</p>
        </div>
      )}

      {/* Error */}

      {error && !loading && (
        <div className="error-state">
          <div className="error-state-icon">
            <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />
          </div>

          <h2 className="error-state-title">Unable to load students</h2>

          <p className="error-state-description">{error}</p>
        </div>
      )}

      {/* Students */}

      {!loading && !error && (
        <Panel title="Students">
          <DataTable
            columns={studentColumns}
            data={students}
            emptyMessage="No students found."
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

          {pagination.pages > 1 && (
            <div className="pagination">
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: prev.page - 1,
                  }))
                }
              >
                ← Prev
              </Button>

              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
                students)
              </span>

              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= pagination.pages}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    page: prev.page + 1,
                  }))
                }
              >
                Next →
              </Button>
            </div>
          )}
        </Panel>
      )}

      {/* Student Drawer */}

      <Drawer
        isOpen={isDrawerOpen}
        title={selectedStudent?.name || "Student Detail"}
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
              id: "enrollment",
              label: "Enrollment",
            },
            {
              id: "documents",
              label: "Documents",
            },
          ]}
          activeTab={activeTab}
          onChange={(tab) => {
            enrollmentHistoryRequestRef.current += 1;
            enrollmentHistoryContextRef.current = {
              studentId: selectedStudent?._id || "",
              drawerId: enrollmentHistoryContextRef.current.drawerId,
              active: tab === "enrollment" && Boolean(selectedStudent?._id),
            };
            setActiveTab(tab);
            setIsEditing(false);
            if (tab === "enrollment" && selectedStudent?._id) {
              setEnrollmentHistoryStudentId(selectedStudent._id);
              setEnrollmentHistoryStudentLabel(
                `${selectedStudent.name} (${selectedStudent.rollNo || "no roll number"})`,
              );
              fetchEnrollmentHistory(selectedStudent._id);
              loadEnrollmentOptions();
            } else {
              setEnrollmentHistoryLoading(false);
            }
          }}
        />

        <div className="tab-panel">
          {/* Overview */}

          {activeTab === "overview" && (
            <Panel
              title="Student Profile"
              actions={
                !isEditing ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                ) : (
                  <div className="student-detail-actions">
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
                )
              }
            >
              {!isEditing ? (
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Name",
                      value: selectedStudent?.name,
                    },
                    {
                      label: "Roll No.",
                      value: selectedStudent?.rollNo,
                    },
                    {
                      label: "Email",
                      value: selectedStudent?.email,
                    },
                    {
                      label: "CNIC",
                      value: selectedStudent?.cnic,
                    },
                    {
                      label: "Contact",
                      value: selectedStudent?.contact,
                    },
                    {
                      label: "City",
                      value: selectedStudent?.city,
                    },
                    {
                      label: "Address",
                      value: selectedStudent?.address,
                    },
                    {
                      label: "Date of Birth",
                      value: formatDate(selectedStudent?.dob),
                    },
                    {
                      label: "Program",
                      value: selectedStudent?.program?.name,
                    },
                    {
                      label: "Department",
                      value: selectedStudent?.program?.department?.name,
                    },
                    {
                      label: "Admission Date",
                      value: formatDate(selectedStudent?.dateOfAdmission),
                    },
                    {
                      label: "Created",
                      value: formatDate(selectedStudent?.createdAt),
                    },
                    {
                      label: "Status",
                      value: <StatusBadge value={selectedStudent?.status} />,
                    },
                    {
                      label: "Fee Status",
                      value: <StatusBadge value={selectedStudent?.feeStatus} />,
                    },
                    {
                      label: "Documents Verified",
                      value: (
                        <span
                          className={`status ${
                            selectedStudent?.documentsVerified
                              ? "status-active"
                              : "status-pending"
                          }`}
                        >
                          {selectedStudent?.documentsVerified
                            ? "Verified"
                            : "Pending"}
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
                      name: "dob",
                      label: "Date of Birth",
                      type: "date",
                    },
                  ].map((field) => (
                    <div key={field.name} className="form-group">
                      <label
                        className="form-label"
                        htmlFor={`edit-student-${field.name}`}
                      >
                        {field.label}
                      </label>

                      <input
                        id={`edit-student-${field.name}`}
                        className="form-input"
                        name={field.name}
                        type={field.type}
                        value={editForm[field.name] || ""}
                        onChange={handleEditChange}
                      />
                    </div>
                  ))}

                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="edit-student-program"
                    >
                      Program
                    </label>

                    <select
                      id="edit-student-program"
                      className="form-select"
                      name="program"
                      value={editForm.program || ""}
                      onChange={handleEditChange}
                    >
                      <option value="">Select Program</option>

                      {programs.map((program) => (
                        <option key={program._id} value={program._id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* Enrollment */}

          {activeTab === "enrollment" && (
            <div className="section-spacing">
              <Panel title="Bulk Student Promotion">
                <p className="text-body">
                  Select active enrollments to promote together. The complete
                  batch is committed atomically, and each Student must remain
                  in the same Program.
                </p>
                {bulkPromotionError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{bulkPromotionError}</p>
                  </div>
                )}
                {bulkPromotionSuccess && (
                  <div className="alert alert-success" role="status">
                    <p className="alert-message">{bulkPromotionSuccess}</p>
                  </div>
                )}
                {bulkSourceError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{bulkSourceError}</p>
                  </div>
                )}
                <p className="form-help">
                  Selected enrollments: {bulkPromotions.length} / 100
                </p>
                <form className="form-stack" onSubmit={handleBulkPromotion}>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="bulk-promotion-session"
                    >
                      Destination Academic Session
                    </label>
                    <select
                      id="bulk-promotion-session"
                      className="form-select"
                      value={bulkDestinationSession}
                      onChange={(event) => {
                        setBulkDestinationSession(event.target.value);
                        setBulkPromotionDate("");
                        setBulkPromotionError("");
                      }}
                      disabled={bulkPromotionRunning}
                      required
                    >
                      <option value="">Select destination session</option>
                      {availableBulkSessions.map((session) => (
                        <option key={session._id} value={session._id}>
                          {session.name} — {formatStatus(session.status)}
                        </option>
                      ))}
                    </select>
                    {bulkPromotions.length > 0 &&
                      availableBulkSessions.length === 0 && (
                        <p className="form-help">
                          No destination session differs from every selected
                          source session.
                        </p>
                      )}
                  </div>
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="bulk-promotion-date"
                    >
                      Promotion Date
                    </label>
                    <input
                      id="bulk-promotion-date"
                      className="form-input"
                      type="date"
                      min={
                        enrollmentSessions
                          .find(
                            (session) =>
                              session._id === bulkDestinationSession,
                          )
                          ?.startDate?.slice(0, 10) || undefined
                      }
                      max={
                        enrollmentSessions
                          .find(
                            (session) =>
                              session._id === bulkDestinationSession,
                          )
                          ?.endDate?.slice(0, 10) || undefined
                      }
                      value={bulkPromotionDate}
                      onChange={(event) => {
                        setBulkPromotionDate(event.target.value);
                        setBulkPromotionError("");
                      }}
                      disabled={bulkPromotionRunning || !bulkDestinationSession}
                      required
                    />
                  </div>
                  {bulkSourceLoading ? (
                    <p className="text-body" role="status">
                      Loading active enrollments...
                    </p>
                  ) : (
                    <DataTable
                      emptyMessage="No active enrollments are available for bulk promotion."
                      data={bulkSourceEnrollments}
                      columns={[
                        {
                          key: "student",
                          label: "Student",
                          render: (student) =>
                            student
                              ? `${student.name || "Unnamed Student"} (${student.rollNo || "no roll number"})`
                              : "Unavailable",
                        },
                        {
                          id: "student-program",
                          key: "student",
                          label: "Program",
                          render: (student) =>
                            student?.program?.name || "Unavailable",
                        },
                        {
                          key: "classSection",
                          label: "Current Class / Section",
                          render: (classSection) =>
                            classSection
                              ? `${classSection.name || "—"}${classSection.section ? ` — ${classSection.section}` : ""}`
                              : "Unavailable",
                        },
                        {
                          key: "academicSession",
                          label: "Source Session",
                          render: (session) => session?.name || "Unavailable",
                        },
                      ]}
                      actions={(enrollment) => {
                        const selectedPromotion = bulkPromotions.find(
                          (promotion) =>
                            promotion.sourceEnrollment === enrollment._id,
                        );
                        const programId =
                          enrollment.student?.program?._id ||
                          enrollment.student?.program;
                        const compatibleClasses = enrollmentClasses.filter(
                          (classSection) =>
                            (classSection.program?._id ||
                              classSection.program) === programId,
                        );
                        return (
                          <div className="form-stack">
                            <label className="form-label">
                              <input
                                type="checkbox"
                                checked={Boolean(selectedPromotion)}
                                disabled={
                                  bulkPromotionRunning ||
                                  (!selectedPromotion &&
                                    bulkPromotions.length >= 100)
                                }
                                onChange={(event) =>
                                  handleBulkPromotionSelection(
                                    enrollment,
                                    event.target.checked,
                                  )
                                }
                              />{" "}
                              Select Student
                            </label>
                            {selectedPromotion && (
                              <>
                                <label
                                  className="form-label"
                                  htmlFor={`bulk-class-${enrollment._id}`}
                                >
                                  Destination class for{" "}
                                  {enrollment.student?.name || "this Student"}
                                </label>
                                <select
                                  id={`bulk-class-${enrollment._id}`}
                                  className="form-select"
                                  value={
                                    selectedPromotion.destinationClassSection
                                  }
                                  onChange={(event) =>
                                    setBulkPromotions((current) =>
                                      current.map((promotion) =>
                                        promotion.sourceEnrollment ===
                                        enrollment._id
                                          ? {
                                              ...promotion,
                                              destinationClassSection:
                                                event.target.value,
                                            }
                                          : promotion,
                                      ),
                                    )
                                  }
                                  disabled={bulkPromotionRunning}
                                  required
                                >
                                  <option value="">
                                    Select compatible ClassSection
                                  </option>
                                  {compatibleClasses.map((classSection) => (
                                    <option
                                      key={classSection._id}
                                      value={classSection._id}
                                    >
                                      {classSection.name} —{" "}
                                      {classSection.section}
                                    </option>
                                  ))}
                                </select>
                                {compatibleClasses.length === 0 && (
                                  <p className="form-help">
                                    No ClassSections are available for this
                                    Student&apos;s Program.
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      }}
                    />
                  )}
                  {bulkSourcePagination.pages > 1 && (
                    <div className="pagination">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          bulkSourceLoading ||
                          bulkPromotionRunning ||
                          bulkSourcePage <= 1
                        }
                        onClick={() =>
                          setBulkSourcePage((page) => Math.max(1, page - 1))
                        }
                      >
                        ← Prev
                      </Button>
                      <span className="pagination-info">
                        Page {bulkSourcePagination.page} of{" "}
                        {bulkSourcePagination.pages}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          bulkSourceLoading ||
                          bulkPromotionRunning ||
                          bulkSourcePage >= bulkSourcePagination.pages
                        }
                        onClick={() =>
                          setBulkSourcePage((page) => page + 1)
                        }
                      >
                        Next →
                      </Button>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      bulkPromotionRunning ||
                        closingEnrollment ||
                        promotingEnrollment ||
                        bulkSourceLoading ||
                        bulkPromotions.length === 0
                    }
                  >
                    {bulkPromotionRunning
                      ? "Promoting batch..."
                      : `Promote ${bulkPromotions.length} selected Students`}
                  </Button>
                </form>
              </Panel>

              <Panel title="Student Enrollment History">
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Student",
                      value: enrollmentHistoryStudentLabel || "—",
                    },
                  ]}
                />

                {enrollmentHistoryError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{enrollmentHistoryError}</p>
                  </div>
                )}
                {enrollmentClosureError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{enrollmentClosureError}</p>
                  </div>
                )}
                {enrollmentClosureSuccess && (
                  <div className="alert alert-success" role="status">
                    <p className="alert-message">{enrollmentClosureSuccess}</p>
                  </div>
                )}
                {enrollmentPromotionError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{enrollmentPromotionError}</p>
                  </div>
                )}
                {enrollmentPromotionSuccess && (
                  <div className="alert alert-success" role="status">
                    <p className="alert-message">{enrollmentPromotionSuccess}</p>
                  </div>
                )}

                {enrollmentHistoryLoading ? (
                  <div className="dashboard-loading" role="status">
                    <p>Loading enrollment history...</p>
                  </div>
                ) : (
                  <>
                    <DataTable
                      columns={[
                        {
                          key: "status",
                          label: "Enrollment Status",
                          render: (status) => (
                            <span className={`status ${getStatusClass(status)}`}>
                              {formatStatus(status)}
                            </span>
                          ),
                        },
                        {
                          key: "classSection",
                          label: "Class / Section",
                          render: (classSection) =>
                            classSection
                              ? `${classSection.name || "—"}${classSection.section ? ` — ${classSection.section}` : ""}`
                              : "Unavailable",
                        },
                        {
                          key: "academicSession",
                          label: "Academic Session",
                          render: (academicSession) =>
                            academicSession?.name || "Unavailable",
                        },
                        {
                          key: "startDate",
                          label: "Start Date",
                          render: (date) => (date ? date.slice(0, 10) : "—"),
                        },
                        {
                          key: "endDate",
                          label: "End Date",
                          render: (date) => (date ? date.slice(0, 10) : "—"),
                        },
                      ]}
                      actions={(enrollment) => {
                        if (enrollment.status !== "active") return "—";

                        const studentProgramId =
                          enrollment.student?.program?._id ||
                          enrollment.student?.program;
                        const programClassSections = enrollmentClasses.filter(
                          (classSection) =>
                            (classSection.program?._id || classSection.program) ===
                            studentProgramId,
                        );
                        const destinationSessions = enrollmentSessions.filter(
                          (session) =>
                            session._id !== enrollment.academicSession?._id,
                        );
                        const selectedDestinationSession =
                          destinationSessions.find(
                            (session) =>
                              session._id ===
                              enrollmentPromotion.destinationAcademicSession,
                          );

                        if (
                          enrollmentClosure.enrollmentId === enrollment._id
                        ) {
                          return (
                            <form
                              className="form-stack"
                              onSubmit={handleCloseEnrollment}
                            >
                              <label
                                className="form-label"
                                htmlFor={`enrollment-end-date-${enrollment._id}`}
                              >
                                End date
                              </label>
                              <input
                                id={`enrollment-end-date-${enrollment._id}`}
                                className="form-input"
                                type="date"
                                min={enrollment.startDate?.slice(0, 10)}
                                max={enrollment.academicSession?.endDate?.slice(
                                  0,
                                  10,
                                )}
                                value={enrollmentClosure.endDate}
                                onChange={(event) =>
                                  setEnrollmentClosure((current) => ({
                                    ...current,
                                    endDate: event.target.value,
                                  }))
                                }
                                disabled={
                                  closingEnrollment || bulkPromotionRunning
                                }
                                required
                              />
                              <div className="table-actions">
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={
                                    closingEnrollment || bulkPromotionRunning
                                  }
                                >
                                  {closingEnrollment
                                    ? "Saving..."
                                    : `Confirm ${formatStatus(enrollmentClosure.status)}`}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={
                                    closingEnrollment || bulkPromotionRunning
                                  }
                                  onClick={() =>
                                    setEnrollmentClosure({
                                      enrollmentId: "",
                                      status: "",
                                      endDate: "",
                                    })
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          );
                        }

                        if (
                          enrollmentPromotion.enrollmentId === enrollment._id
                        ) {
                          return (
                            <form
                              className="form-stack"
                              onSubmit={handlePromoteEnrollment}
                            >
                              <label
                                className="form-label"
                                htmlFor={`promotion-session-${enrollment._id}`}
                              >
                                Destination Academic Session
                              </label>
                              <select
                                id={`promotion-session-${enrollment._id}`}
                                className="form-select"
                                value={
                                  enrollmentPromotion.destinationAcademicSession
                                }
                                onChange={(event) =>
                                  setEnrollmentPromotion((current) => ({
                                    ...current,
                                    destinationAcademicSession:
                                      event.target.value,
                                    promotionDate: "",
                                  }))
                                }
                                disabled={
                                  promotingEnrollment || bulkPromotionRunning
                                }
                                required
                              >
                                <option value="">Select destination session</option>
                                {destinationSessions.map((session) => (
                                  <option key={session._id} value={session._id}>
                                    {session.name} — {formatStatus(session.status)}
                                  </option>
                                ))}
                              </select>

                              <label
                                className="form-label"
                                htmlFor={`promotion-class-${enrollment._id}`}
                              >
                                Destination Class / Section
                              </label>
                              <select
                                id={`promotion-class-${enrollment._id}`}
                                className="form-select"
                                value={
                                  enrollmentPromotion.destinationClassSection
                                }
                                onChange={(event) =>
                                  setEnrollmentPromotion((current) => ({
                                    ...current,
                                    destinationClassSection:
                                      event.target.value,
                                  }))
                                }
                                disabled={
                                  promotingEnrollment ||
                                  bulkPromotionRunning ||
                                  !studentProgramId
                                }
                                required
                              >
                                <option value="">Select destination class</option>
                                {programClassSections.map((classSection) => (
                                  <option
                                    key={classSection._id}
                                    value={classSection._id}
                                  >
                                    {classSection.name} — {classSection.section}
                                  </option>
                                ))}
                              </select>
                              {studentProgramId &&
                                programClassSections.length === 0 && (
                                  <p className="form-help">
                                    No destination ClassSections are available
                                    for this Student&apos;s Program.
                                  </p>
                                )}

                              <label
                                className="form-label"
                                htmlFor={`promotion-date-${enrollment._id}`}
                              >
                                Promotion Date
                              </label>
                              <input
                                id={`promotion-date-${enrollment._id}`}
                                className="form-input"
                                type="date"
                                min={selectedDestinationSession?.startDate?.slice(
                                  0,
                                  10,
                                )}
                                max={selectedDestinationSession?.endDate?.slice(
                                  0,
                                  10,
                                )}
                                value={enrollmentPromotion.promotionDate}
                                onChange={(event) =>
                                  setEnrollmentPromotion((current) => ({
                                    ...current,
                                    promotionDate: event.target.value,
                                  }))
                                }
                                disabled={
                                  promotingEnrollment ||
                                  bulkPromotionRunning ||
                                  !selectedDestinationSession
                                }
                                required
                              />
                              <div className="table-actions">
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={
                                    promotingEnrollment || bulkPromotionRunning
                                  }
                                >
                                  {promotingEnrollment
                                    ? "Promoting..."
                                    : "Confirm promotion"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={
                                    promotingEnrollment || bulkPromotionRunning
                                  }
                                  onClick={() =>
                                    setEnrollmentPromotion({
                                      enrollmentId: "",
                                      destinationAcademicSession: "",
                                      destinationClassSection: "",
                                      promotionDate: "",
                                    })
                                  }
                                >
                                  Cancel
                                </Button>
                              </div>
                            </form>
                          );
                        }

                        return (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                closingEnrollment ||
                                promotingEnrollment ||
                                bulkPromotionRunning
                              }
                              onClick={() => {
                                setEnrollmentClosure({
                                  enrollmentId: enrollment._id,
                                  status: "completed",
                                  endDate: "",
                                });
                                setEnrollmentPromotion({
                                  enrollmentId: "",
                                  destinationAcademicSession: "",
                                  destinationClassSection: "",
                                  promotionDate: "",
                                });
                                setEnrollmentClosureError("");
                                setEnrollmentClosureSuccess("");
                              }}
                            >
                              Complete
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={
                                closingEnrollment ||
                                promotingEnrollment ||
                                bulkPromotionRunning
                              }
                              onClick={() => {
                                setEnrollmentClosure({
                                  enrollmentId: enrollment._id,
                                  status: "withdrawn",
                                  endDate: "",
                                });
                                setEnrollmentPromotion({
                                  enrollmentId: "",
                                  destinationAcademicSession: "",
                                  destinationClassSection: "",
                                  promotionDate: "",
                                });
                                setEnrollmentClosureError("");
                                setEnrollmentClosureSuccess("");
                              }}
                            >
                              Withdraw
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={
                                closingEnrollment ||
                                promotingEnrollment ||
                                bulkPromotionRunning
                              }
                              onClick={() => {
                                setEnrollmentClosure({
                                  enrollmentId: "",
                                  status: "",
                                  endDate: "",
                                });
                                setEnrollmentPromotion({
                                  enrollmentId: enrollment._id,
                                  destinationAcademicSession: "",
                                  destinationClassSection: "",
                                  promotionDate: "",
                                });
                                setEnrollmentPromotionError("");
                                setEnrollmentPromotionSuccess("");
                              }}
                            >
                              Promote
                            </Button>
                          </>
                        );
                      }}
                      data={enrollmentHistory}
                      emptyMessage={`No enrollment history found for ${enrollmentHistoryStudentLabel || "this student"}.`}
                    />
                    {enrollmentHistoryPagination.pages > 1 && (
                      <div className="pagination">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={enrollmentHistoryPagination.page <= 1}
                          onClick={() =>
                            handleEnrollmentHistoryPage(
                              enrollmentHistoryPagination.page - 1,
                            )
                          }
                        >
                          ← Prev
                        </Button>
                        <span className="pagination-info">
                          Page {enrollmentHistoryPagination.page} of{" "}
                          {enrollmentHistoryPagination.pages}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={
                            enrollmentHistoryPagination.page >=
                            enrollmentHistoryPagination.pages
                          }
                          onClick={() =>
                            handleEnrollmentHistoryPage(
                              enrollmentHistoryPagination.page + 1,
                            )
                          }
                        >
                          Next →
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </Panel>

              <Panel title="Create Student Enrollment">
                {enrollmentOptionsError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{enrollmentOptionsError}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={loadEnrollmentOptions}
                      disabled={enrollmentOptionsLoading}
                    >
                      Retry choices
                    </Button>
                  </div>
                )}
                {enrollmentCreateError && (
                  <div className="alert alert-error" role="alert">
                    <p className="alert-message">{enrollmentCreateError}</p>
                  </div>
                )}
                {enrollmentCreateSuccess && (
                  <div className="alert alert-success" role="status">
                    <p className="alert-message">{enrollmentCreateSuccess}</p>
                  </div>
                )}
                {enrollmentOptionsLoading && (
                  <p className="text-body" role="status">
                    Loading class sections and academic sessions...
                  </p>
                )}
                {!enrollmentOptionsLoading &&
                  !enrollmentOptionsError &&
                  enrollmentClasses.length === 0 && (
                    <p className="form-help">
                      No class sections are available for enrollment.
                    </p>
                  )}
                {!enrollmentOptionsLoading &&
                  !enrollmentOptionsError &&
                  enrollmentSessions.length === 0 && (
                    <p className="form-help">
                      No planned or active academic sessions are available.
                    </p>
                  )}

                <form className="form-stack" onSubmit={handleCreateEnrollment}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="enrollment-class">
                      Class / Section
                    </label>
                    <select
                      id="enrollment-class"
                      className="form-select"
                      value={enrollmentForm.classSection}
                      onChange={(event) => {
                        setEnrollmentForm((current) => ({
                          ...current,
                          student: "",
                          classSection: event.target.value,
                        }));
                        setEligiblePage(1);
                        setEligiblePagination({ page: 1, pages: 1 });
                        setEnrollmentCreateError("");
                        setEnrollmentCreateSuccess("");
                      }}
                      disabled={
                        enrollmentOptionsLoading ||
                        creatingEnrollment ||
                        bulkPromotionRunning
                      }
                      required
                    >
                      <option value="">Select Class / Section</option>
                      {enrollmentClasses.map((classSection) => (
                        <option key={classSection._id} value={classSection._id}>
                          {classSection.name} — {classSection.section} (
                          {classSection.program?.name || "Program unavailable"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="enrollment-session">
                      Academic Session
                    </label>
                    <select
                      id="enrollment-session"
                      className="form-select"
                      value={enrollmentForm.academicSession}
                      onChange={(event) => {
                        setEnrollmentForm((current) => ({
                          ...current,
                          student: "",
                          academicSession: event.target.value,
                        }));
                        setEligiblePage(1);
                        setEligiblePagination({ page: 1, pages: 1 });
                        setEnrollmentCreateError("");
                        setEnrollmentCreateSuccess("");
                      }}
                      disabled={
                        enrollmentOptionsLoading ||
                        creatingEnrollment ||
                        bulkPromotionRunning
                      }
                      required
                    >
                      <option value="">Select Academic Session</option>
                      {enrollmentSessions.map((session) => (
                        <option key={session._id} value={session._id}>
                          {session.name} — {formatStatus(session.status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="enrollment-student">
                      Eligible Student
                    </label>
                    <select
                      id="enrollment-student"
                      className="form-select"
                      value={enrollmentForm.student}
                      onChange={(event) => {
                        setEnrollmentForm((current) => ({
                          ...current,
                          student: event.target.value,
                        }));
                        setEnrollmentCreateError("");
                        setEnrollmentCreateSuccess("");
                      }}
                      disabled={
                        eligibleStudentsLoading ||
                        creatingEnrollment ||
                        bulkPromotionRunning ||
                        !enrollmentForm.classSection ||
                        !enrollmentForm.academicSession ||
                        Boolean(eligibleStudentsError)
                      }
                      required
                    >
                      <option value="">
                        {eligibleStudentsLoading
                          ? "Loading eligible students..."
                          : "Select Eligible Student"}
                      </option>
                      {eligibleStudents.map((student) => (
                        <option key={student._id} value={student._id}>
                          {student.name} — {student.rollNo}
                        </option>
                      ))}
                    </select>
                    {eligibleStudentsError && (
                      <p className="form-error" role="alert">
                        {eligibleStudentsError}
                      </p>
                    )}
                    {!eligibleStudentsLoading &&
                      !eligibleStudentsError &&
                      enrollmentForm.classSection &&
                      enrollmentForm.academicSession &&
                      eligibleStudents.length === 0 && (
                        <p className="form-help">
                          No eligible active students are available for this
                          class and session.
                        </p>
                      )}
                    {eligiblePagination.pages > 1 && (
                      <div className="pagination">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={eligiblePage <= 1 || eligibleStudentsLoading}
                          onClick={() => setEligiblePage((page) => page - 1)}
                        >
                          ← Prev students
                        </Button>
                        <span className="pagination-info">
                          Page {eligiblePagination.page} of{" "}
                          {eligiblePagination.pages}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={
                            eligiblePage >= eligiblePagination.pages ||
                            eligibleStudentsLoading
                          }
                          onClick={() => setEligiblePage((page) => page + 1)}
                        >
                          Next students →
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="enrollment-start-date">
                      Enrollment Start Date
                    </label>
                    <input
                      id="enrollment-start-date"
                      className="form-input"
                      type="date"
                      value={enrollmentForm.startDate}
                      min={selectedEnrollmentSession?.startDate?.slice(0, 10)}
                      max={selectedEnrollmentSession?.endDate?.slice(0, 10)}
                      onChange={(event) => {
                        setEnrollmentForm((current) => ({
                          ...current,
                          startDate: event.target.value,
                        }));
                        setEnrollmentCreateError("");
                        setEnrollmentCreateSuccess("");
                      }}
                      disabled={creatingEnrollment || bulkPromotionRunning}
                      required
                    />
                    <p className="form-help">
                      Choose a date within the selected academic session.
                    </p>
                  </div>

                  <div className="form-actions">
                    <Button
                      type="submit"
                      disabled={
                        creatingEnrollment ||
                        bulkPromotionRunning ||
                        enrollmentOptionsLoading ||
                        eligibleStudentsLoading
                      }
                    >
                      {creatingEnrollment
                        ? "Creating enrollment..."
                        : "Create Enrollment"}
                    </Button>
                  </div>
                </form>
              </Panel>

              <Panel title="Student Administration">
                <DetailGrid
                  columns={2}
                  items={[
                    {
                      label: "Student Status",
                      value: <StatusBadge value={selectedStudent?.status} />,
                    },
                    {
                      label: "Fee Status",
                      value: <StatusBadge value={selectedStudent?.feeStatus} />,
                    },
                    {
                      label: "Admission Date",
                      value: formatDate(selectedStudent?.dateOfAdmission),
                    },
                  ]}
                />
                <div className="section-spacing">
                  <div className="form-group">
                    <label className="form-label">Student Status</label>
                    <div className="validation-actions">
                      {STUDENT_STATUSES.map((status) => (
                        <Button
                          key={status}
                          type="button"
                          variant={
                            selectedStudent?.status === status
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          disabled={selectedStudent?.status === status}
                          onClick={() => handleStudentStatusChange(status)}
                        >
                          {formatStatus(status)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fee Status</label>
                    <div className="validation-actions">
                      {FEE_STATUSES.map((status) => (
                        <Button
                          key={status}
                          type="button"
                          variant={
                            selectedStudent?.feeStatus === status
                              ? "primary"
                              : "secondary"
                          }
                          size="sm"
                          disabled={selectedStudent?.feeStatus === status}
                          onClick={() => handleFeeStatusChange(status)}
                        >
                          {formatStatus(status)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="transfer-program">
                      Transfer Program
                    </label>
                    <select
                      id="transfer-program"
                      className="form-select"
                      value={
                        selectedStudent?.program?._id ||
                        selectedStudent?.program ||
                        ""
                      }
                      onChange={(event) =>
                        handleProgramTransfer(event.target.value)
                      }
                    >
                      <option value="">Select Program</option>
                      {programs.map((program) => (
                        <option key={program._id} value={program._id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                    <p className="form-help">
                      Changing the Program updates the available seats in both
                      Programs.
                    </p>
                  </div>
                </div>
                <div className="danger-zone">
                  <div className="danger-zone-header">
                    <div className="danger-zone-icon">
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h3 className="danger-zone-title">Danger Zone</h3>
                      <p className="danger-zone-description">
                        Permanently remove this student and restore one seat to
                        their Program.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteStudent}
                  >
                    Delete Student
                  </Button>
                </div>
              </Panel>
            </div>
          )}

          {/* Documents */}

          {activeTab === "documents" && (
            <Panel
              title="Document Management"
              description="Review uploaded academic documents and manage verification status."
              actions={
                !selectedStudent?.documentsVerified && (
                  <Button size="sm" onClick={handleVerifyDocuments}>
                    Mark as Verified
                  </Button>
                )
              }
            >
              <DetailGrid
                columns={1}
                items={[
                  {
                    label: "Verification Status",
                    value: (
                      <span
                        className={`status ${
                          selectedStudent?.documentsVerified
                            ? "status-active"
                            : "status-pending"
                        }`}
                      >
                        {selectedStudent?.documentsVerified
                          ? "Verified"
                          : "Pending Verification"}
                      </span>
                    ),
                  },
                ]}
              />

              <div className="section-spacing">
                <h3 className="document-section-title">Uploaded Documents</h3>

                {selectedStudent?.previousAcademicDocument?.length > 0 ? (
                  <div className="document-list">
                    {selectedStudent.previousAcademicDocument.map(
                      (document, index) => (
                        <div
                          key={document._id || `${document.name}-${index}`}
                          className="document-item"
                        >
                          <div className="document-info">
                            <span className="document-icon">
                              <FontAwesomeIcon
                                icon={faFile}
                                aria-hidden="true"
                              />
                            </span>

                            <div className="document-content">
                              <span className="document-name">
                                {document.name}
                              </span>

                              <span className="document-type">
                                Academic Document
                              </span>
                            </div>
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
                      ),
                    )}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <FontAwesomeIcon icon={faFolderOpen} aria-hidden="true" />
                    </div>

                    <p className="empty-state-description">
                      No documents uploaded yet.
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </div>
      </Drawer>
    </div>
  );
}
