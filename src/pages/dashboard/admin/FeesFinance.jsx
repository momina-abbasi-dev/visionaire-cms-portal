import { useState, useEffect } from "react";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Modal } from "../../../components/ui/Modal.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { DetailGrid } from "../../../components/ui/DetailGrid.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import {
  getFeeStats,
  getFeeRecords,
  getStudentFeeRecords,
  generateChallan,
  recordPayment,
  cancelChallan,
  getOverdueAlerts,
} from "../../../services/feesFinanceService.js";

import { getStudents } from "../../../services/studentService.js";
import { getPrograms } from "../../../services/programService.js";
import { getClasses } from "../../../services/classService.js";

const EMPTY_CHALLAN = {
  student: "",
  program: "",
  classSection: "",
  semester: "",
  session: "",
  totalFee: "",
  discount: "",
  dueDate: "",
  notes: "",
};

const EMPTY_PAYMENT = {
  amount: "",
  method: "cash",
  reference: "",
};

const fmt = (date) => (date ? new Date(date).toLocaleDateString() : "—");

const fmtPKR = (amount) =>
  amount != null ? `PKR ${Number(amount).toLocaleString()}` : "—";

const isOverdue = (record) =>
  record &&
  record.status !== "paid" &&
  record.status !== "cancelled" &&
  new Date() > new Date(record.dueDate);

export default function FeesFinance() {
  // Data
  const [records, setRecords] = useState([]);
  const [studentHistory, setStudentHistory] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);

  const [stats, setStats] = useState({
    totalChallans: 0,
    paidCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    studentsWithDues: 0,
    totalFeesGenerated: 0,
    paidFees: 0,
    pendingFees: 0,
    overdueFees: 0,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });

  // Loading and errors
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownError, setDropdownError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [program, setProgram] = useState("All");
  const [page, setPage] = useState(1);

  // Generate challan modal
  const [isChallanOpen, setIsChallanOpen] = useState(false);
  const [challanForm, setChallanForm] = useState(EMPTY_CHALLAN);
  const [challanError, setChallanError] = useState(null);
  const [challanSaving, setChallanSaving] = useState(false);

  // Student finance drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeTab, setActiveTab] = useState("finance");

  // Payment modal
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  // Overdue panel
  const [showOverdue, setShowOverdue] = useState(false);

  // --------------------------------------------------
  // Fetch data
  // --------------------------------------------------

  const fetchStats = async () => {
    setStatsLoading(true);

    try {
      const response = await getFeeStats();
      setStats(response.data);
    } catch (err) {
      console.error("Failed to load fee statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit: 15,
      };

      if (status !== "All") params.status = status;
      if (program !== "All") params.program = program;
      if (search.trim()) params.search = search.trim();

      const response = await getFeeRecords(params);

      setRecords(response.data.records || []);
      setPagination(
        response.data.pagination || {
          total: 0,
          page: 1,
          pages: 1,
        },
      );
    } catch (err) {
      console.error("Failed to load fee records:", err);
      setError(err.response?.data?.message || "Failed to load fee records.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdowns = async () => {
    setDropdownError(null);

    // Load independently so a failed class request doesn't
    // prevent students and programs from loading.
    const results = await Promise.allSettled([
      getStudents({ limit: 200 }),
      getPrograms(),
      getClasses(),
    ]);

    const [studentResult, programResult, classResult] = results;

    if (studentResult.status === "fulfilled") {
      setStudents(studentResult.value.data.students || []);
    } else {
      console.error("Failed to load students:", studentResult.reason);
    }

    if (programResult.status === "fulfilled") {
      const data = programResult.value.data;
      setPrograms(Array.isArray(data) ? data : data.programs || []);
    } else {
      console.error("Failed to load programs:", programResult.reason);
    }

    if (classResult.status === "fulfilled") {
      const data = classResult.value.data;
      setClasses(Array.isArray(data) ? data : data.classes || []);
    } else {
      console.error("Failed to load classes:", classResult.reason);
    }

    if (results.some((result) => result.status === "rejected")) {
      setDropdownError(
        "Some form options could not be loaded. Check the student, program, and class API requests.",
      );
    }
  };

  const fetchOverdue = async () => {
    try {
      const response = await getOverdueAlerts();
      setOverdueList(response.data.overdue || []);
    } catch (err) {
      console.error("Failed to load overdue payments:", err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDropdowns();
    fetchOverdue();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [status, program, search, page]);

  // --------------------------------------------------
  // Helpers
  // --------------------------------------------------

  const netDue = (record) =>
    record
      ? Number(record.totalFee || 0) +
        Number(record.lateFee || 0) -
        Number(record.discount || 0)
      : 0;

  const balance = (record) =>
    Math.max(0, netDue(record) - Number(record?.paidAmount || 0));

  const statusBadge = (value) => {
    const displayValue = value || "unknown";

    const className =
      displayValue === "paid"
        ? "status status-active"
        : displayValue === "partial" || displayValue === "pending"
          ? "status status-warning"
          : displayValue === "overdue" || displayValue === "unpaid"
            ? "status status-error"
            : "status status-neutral";

    return (
      <span className={`${className} finance-status`}>
        {displayValue}
      </span>
    );
  };

  const methodBadge = (value) => (
    <span className="status status-neutral finance-status">
      {value || "—"}
    </span>
  );

  const refreshFinanceData = async () => {
    await Promise.all([fetchRecords(), fetchStats(), fetchOverdue()]);
  };

  // --------------------------------------------------
  // Generate challan
  // --------------------------------------------------

  const handleChallanChange = (event) => {
    const { name, value } = event.target;

    setChallanForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleGenerateChallan = async (event) => {
    event.preventDefault();
    setChallanError(null);

    const totalFee = Number(challanForm.totalFee);
    const discount = Number(challanForm.discount || 0);

    if (!Number.isFinite(totalFee) || totalFee <= 0) {
      setChallanError("Total fee must be greater than zero.");
      return;
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > totalFee) {
      setChallanError("Discount must be between zero and the total fee.");
      return;
    }

    setChallanSaving(true);

    try {
      await generateChallan({
        ...challanForm,
        totalFee,
        discount,
        lateFee: 0,
      });

      setIsChallanOpen(false);
      setChallanForm(EMPTY_CHALLAN);

      await refreshFinanceData();
    } catch (err) {
      setChallanError(
        err.response?.data?.message || "Failed to generate challan.",
      );
    } finally {
      setChallanSaving(false);
    }
  };

  // --------------------------------------------------
  // Open student finance drawer
  // --------------------------------------------------

  const openDrawer = async (record) => {
    setSelectedRecord(record);
    setActiveTab("finance");
    setIsDrawerOpen(true);
    setStudentHistory([]);

    const studentId = record.student?._id || record.student;

    if (!studentId) return;

    try {
      const response = await getStudentFeeRecords(studentId);
      setStudentHistory(response.data.records || []);
    } catch (err) {
      console.error("Failed to load student fee history:", err);
    }
  };

  // --------------------------------------------------
  // Record payment
  // --------------------------------------------------

  const handlePaymentChange = (event) => {
    const { name, value } = event.target;

    setPaymentForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    setPaymentError(null);

    if (!selectedRecord?._id) {
      setPaymentError("Select a valid challan first.");
      return;
    }

    const amount = Number(paymentForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Payment amount must be greater than zero.");
      return;
    }

    if (amount > balance(selectedRecord)) {
      setPaymentError("Payment cannot exceed the remaining balance.");
      return;
    }

    setPaymentSaving(true);

    try {
      const response = await recordPayment(selectedRecord._id, {
        ...paymentForm,
        amount,
      });

      const updatedRecord = response.data.record;

      setSelectedRecord(updatedRecord);
      setIsPaymentOpen(false);
      setPaymentForm(EMPTY_PAYMENT);

      const studentId = updatedRecord.student?._id || updatedRecord.student;

      if (studentId) {
        const historyResponse = await getStudentFeeRecords(studentId);

        setStudentHistory(historyResponse.data.records || []);
      }

      await refreshFinanceData();
    } catch (err) {
      setPaymentError(
        err.response?.data?.message || "Failed to record payment.",
      );
    } finally {
      setPaymentSaving(false);
    }
  };

  // --------------------------------------------------
  // Cancel challan
  // --------------------------------------------------

  const handleCancel = async (record) => {
    if (!record?._id) return;

    const confirmed = window.confirm(`Cancel challan ${record.challanId}?`);

    if (!confirmed) return;

    try {
      await cancelChallan(record._id);

      if (selectedRecord?._id === record._id) {
        setIsDrawerOpen(false);
        setSelectedRecord(null);
      }

      await refreshFinanceData();
    } catch (err) {
      window.alert(err.response?.data?.message || "Failed to cancel challan.");
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------

  return (
    <div className="dashboard-page admin-page fees-finance">
      <PageHeader
        title="Fees & Finance"
        description="Manage student fee records, challans, and payment tracking."
        action={
          <div className="finance-page-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={async () => {
                const nextState = !showOverdue;
                setShowOverdue(nextState);

                if (nextState) await fetchOverdue();
              }}
            >
              Overdue Alerts
              {overdueList.length > 0 && ` (${overdueList.length})`}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setChallanError(null);
                setIsChallanOpen(true);
              }}
            >
              Generate Challan
            </button>
          </div>
        }
      />

      {dropdownError && (
        <div className="alert alert-error" role="alert">
          {dropdownError}
        </div>
      )}

      {/* Overdue alerts */}
      {showOverdue && (
        <Panel
          title={`Overdue Payments (${overdueList.length})`}
          description="Students with unpaid dues past the due date"
          actions={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowOverdue(false)}
            >
              Hide
            </button>
          }
        >
          {overdueList.length === 0 ? (
            <p className="finance-empty-message">
              No overdue payments.
            </p>
          ) : (
            <DataTable
              columns={[
                {
                  key: "student",
                  label: "Student",
                  render: (value) => value?.name || "—",
                },
                {
                  key: "rollNo",
                  label: "Roll No.",
                  render: (_, row) => row.student?.rollNo || "—",
                },
                {
                  key: "contact",
                  label: "Contact",
                  render: (_, row) =>
                    row.student?.contact || row.student?.phone || "—",
                },
                {
                  key: "challanId",
                  label: "Challan ID",
                },
                {
                  key: "totalFee",
                  label: "Total Fee",
                  render: (value) => fmtPKR(value),
                },
                {
                  key: "dueDate",
                  label: "Due Date",
                  render: (value) => fmt(value),
                },
                {
                  key: "balance",
                  label: "Balance",
                  render: (_, row) => fmtPKR(balance(row)),
                },
              ]}
              data={overdueList}
              actions={(row) => (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    openDrawer(row);
                    setShowOverdue(false);
                  }}
                >
                  View
                </button>
              )}
            />
          )}
        </Panel>
      )}

      {/* Generate challan modal */}
      <Modal
        isOpen={isChallanOpen}
        title="Generate Fee Challan"
        onClose={() => {
          if (!challanSaving) setIsChallanOpen(false);
        }}
        actions={
          <div className="finance-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={challanSaving}
              onClick={() => setIsChallanOpen(false)}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="generate-challan-form"
              className="btn btn-primary"
              disabled={challanSaving}
            >
              {challanSaving ? "Generating..." : "Generate"}
            </button>
          </div>
        }
      >
        <form
          id="generate-challan-form"
          className="form-stack"
          onSubmit={handleGenerateChallan}
        >
          {challanError && (
            <div className="form-error" role="alert">{challanError}</div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="challan-student">Student</label>
            <select
              id="challan-student"
              className="form-select"
              name="student"
              value={challanForm.student}
              onChange={handleChallanChange}
              required
            >
              <option value="">Select Student</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.name} — {student.rollNo}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-program">Program</label>
            <select
              id="challan-program"
              className="form-select"
              name="program"
              value={challanForm.program}
              onChange={handleChallanChange}
            >
              <option value="">Select Program (optional)</option>
              {programs.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-class-section">Class / Section</label>
            <select
              id="challan-class-section"
              className="form-select"
              name="classSection"
              value={challanForm.classSection}
              onChange={handleChallanChange}
            >
              <option value="">Select Class (optional)</option>
              {classes.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                  {item.section ? ` — ${item.section}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-semester">Semester</label>
            <input
              id="challan-semester"
              className="form-input"
              name="semester"
              placeholder="e.g. Semester 1"
              value={challanForm.semester}
              onChange={handleChallanChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-session">Session</label>
            <input
              id="challan-session"
              className="form-input"
              name="session"
              placeholder="e.g. 2026-2027"
              value={challanForm.session}
              onChange={handleChallanChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-total-fee">Total Fee (PKR)</label>
            <input
              id="challan-total-fee"
              className="form-input"
              name="totalFee"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Total Fee (PKR)"
              value={challanForm.totalFee}
              onChange={handleChallanChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-discount">Discount (PKR)</label>
            <input
              id="challan-discount"
              className="form-input"
              name="discount"
              type="number"
              min="0"
              max={challanForm.totalFee || undefined}
              step="0.01"
              placeholder="Discount (PKR)"
              value={challanForm.discount}
              onChange={handleChallanChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-due-date">Due Date</label>
            <input
              id="challan-due-date"
              className="form-input"
              name="dueDate"
              type="date"
              value={challanForm.dueDate}
              onChange={handleChallanChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="challan-notes">Notes</label>
            <input
              id="challan-notes"
              className="form-input"
              name="notes"
              placeholder="Notes (optional)"
              value={challanForm.notes}
              onChange={handleChallanChange}
            />
          </div>
        </form>
      </Modal>

      {/* Record payment modal */}
      <Modal
        isOpen={isPaymentOpen}
        title={`Record Payment — ${selectedRecord?.challanId || ""}`}
        onClose={() => {
          if (!paymentSaving) setIsPaymentOpen(false);
        }}
        actions={
          <div className="finance-modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={paymentSaving}
              onClick={() => setIsPaymentOpen(false)}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="record-payment-form"
              className="btn btn-primary"
              disabled={paymentSaving || balance(selectedRecord) <= 0}
            >
              {paymentSaving ? "Saving..." : "Save Payment"}
            </button>
          </div>
        }
      >
        <form
          id="record-payment-form"
          className="form-stack"
          onSubmit={handleRecordPayment}
        >
          {paymentError && (
            <div className="form-error" role="alert">{paymentError}</div>
          )}

          <div className="detail-row finance-payment-balance">
            <span className="detail-label">Remaining Balance</span>
            <span className="detail-value finance-payment-balance-value">
              {fmtPKR(balance(selectedRecord))}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payment-amount">Amount (PKR)</label>
            <input
              id="payment-amount"
              className="form-input"
              name="amount"
              type="number"
              min="0.01"
              max={balance(selectedRecord)}
              step="0.01"
              placeholder="Amount (PKR)"
              value={paymentForm.amount}
              onChange={handlePaymentChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payment-reference">Reference / Slip No.</label>
            <input
              id="payment-reference"
              className="form-input"
              name="reference"
              placeholder="Reference / Slip No."
              value={paymentForm.reference}
              onChange={handlePaymentChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="payment-method">Payment Method</label>
            <select
              id="payment-method"
              className="form-select"
              name="method"
              value={paymentForm.method}
              onChange={handlePaymentChange}
              required
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="online">Online Payment</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Summary cards */}
      <div className="summary-card-grid">
        <SummaryCard
          title="Total Challans"
          value={stats.totalChallans}
          loading={statsLoading}
        />
        <SummaryCard
          title="Paid"
          value={stats.paidCount}
          loading={statsLoading}
        />
        <SummaryCard
          title="Pending"
          value={stats.pendingCount}
          loading={statsLoading}
        />
        <SummaryCard
          title="Overdue"
          value={stats.overdueCount}
          loading={statsLoading}
        />
        <SummaryCard
          title="Students w/ Dues"
          value={stats.studentsWithDues}
          loading={statsLoading}
        />
        <SummaryCard
          title="Total Generated"
          value={fmtPKR(stats.totalFeesGenerated)}
          loading={statsLoading}
        />
      </div>

      {/* Search and filters */}
      <div>
        <SearchFilters
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filters={[
            {
              label: "Status:",
              value: status,
              onChange: (value) => {
                setStatus(value);
                setPage(1);
              },
              options: ["All", "unpaid", "paid", "partial", "overdue"],
            },
            {
              label: "Program:",
              value: program,
              onChange: (value) => {
                setProgram(value);
                setPage(1);
              },
              options: [
                "All",
                ...programs.map((item) => ({
                  value: item._id,
                  label:
                    [item.name, item.programName].find(
                      (name) => typeof name === "string" && name.trim(),
                    ) || "Unnamed program",
                })),
              ],
            },
          ]}
        />
      </div>

      {/* Financial summary */}
      <div className="finance-summary-strip">
        <span>
          <strong>Paid:</strong> {fmtPKR(stats.paidFees)}
        </span>
        <span>
          <strong>Pending:</strong> {fmtPKR(stats.pendingFees)}
        </span>
        <span>
          <strong>Overdue:</strong> {fmtPKR(stats.overdueFees)}
        </span>
      </div>

      {loading && (
        <p className="finance-loading" role="status">Loading records...</p>
      )}

      {error && (
        <div className="alert alert-error" role="alert">{error}</div>
      )}

      {/* Fee records table */}
      <Panel title="Fee Records">
        <DataTable
          columns={[
            {
              key: "challanId",
              label: "Challan ID",
            },
            {
              key: "student",
              label: "Student",
              render: (value) => value?.name || "—",
            },
            {
              key: "rollNo",
              label: "Roll No.",
              render: (_, row) => row.student?.rollNo || "—",
            },
            {
              key: "program",
              label: "Program",
              render: (value) => value?.name || "—",
            },
            {
              key: "semester",
              label: "Semester",
            },
            {
              key: "totalFee",
              label: "Total Fee",
              render: (value) => fmtPKR(value),
            },
            {
              key: "paidAmount",
              label: "Paid",
              render: (value) => fmtPKR(value),
            },
            {
              key: "status",
              label: "Status",
              render: (value, row) => {
                const display =
                  value !== "paid" && value !== "cancelled" && isOverdue(row)
                    ? "overdue"
                    : value;

                return statusBadge(display);
              },
            },
            {
              key: "dueDate",
              label: "Due Date",
              render: (value) => fmt(value),
            },
            {
              key: "generatedBy",
              label: "Generated By",
              render: (value) => value?.name || "—",
            },
            {
              key: "createdAt",
              label: "Generated",
              render: (value) => fmt(value),
            },
          ]}
          data={records}
          actions={(row) => (
            <div className="finance-record-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openDrawer(row)}
              >
                View
              </button>

              {row.status !== "paid" &&
                row.status !== "cancelled" &&
                balance(row) > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedRecord(row);
                      setPaymentForm(EMPTY_PAYMENT);
                      setPaymentError(null);
                      setIsPaymentOpen(true);
                    }}
                  >
                    Pay
                  </button>
                )}

              {row.status !== "paid" && row.status !== "cancelled" && (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleCancel(row)}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        />

        {pagination.pages > 1 && (
          <div className="pagination finance-pagination">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => current - 1)}
            >
              ← Prev
            </button>

            <span className="pagination-info">
              Page {pagination.page} of {pagination.pages} ({pagination.total}{" "}
              records)
            </span>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= pagination.pages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next →
            </button>
          </div>
        )}
      </Panel>

      {/* Student finance drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        title={
          selectedRecord
            ? `${selectedRecord.student?.name || "Student"} — Finance`
            : "Finance Detail"
        }
        onClose={() => setIsDrawerOpen(false)}
        width="580px"
        footer={
        <div className="finance-page-actions">
            {selectedRecord?.status !== "paid" &&
              selectedRecord?.status !== "cancelled" &&
              balance(selectedRecord) > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setPaymentForm(EMPTY_PAYMENT);
                    setPaymentError(null);
                    setIsPaymentOpen(true);
                  }}
                >
                  Record Payment
                </button>
              )}

            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setIsDrawerOpen(false)}
            >
              Close
            </button>
          </div>
        }
      >
        <Tabs
          tabs={[
            { id: "finance", label: "Finance Summary" },
            { id: "history", label: "Challan History" },
            { id: "payments", label: "Payment History" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        {/* Finance summary */}
        {activeTab === "finance" && (
          <Panel title="Student Finance">
            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Student",
                  value: selectedRecord?.student?.name || "—",
                },
                {
                  label: "Roll No.",
                  value: selectedRecord?.student?.rollNo || "—",
                },
                {
                  label: "Program",
                  value: selectedRecord?.program?.name || "—",
                },
                {
                  label: "Class",
                  value: selectedRecord?.classSection
                    ? `${selectedRecord.classSection.name || ""}${
                        selectedRecord.classSection.section
                          ? ` — ${selectedRecord.classSection.section}`
                          : ""
                      }`
                    : "—",
                },
                {
                  label: "Semester",
                  value: selectedRecord?.semester || "—",
                },
                {
                  label: "Session",
                  value: selectedRecord?.session || "—",
                },
              ]}
            />

            <div className="finance-breakdown">
              <p className="finance-breakdown-title">
                Fee Breakdown
              </p>

              {[
                ["Total Fee", fmtPKR(selectedRecord?.totalFee)],
                ["Discount", fmtPKR(selectedRecord?.discount)],
                ["Late Fee", fmtPKR(selectedRecord?.lateFee)],
                ["Net Due", fmtPKR(netDue(selectedRecord))],
                ["Paid Amount", fmtPKR(selectedRecord?.paidAmount)],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span className="detail-label">{label}</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}

              <div className="detail-row finance-balance-row">
                <span className="detail-label finance-balance-label">
                  Remaining Balance
                </span>

                <span className={`finance-balance-value ${balance(selectedRecord) > 0 ? "is-due" : "is-paid"}`}>
                  {fmtPKR(balance(selectedRecord))}
                </span>
              </div>
            </div>

            <div className="detail-grid finance-detail-grid">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                {statusBadge(
                  isOverdue(selectedRecord)
                    ? "overdue"
                    : selectedRecord?.status,
                )}
              </div>

              <div className="detail-row">
                <span className="detail-label">Due Date</span>
                <span className={`detail-value${isOverdue(selectedRecord) ? " finance-overdue" : ""}`}>
                  {fmt(selectedRecord?.dueDate)}
                  {isOverdue(selectedRecord) ? " · Overdue" : ""}
                </span>
              </div>

              {selectedRecord?.paidAt && (
                <div className="detail-row">
                  <span className="detail-label">Paid At</span>
                  <span className="detail-value">
                    {fmt(selectedRecord.paidAt)}
                  </span>
                </div>
              )}

              <div className="detail-row">
                <span className="detail-label">Generated By</span>
                <span className="detail-value">
                  {selectedRecord?.generatedBy?.name || "—"}
                </span>
              </div>

              {selectedRecord?.notes && (
                <div className="detail-row">
                  <span className="detail-label">Notes</span>
                  <span className="detail-value">{selectedRecord.notes}</span>
                </div>
              )}
            </div>

            {selectedRecord?.status !== "paid" &&
              selectedRecord?.status !== "cancelled" && (
                <div
                  className="form-group danger-zone finance-danger-zone"
                >
                  <label className="form-label">Danger Zone</label>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleCancel(selectedRecord)}
                  >
                    Cancel Challan
                  </button>
                </div>
              )}
          </Panel>
        )}

        {/* Challan history */}
        {activeTab === "history" && (
          <Panel title="All Challans for this Student">
            {studentHistory.length === 0 ? (
              <p className="finance-empty-message">
                No challan history found.
              </p>
            ) : (
              <div className="finance-history-list">
                {studentHistory.map((record) => (
                  <button
                    type="button"
                    key={record._id}
                    onClick={() => setSelectedRecord(record)}
                    className={`finance-history-item${record._id === selectedRecord?._id ? " is-selected" : ""}`}
                  >
                    <div className="finance-history-content">
                      <div>
                        <p className="finance-history-title">
                          {record.challanId}
                        </p>
                        <p className="finance-history-meta">
                          {record.semester} · {record.session} · Due:{" "}
                          {fmt(record.dueDate)}
                        </p>
                      </div>

                      <div className="finance-history-amount">
                        <p>
                          {fmtPKR(record.totalFee)}
                        </p>
                        {statusBadge(record.status)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* Payment history */}
        {activeTab === "payments" && (
          <Panel title={`Payment History — ${selectedRecord?.challanId || ""}`}>
            {(selectedRecord?.payments?.length || 0) === 0 ? (
              <div className="finance-payment-empty">
                <p>
                  No payments recorded for this challan.
                </p>
              </div>
            ) : (
              <div className="finance-payment-list">
                {selectedRecord.payments.map((payment, index) => (
                  <div key={payment._id || index} className="finance-payment-row">
                    <div className="finance-payment-content">
                      <div>
                        <p className="finance-payment-amount">
                          {fmtPKR(payment.amount)}
                        </p>
                        <p className="finance-payment-meta">
                          {fmt(payment.paidAt)}
                          {payment.reference
                            ? ` · Ref: ${payment.reference}`
                            : ""}
                        </p>
                      </div>

                      {methodBadge(payment.method)}
                    </div>
                  </div>
                ))}

                <div className="finance-payment-total">
                  <span className="finance-payment-total-label">
                    Total Paid
                  </span>
                  <span className="finance-payment-total-value">
                    {fmtPKR(selectedRecord?.paidAmount)}
                  </span>
                </div>
              </div>
            )}
          </Panel>
        )}
      </Drawer>
    </div>
  );
}
