import { useEffect, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowDown,
  faCalendarDays,
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faCircleInfo,
  faClock,
  faCreditCard,
  faFileInvoiceDollar,
  faEye,
  faMoneyBillWave,
  faPrint,
  faReceipt,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

import { PageHeader } from "../../../components/ui/PageHeader.jsx";
import { SummaryCard } from "../../../components/ui/SummaryCard.jsx";
import { SearchFilters } from "../../../components/ui/SearchFilters.jsx";
import { DataTable } from "../../../components/ui/DataTable.jsx";
import { Drawer } from "../../../components/ui/Drawer.jsx";
import { Tabs } from "../../../components/ui/Tabs.jsx";
import { Panel } from "../../../components/ui/Panel.jsx";

import { getStudentFees } from "../../../services/studentFeesService.js";
import "./student-pages.css";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtPKR = (value) => {
  if (value == null) return "—";

  return `PKR ${Number(value).toLocaleString()}`;
};

const fmt = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysLeft = (date) => {
  if (!date) return null;

  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  paid: {
    label: "Paid",
    className: "status status-success",
    icon: faCircleCheck,
  },

  partial: {
    label: "Partial",
    className: "status status-info",
    icon: faCreditCard,
  },

  unpaid: {
    label: "Unpaid",
    className: "status status-warning",
    icon: faClock,
  },

  overdue: {
    label: "Overdue",
    className: "status status-error",
    icon: faTriangleExclamation,
  },

  cancelled: {
    label: "Cancelled",
    className: "status status-neutral",
    icon: faXmark,
  },

  no_records: {
    label: "No Fee Records",
    className: "status status-neutral",
    icon: faCircleInfo,
  },
};

const METHOD_CONFIG = {
  cash: {
    label: "Cash",
    className: "status status-neutral",
  },

  bank: {
    label: "Bank",
    className: "status status-info",
  },

  online: {
    label: "Online",
    className: "status status-success",
  },
};

const NOTICE_CONFIG = {
  danger: {
    className: "alert alert-error",
    icon: faTriangleExclamation,
  },

  warning: {
    className: "alert alert-warning",
    icon: faCircleExclamation,
  },

  success: {
    className: "alert alert-success",
    icon: faCircleCheck,
  },

  info: {
    className: "alert alert-info",
    icon: faCircleInfo,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;

  return (
    <span className={config.className}>
      <FontAwesomeIcon icon={config.icon} />
      <span>{config.label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT METHOD BADGE
// ─────────────────────────────────────────────────────────────────────────────

function MethodBadge({ method }) {
  const normalizedMethod = String(method || "cash").toLowerCase();
  const config = METHOD_CONFIG[normalizedMethod] || METHOD_CONFIG.cash;

  return <span className={config.className}>{config.label}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT COMPLETED BADGE
// ─────────────────────────────────────────────────────────────────────────────

function CompletedBadge() {
  return (
    <span className="status status-success">
      <FontAwesomeIcon icon={faCheck} />
      <span>Completed</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT STYLES
// ─────────────────────────────────────────────────────────────────────────────

const PRINT_STYLES = `
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: "Segoe UI", Arial, sans-serif;
    }

    body {
        padding: 32px;
        color: #1f2d2c;
        font-size: 14px;
    }

    .print-header {
        text-align: center;
        border-bottom: 3px solid #1f2d2c;
        padding-bottom: 16px;
        margin-bottom: 24px;
    }

    .print-header h1 {
        font-size: 20px;
        font-weight: 800;
    }

    .print-header p {
        font-size: 12px;
        color: #666;
        margin-top: 4px;
    }

    .print-challan-id {
        font-size: 18px;
        font-weight: 800;
        color: #1f2d2c;
        margin-top: 8px;
        letter-spacing: 0.05em;
    }

    .print-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 20px;
    }

    .print-info-cell {
        padding: 10px 14px;
        border-bottom: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
    }

    .print-info-cell:nth-child(even) {
        border-right: none;
    }

    .print-info-cell label {
        display: block;
        margin-bottom: 3px;
        color: #888;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .print-info-cell strong {
        font-size: 14px;
        font-weight: 700;
    }

    .print-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }

    .print-table th {
        padding: 9px 12px;
        background: #1f2d2c;
        color: #fff;
        text-align: left;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .print-table th:last-child,
    .print-table td:last-child {
        text-align: right;
    }

    .print-table td {
        padding: 9px 12px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
    }

    .print-total-row td {
        background: #f8fafc;
        border-top: 2px solid #1f2d2c;
        font-size: 15px;
        font-weight: 700;
    }

    .print-status {
        display: inline-flex;
        align-items: center;
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 700;
    }

    .print-status-success {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
    }

    .print-status-info {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
    }

    .print-status-warning {
        background: #fffbeb;
        border: 1px solid #fde68a;
        color: #92400e;
    }

    .print-status-danger {
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
    }

    .print-status-neutral {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #6b7c78;
    }

    .print-payment-history {
        margin-top: 20px;
    }

    .print-note {
        margin-top: 20px;
        padding: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 12px;
    }

    .print-footer {
        border-top: 2px dashed #ccc;
        margin-top: 24px;
        padding-top: 16px;
        text-align: center;
        color: #888;
        font-size: 11px;
    }

    .print-footer p + p {
        margin-top: 6px;
    }
`;

// ─────────────────────────────────────────────────────────────────────────────
// PRINT CHALLAN
// ─────────────────────────────────────────────────────────────────────────────

const printChallan = (challan, student) => {
  const printWindow = window.open("", "_blank", "width=800,height=700");

  if (!printWindow) return;

  const status = STATUS_CONFIG[challan.status] || STATUS_CONFIG.unpaid;

  const balance = Number(challan.balance || 0);

  const statusClass =
    {
      paid: "print-status-success",
      partial: "print-status-info",
      unpaid: "print-status-warning",
      overdue: "print-status-danger",
      cancelled: "print-status-neutral",
    }[challan.status] || "print-status-warning";

  const paymentRows = challan.payments?.length
    ? `
            <div class="print-payment-history">
                <strong>Payment History</strong>

                <table class="print-table" style="margin-top: 8px;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Amount</th>
                            <th>Method</th>
                            <th>Reference</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${challan.payments
                          .map(
                            (payment) => `
                                    <tr>
                                        <td>${fmt(payment.paidAt)}</td>
                                        <td>${fmtPKR(payment.amount)}</td>
                                        <td>${payment.method || "—"}</td>
                                        <td>${payment.reference || "—"}</td>
                                    </tr>
                                `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        `
    : "";

  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Fee Challan — ${challan.challanId}</title>
                <style>${PRINT_STYLES}</style>
            </head>

            <body>
                <div class="print-header">
                    <h1>Fee Challan</h1>
                    <p>
                        Educational Management System —
                        Official Fee Voucher
                    </p>
                    <div class="print-challan-id">
                        ${challan.challanId}
                    </div>
                </div>

                <div class="print-info-grid">
                    <div class="print-info-cell">
                        <label>Student Name</label>
                        <strong>${student.name || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Roll Number</label>
                        <strong>${student.rollNo || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Program</label>
                        <strong>${student.program || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Department</label>
                        <strong>${student.department || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Semester</label>
                        <strong>${challan.semester || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Session</label>
                        <strong>${challan.session || "—"}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Due Date</label>
                        <strong>${fmt(challan.dueDate)}</strong>
                    </div>

                    <div class="print-info-cell">
                        <label>Status</label>
                        <span class="print-status ${statusClass}">
                            ${status.label}
                        </span>
                    </div>
                </div>

                <table class="print-table">
                    <thead>
                        <tr>
                            <th>Fee Component</th>
                            <th>Amount</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr>
                            <td>Tuition Fee</td>
                            <td>${fmtPKR(challan.totalFee)}</td>
                        </tr>

                        ${
                          challan.lateFee > 0
                            ? `
                                    <tr>
                                        <td>Late Fee</td>
                                        <td>${fmtPKR(challan.lateFee)}</td>
                                    </tr>
                                `
                            : ""
                        }

                        ${
                          challan.discount > 0
                            ? `
                                    <tr>
                                        <td>Discount</td>
                                        <td>- ${fmtPKR(challan.discount)}</td>
                                    </tr>
                                `
                            : ""
                        }

                        ${
                          challan.paidAmount > 0
                            ? `
                                    <tr>
                                        <td>Amount Already Paid</td>
                                        <td>- ${fmtPKR(challan.paidAmount)}</td>
                                    </tr>
                                `
                            : ""
                        }

                        <tr class="print-total-row">
                            <td>Net Payable</td>
                            <td>${fmtPKR(Math.max(0, balance))}</td>
                        </tr>
                    </tbody>
                </table>

                ${paymentRows}

                ${
                  challan.notes
                    ? `
                            <div class="print-note">
                                <strong>Notes:</strong>
                                ${challan.notes}
                            </div>
                        `
                    : ""
                }

                <div class="print-footer">
                    <p>
                        This is an officially generated fee challan.
                        Please keep it for your records.
                    </p>

                    <p>
                        Generated by:
                        ${challan.generatedBy || "System"}
                        &nbsp;|&nbsp;
                        Generated on:
                        ${fmt(challan.createdAt)}
                    </p>
                </div>
            </body>
        </html>
    `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function StudentFees() {
  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("All");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState(null);

  const [activeTab, setActiveTab] = useState("overview");

  // ─────────────────────────────────────────────────────────────────────────
  // FETCH DATA
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const fetchFees = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getStudentFees();

        if (!mounted) return;

        setData(response.data);
      } catch (fetchError) {
        console.error(fetchError);

        if (!mounted) return;

        setError("Failed to load fee information.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchFees();

    return () => {
      mounted = false;
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-state">
        <FontAwesomeIcon icon={faReceipt} className="page-state-icon" />

        <p className="page-state-title">Loading fee information</p>

        <p className="page-state-description">
          Please wait while your fee records are loaded.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="page-state page-state-error">
        <FontAwesomeIcon
          icon={faCircleExclamation}
          className="page-state-icon"
        />

        <p className="page-state-title">Unable to load fees</p>

        <p className="page-state-description">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const {
    student,
    summary,
    challans = [],
    paymentHistory = [],
    upcoming = [],
    notices = [],
  } = data;

  const filteredChallans = challans.filter(
    (challan) => statusFilter === "All" || challan.status === statusFilter,
  );

  const openChallan = (challan) => {
    setSelectedChallan(challan);
    setActiveTab("overview");
    setDrawerOpen(true);
  };

  const getLatestChallan = () =>
    challans.find((challan) => challan.status !== "cancelled");

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-page admin-page student-fees-page">
      {/* ───────────────────────────────────────────────────────────────
                PAGE HEADER
            ─────────────────────────────────────────────────────────────── */}

      <PageHeader
        title="Fees & Challans"
        description="Review fee balances, payment history, and challans."
        action={
          challans.length > 0 ? (
            <div className="page-actions">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const latest = getLatestChallan();

                  if (latest) {
                    printChallan(latest, student);
                  }
                }}
              >
                <FontAwesomeIcon icon={faPrint} />
                <span>Print Challan</span>
              </button>

              <button
                className="btn btn-primary"
                onClick={() => {
                  const latest = getLatestChallan();

                  if (latest) {
                    printChallan(latest, student);
                  }
                }}
              >
                <FontAwesomeIcon icon={faArrowDown} />
                <span>Download Latest</span>
              </button>
            </div>
          ) : null
        }
      />

      {/* ───────────────────────────────────────────────────────────────
                NOTICES
            ─────────────────────────────────────────────────────────────── */}

      {notices.length > 0 && (
        <div className="fee-notices">
          {notices.slice(0, 3).map((notice, index) => {
            const config = NOTICE_CONFIG[notice.level] || NOTICE_CONFIG.info;

            return (
              <div
                key={`${notice.message}-${index}`}
                className={config.className}
              >
                <FontAwesomeIcon
                  icon={config.icon}
                  className="alert-icon"
                />
                <div className="alert-content">
                  <p className="alert-message">{notice.message}</p>
                  {notice.date && (
                    <p className="alert-message">{fmt(notice.date)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────
                SUMMARY
            ─────────────────────────────────────────────────────────────── */}

      <div className="summary-card-grid">
        <SummaryCard
          title="Total Fee"
          value={fmtPKR(summary.netPayable)}
          icon={faMoneyBillWave}
        />

        <SummaryCard
          title="Paid Amount"
          value={fmtPKR(summary.totalPaid)}
          icon={faCircleCheck}
        />

        <SummaryCard
          title="Outstanding"
          value={fmtPKR(summary.outstandingBalance)}
          icon={faTriangleExclamation}
        />

        <SummaryCard
          title="Next Due Date"
          value={summary.nextDueDate ? fmt(summary.nextDueDate) : "No dues"}
          icon={faCalendarDays}
        />

      </div>

      {/* ───────────────────────────────────────────────────────────────
                CHALLANS
            ─────────────────────────────────────────────────────────────── */}

      <div className="student-fees-section">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">Fee Challans</h2>

            <p className="section-description">
              Review generated challans and payment status.
            </p>
          </div>
        </div>

        <div className="student-fees-filters">
          <SearchFilters
            showSearch={false}
            searchValue=""
            onSearchChange={() => {}}
            filters={[
              {
                label: "Status:",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  "All",
                  "paid",
                  "unpaid",
                  "partial",
                  "overdue",
                  "cancelled",
                ],
              },
            ]}
          />
        </div>

        {challans.length === 0 ? (
          <Panel>
            <div className="empty-state">
              <FontAwesomeIcon
                icon={faFileInvoiceDollar}
                className="empty-state-icon"
              />

              <h3>No Challans Generated Yet</h3>

              <p>
                Your fee challans will appear here once generated by the
                administration.
              </p>
            </div>
          </Panel>
        ) : filteredChallans.length === 0 ? (
          <Panel>
            <div className="empty-state">
              <FontAwesomeIcon
                icon={faCircleInfo}
                className="empty-state-icon"
              />

              <h3>No Matching Challans</h3>

              <p>No challans match the selected payment status.</p>
            </div>
          </Panel>
        ) : (
          <Panel>
            <DataTable
              columns={[
                {
                  key: "challanId",
                  label: "Challan ID",
                },

                {
                  key: "semester",
                  label: "Semester",
                },

                {
                  key: "session",
                  label: "Session",
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
                  key: "balance",
                  label: "Balance",
                  render: (value) => fmtPKR(Math.max(0, value || 0)),
                },

                {
                  key: "dueDate",
                  label: "Due Date",
                  render: (value, row) => {
                    const days = daysLeft(value);

                    return (
                      <div className="fee-due-date">
                        <span>{fmt(value)}</span>

                        {row.status !== "paid" && days <= 0 && (
                          <span className="fee-due-overdue">Overdue</span>
                        )}

                        {row.status !== "paid" && days > 0 && days <= 7 && (
                          <span className="fee-due-warning">{days}d left</span>
                        )}
                      </div>
                    );
                  },
                },

                {
                  key: "status",
                  label: "Status",
                  render: (value) => <StatusBadge status={value} />,
                },
              ]}
              data={filteredChallans}
              actions={(challan) => (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => openChallan(challan)}
                    aria-label={`View ${challan.challanId}`}
                  >
                    <FontAwesomeIcon icon={faEye} />
                    <span>View</span>
                  </button>

                  {challan.status !== "cancelled" && (
                    <button
                      className="btn btn-secondary"
                      onClick={() => printChallan(challan, student)}
                      aria-label={`Print ${challan.challanId}`}
                    >
                      <FontAwesomeIcon icon={faPrint} />
                    </button>
                  )}
                </>
              )}
            />
          </Panel>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────
                PAYMENT HISTORY + OUTSTANDING
            ─────────────────────────────────────────────────────────────── */}

      <div className="student-fees-content-grid">
        <Panel title="Payment History">
          {paymentHistory.length === 0 ? (
            <div className="empty-state empty-state-compact">
              <FontAwesomeIcon
                icon={faCreditCard}
                className="empty-state-icon"
              />

              <p>No payments recorded yet.</p>
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "paidAt",
                  label: "Date",
                  render: (value) => fmt(value),
                },

                {
                  key: "challanId",
                  label: "Challan",
                },

                {
                  key: "semester",
                  label: "Semester",
                },

                {
                  key: "amount",
                  label: "Amount",
                  render: (value) => fmtPKR(value),
                },

                {
                  key: "method",
                  label: "Method",
                  render: (value) => <MethodBadge method={value} />,
                },

                {
                  key: "reference",
                  label: "Reference",
                  render: (value) => value || "—",
                },

                {
                  key: "status",
                  label: "Status",
                  render: () => <CompletedBadge />,
                },
              ]}
              data={paymentHistory}
            />
          )}
        </Panel>

        <Panel title="Upcoming Payments">
          {upcoming.length === 0 ? (
            <div className="clear-balance-state compact">
              <FontAwesomeIcon
                icon={faCircleCheck}
                className="clear-balance-icon"
              />

              <p>No upcoming payments due.</p>
            </div>
          ) : (
            <div className="upcoming-list">
              {upcoming.map((item) => {
                const days = item.daysLeft;

                return (
                  <div key={item._id} className="upcoming-item">
                    <div className="upcoming-item-main">
                      <div>
                        <strong>{item.semester}</strong>

                        <span>{item.session}</span>
                      </div>

                      <strong>{fmtPKR(item.balance)}</strong>
                    </div>

                    <div className="upcoming-item-meta">
                      <span>Due: {fmt(item.dueDate)}</span>

                      <span
                        className={`fee-upcoming-status ${
                          days <= 0
                            ? "fee-upcoming-status-overdue"
                            : days <= 7
                              ? "fee-upcoming-status-warning"
                              : "fee-upcoming-status-neutral"
                        }`}
                      >
                        {days <= 0 ? "Overdue" : `${days}d left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ───────────────────────────────────────────────────────────────
                CHALLAN DRAWER
            ─────────────────────────────────────────────────────────────── */}

      <Drawer
        isOpen={drawerOpen}
        title={
          selectedChallan
            ? `${selectedChallan.challanId} — Details`
            : "Challan Details"
        }
        onClose={() => setDrawerOpen(false)}
        width="560px"
        footer={
          <div className="drawer-actions">
            {selectedChallan?.status !== "cancelled" && (
              <button
                className="btn btn-primary"
                onClick={() => printChallan(selectedChallan, student)}
              >
                <FontAwesomeIcon icon={faArrowDown} />
                <span>Download Challan</span>
              </button>
            )}

            <button
              className="btn btn-danger"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>
        }
      >
        {selectedChallan && (
          <>
            <Tabs
              tabs={[
                {
                  id: "overview",
                  label: "Overview",
                },
                {
                  id: "payments",
                  label: "Payments",
                },
                {
                  id: "timeline",
                  label: "Timeline",
                },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            {/* OVERVIEW */}

            {activeTab === "overview" && (
              <div className="drawer-tab-content">
                <div className="fee-drawer-status">
                  <StatusBadge status={selectedChallan.status} />

                  <strong>{selectedChallan.challanId}</strong>
                </div>

                <Panel title="Student Information">
                  <div className="detail-grid">
                    {[
                      ["Name", student.name],
                      ["Roll No.", student.rollNo],
                      ["Program", student.program],
                      ["Department", student.department],
                      ["Semester", selectedChallan.semester],
                      ["Session", selectedChallan.session],
                    ].map(([label, value]) => (
                      <div key={label} className="detail-row">
                        <span className="detail-label">{label}</span>

                        <span className="detail-value">{value || "—"}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Fee Breakdown">
                  <div className="fee-breakdown">
                    <div className="fee-breakdown-row">
                      <span>Tuition Fee</span>

                      <strong>{fmtPKR(selectedChallan.totalFee)}</strong>
                    </div>

                    {selectedChallan.lateFee > 0 && (
                      <div className="fee-breakdown-row">
                        <span>Late Fee</span>

                        <strong>{fmtPKR(selectedChallan.lateFee)}</strong>
                      </div>
                    )}

                    {selectedChallan.discount > 0 && (
                      <div className="fee-breakdown-row fee-breakdown-success">
                        <span>Discount</span>

                        <strong>- {fmtPKR(selectedChallan.discount)}</strong>
                      </div>
                    )}

                    <div className="fee-breakdown-row fee-breakdown-total">
                      <span>Net Payable</span>

                      <strong>
                        {fmtPKR(
                          selectedChallan.netPayable ?? selectedChallan.balance,
                        )}
                      </strong>
                    </div>

                    <div className="fee-breakdown-row fee-breakdown-success">
                      <span>Amount Paid</span>

                      <strong>{fmtPKR(selectedChallan.paidAmount)}</strong>
                    </div>
                  </div>

                  <div
                    className={
                      selectedChallan.balance > 0
                        ? "fee-balance-box fee-balance-box-danger"
                        : "fee-balance-box fee-balance-box-success"
                    }
                  >
                    <span>Outstanding Balance</span>

                    <strong>
                      {fmtPKR(Math.max(0, selectedChallan.balance || 0))}
                    </strong>
                  </div>

                  <div className="fee-due-summary">
                    <div>
                      <span>Due Date</span>

                      <strong>{fmt(selectedChallan.dueDate)}</strong>
                    </div>

                    <StatusBadge status={selectedChallan.status} />
                  </div>
                </Panel>

                {selectedChallan.notes && (
                  <Panel title="Notes">
                    <p className="drawer-note">{selectedChallan.notes}</p>
                  </Panel>
                )}
              </div>
            )}

            {/* PAYMENTS */}

            {activeTab === "payments" && (
              <div className="drawer-tab-content">
                <Panel title="Payment Entries">
                  {selectedChallan.payments?.length > 0 ? (
                    <div className="payment-entry-list">
                      {selectedChallan.payments.map((payment, index) => (
                        <div
                          key={payment._id || index}
                          className="payment-entry"
                        >
                          <div>
                            <strong>{fmtPKR(payment.amount)}</strong>

                            <span>
                              {fmt(payment.paidAt)}

                              {payment.reference
                                ? ` · Ref: ${payment.reference}`
                                : ""}
                            </span>
                          </div>

                          <MethodBadge method={payment.method} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state empty-state-compact">
                      <FontAwesomeIcon
                        icon={faCreditCard}
                        className="empty-state-icon"
                      />

                      <p>No payments recorded for this challan.</p>
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {/* TIMELINE */}

            {activeTab === "timeline" && (
              <div className="drawer-tab-content">
                <Panel title="Payment Timeline">
                  <div className="fee-timeline">
                    {[
                      {
                        icon: faReceipt,
                        label: "Challan Generated",
                        date: selectedChallan.createdAt,
                        done: true,
                      },

                      {
                        icon: faCreditCard,
                        label: "Payment Received",
                        date:
                          selectedChallan.paidAmount > 0
                            ? selectedChallan.payments?.[0]?.paidAt
                            : null,
                        done: selectedChallan.paidAmount > 0,
                      },

                      {
                        icon: faCircleCheck,
                        label: "Payment Completed",
                        date: selectedChallan.paidAt,
                        done: selectedChallan.status === "paid",
                      },
                    ].map((step, index, steps) => (
                      <div key={step.label} className="fee-timeline-item">
                        <div className="fee-timeline-marker-column">
                          <div
                            className={
                              step.done
                                ? "fee-timeline-marker fee-timeline-marker-done"
                                : "fee-timeline-marker"
                            }
                          >
                            <FontAwesomeIcon
                              icon={step.done ? faCheck : step.icon}
                            />
                          </div>

                          {index < steps.length - 1 && (
                            <div
                              className={
                                step.done
                                  ? "fee-timeline-line fee-timeline-line-done"
                                  : "fee-timeline-line"
                              }
                            />
                          )}
                        </div>

                        <div className="fee-timeline-content">
                          <strong className={step.done ? "" : "fee-timeline-label-pending"}>
                            {step.label}
                          </strong>

                          <span>{step.date ? fmt(step.date) : "Pending"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}
