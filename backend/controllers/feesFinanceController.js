import mongoose from "mongoose";
import FeeRecord from "../models/FeesFinance.js";
import Student from "../models/Student.js";

const VALID_STATUSES = ["unpaid", "paid", "partial", "overdue", "cancelled"];
const VALID_METHODS = ["cash", "bank", "online"];

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePositiveAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const getNetDue = (record) =>
  Number(record.totalFee || 0) +
  Number(record.lateFee || 0) -
  Number(record.discount || 0);


const refreshOverdueStatuses = async () => {
  const today = new Date();

  // Find active fee records that need their status recalculated.
  const records = await FeeRecord.find({
    status: { $in: ["unpaid", "partial", "overdue", "paid"] },
  }).select(
    "_id totalFee lateFee discount paidAmount dueDate status"
  );

  const operations = [];

  for (const record of records) {
    const netDue =
      Number(record.totalFee || 0) +
      Number(record.lateFee || 0) -
      Number(record.discount || 0);

    const paidAmount = Number(record.paidAmount || 0);
    const dueDate = new Date(record.dueDate);

    let nextStatus;

    if (paidAmount >= netDue) {
      nextStatus = "paid";
    } else if (dueDate < today) {
      nextStatus = "overdue";
    } else if (paidAmount > 0) {
      nextStatus = "partial";
    } else {
      nextStatus = "unpaid";
    }

    if (record.status !== nextStatus) {
      operations.push({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { status: nextStatus } },
        },
      });
    }
  }

  if (operations.length > 0) {
    await FeeRecord.bulkWrite(operations);
  }
};

const syncStudentFeeStatus = async (studentId) => {
  if (!studentId) return;

  const outstanding = await FeeRecord.find({
    student: studentId,
    status: { $in: ["unpaid", "partial", "overdue"] },
  })
    .select("status")
    .lean();

  let feeStatus = "paid";

  if (outstanding.some((record) => record.status === "overdue")) {
    feeStatus = "pending";
  } else if (outstanding.some((record) => record.status === "partial")) {
    feeStatus = "partial";
  } else if (outstanding.length > 0) {
    feeStatus = "pending";
  }

  await Student.findByIdAndUpdate(studentId, { feeStatus });
};

const populateFeeRecord = (query) =>
  query
    .populate("student", "name rollNo cnic email contact")
    .populate("program", "name")
    .populate("classSection", "name section semester")
    .populate("generatedBy", "name")
    .populate("payments.recordedBy", "name");

const generateChallanId = async () => {
  // Random suffix avoids count-based collisions if challans are deleted
  // or multiple administrators generate challans at the same time.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = `${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    const challanId = `CHN-${suffix}`;
    const exists = await FeeRecord.exists({ challanId });

    if (!exists) return challanId;
  }

  throw new Error("Could not generate a unique challan ID. Please try again.");
};

const getFeeStats = async (req, res) => {
  try {
    await refreshOverdueStatuses();

    const activeFilter = { status: { $ne: "cancelled" } };
    const outstandingFilter = {
      status: { $in: ["unpaid", "partial", "overdue"] },
    };

    const [
      totalChallans,
      paidCount,
      pendingCount,
      overdueCount,
      studentsWithDues,
      paidAgg,
      generatedAgg,
      outstandingAgg,
      overdueAgg,
    ] = await Promise.all([
      FeeRecord.countDocuments(activeFilter),
      FeeRecord.countDocuments({ status: "paid" }),
      FeeRecord.countDocuments({ status: { $in: ["unpaid", "partial"] } }),
      FeeRecord.countDocuments({ status: "overdue" }),
      FeeRecord.distinct("student", outstandingFilter),
      FeeRecord.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: "$paidAmount" } } },
      ]),
      FeeRecord.aggregate([
        { $match: activeFilter },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $subtract: [
                  { $add: ["$totalFee", "$lateFee"] },
                  "$discount",
                ],
              },
            },
          },
        },
      ]),
      FeeRecord.aggregate([
        { $match: outstandingFilter },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $subtract: [
                  {
                    $subtract: [
                      { $add: ["$totalFee", "$lateFee"] },
                      "$discount",
                    ],
                  },
                  "$paidAmount",
                ],
              },
            },
          },
        },
      ]),
      FeeRecord.aggregate([
        { $match: { status: "overdue" } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $subtract: [
                  {
                    $subtract: [
                      { $add: ["$totalFee", "$lateFee"] },
                      "$discount",
                    ],
                  },
                  "$paidAmount",
                ],
              },
            },
          },
        },
      ]),
    ]);

    res.status(200).json({
      totalChallans,
      paidCount,
      pendingCount,
      overdueCount,
      studentsWithDues: studentsWithDues.length,
      totalFeesGenerated: generatedAgg[0]?.total || 0,
      paidFees: paidAgg[0]?.total || 0,
      pendingFees: outstandingAgg[0]?.total || 0,
      overdueFees: overdueAgg[0]?.total || 0,
    });
  } catch (error) {
    console.error("getFeeStats error:", error);
    res.status(500).json({ message: "Failed to fetch fee statistics." });
  }
};

const getFeeRecords = async (req, res) => {
  try {
    await refreshOverdueStatuses();

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 15)
    );
    const { status, search, program } = req.query;

    const filter = { status: { $ne: "cancelled" } };

    if (status && status !== "All") {
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: "Invalid fee status filter." });
      }
      filter.status = status;
    }

    if (program && program !== "All") {
      if (!mongoose.isValidObjectId(program)) {
        return res.status(400).json({ message: "Invalid program filter." });
      }
      filter.program = program;
    }

    if (search?.trim()) {
      const expression = new RegExp(escapeRegex(search.trim()), "i");

      const matchingStudents = await Student.find({
        $or: [
          { name: expression },
          { rollNo: expression },
          { cnic: expression },
        ],
      }).distinct("_id");

      filter.$or = [
        { challanId: expression },
        { student: { $in: matchingStudents } },
      ];
    }

    const [records, total] = await Promise.all([
      populateFeeRecord(
        FeeRecord.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
      ),
      FeeRecord.countDocuments(filter),
    ]);

    res.status(200).json({
      records,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("getFeeRecords error:", error);
    res.status(500).json({ message: "Failed to fetch fee records." });
  }
};

const getStudentFeeRecords = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ message: "Invalid student ID." });
    }

    const studentExists = await Student.exists({ _id: studentId });
    if (!studentExists) {
      return res.status(404).json({ message: "Student not found." });
    }

    const records = await populateFeeRecord(
      FeeRecord.find({ student: studentId }).sort({ createdAt: -1 })
    );

    res.status(200).json({ records });
  } catch (error) {
    console.error("getStudentFeeRecords error:", error);
    res.status(500).json({ message: "Failed to fetch student fee history." });
  }
};

const generateChallan = async (req, res) => {
  try {
    const {
      student,
      program,
      classSection,
      semester,
      session,
      totalFee,
      discount = 0,
      dueDate,
      notes,
    } = req.body;

    if (!mongoose.isValidObjectId(student)) {
      return res.status(400).json({ message: "Select a valid student." });
    }

    const parsedFee = Number(totalFee);
    const parsedDiscount = Number(discount);
    const parsedDueDate = new Date(dueDate);

    if (!semester?.trim() || !session?.trim()) {
      return res.status(400).json({
        message: "Semester and session are required.",
      });
    }

    if (!Number.isFinite(parsedFee) || parsedFee <= 0) {
      return res.status(400).json({
        message: "Total fee must be a positive amount.",
      });
    }

    if (
      !Number.isFinite(parsedDiscount) ||
      parsedDiscount < 0 ||
      parsedDiscount > parsedFee
    ) {
      return res.status(400).json({
        message: "Discount must be between zero and the total fee.",
      });
    }

    if (!dueDate || Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ message: "Provide a valid due date." });
    }

    const studentDoc = await Student.findById(student);
    if (!studentDoc) {
      return res.status(404).json({ message: "Student not found." });
    }

    if (program && !mongoose.isValidObjectId(program)) {
      return res.status(400).json({ message: "Invalid program." });
    }

    if (classSection && !mongoose.isValidObjectId(classSection)) {
      return res.status(400).json({ message: "Invalid class." });
    }

    const challanId = await generateChallanId();

    const record = await FeeRecord.create({
      challanId,
      student,
      program: program || undefined,
      classSection: classSection || undefined,
      semester: semester.trim(),
      session: session.trim(),
      totalFee: parsedFee,
      discount: parsedDiscount,
      dueDate: parsedDueDate,
      notes: notes?.trim() || "",
      generatedBy: req.user.id,
    });

    await syncStudentFeeStatus(student);

    const populated = await populateFeeRecord(
      FeeRecord.findById(record._id)
    );

    res.status(201).json({
      message: "Challan generated successfully.",
      record: populated,
    });
  } catch (error) {
    console.error("generateChallan error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "A challan with this ID already exists. Please try again.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Failed to generate challan." });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { amount, method, reference } = req.body;
    const { id } = req.params;
    const parsedAmount = parsePositiveAmount(amount);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid fee record ID." });
    }

    if (parsedAmount === null) {
      return res.status(400).json({
        message: "Payment amount must be a positive number.",
      });
    }

    if (!VALID_METHODS.includes(method)) {
      return res.status(400).json({ message: "Select a valid payment method." });
    }

    const record = await FeeRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Fee record not found." });
    }

    if (record.status === "cancelled") {
      return res.status(400).json({
        message: "Cannot pay a cancelled challan.",
      });
    }

    const remaining = getNetDue(record) - record.paidAmount;

    if (remaining <= 0) {
      return res.status(400).json({
        message: "This challan is already fully paid.",
      });
    }

    if (parsedAmount > remaining) {
      return res.status(400).json({
        message: `Payment exceeds the remaining balance of ${remaining}.`,
      });
    }

    record.payments.push({
      amount: parsedAmount,
      method,
      reference: reference?.trim() || "",
      recordedBy: req.user.id,
      paidAt: new Date(),
    });

    record.paidAmount += parsedAmount;
    await record.save();

    await syncStudentFeeStatus(record.student);

    const updated = await populateFeeRecord(
      FeeRecord.findById(record._id)
    );

    res.status(200).json({
      message: "Payment recorded successfully.",
      record: updated,
    });
  } catch (error) {
    console.error("recordPayment error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Failed to record payment." });
  }
};

const updateFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid fee record ID." });
    }

    const record = await FeeRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Fee record not found." });
    }

    if (record.status === "paid" || record.status === "cancelled") {
      return res.status(400).json({
        message: "Paid or cancelled challans cannot be edited.",
      });
    }

    // Never allow this endpoint to rewrite payment history or status.
    const allowedFields = [
      "semester",
      "session",
      "dueDate",
      "notes",
    ];

    // Financial changes are allowed only before any payment is recorded.
    if (record.paidAmount === 0 && record.payments.length === 0) {
      allowedFields.push("totalFee", "discount", "lateFee");
    }

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        record[field] = req.body[field];
      }
    }

    if (record.discount > record.totalFee + record.lateFee) {
      return res.status(400).json({
        message: "Discount cannot exceed the total fee plus late fee.",
      });
    }

    await record.save();
    await syncStudentFeeStatus(record.student);

    const updated = await populateFeeRecord(
      FeeRecord.findById(record._id)
    );

    res.status(200).json({
      message: "Fee record updated successfully.",
      record: updated,
    });
  } catch (error) {
    console.error("updateFeeRecord error:", error);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Failed to update fee record." });
  }
};

const cancelChallan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid fee record ID." });
    }

    const record = await FeeRecord.findById(id);

    if (!record) {
      return res.status(404).json({ message: "Fee record not found." });
    }

    if (record.status === "paid") {
      return res.status(400).json({
        message: "A fully paid challan cannot be cancelled.",
      });
    }

    if (record.status === "cancelled") {
      return res.status(400).json({
        message: "This challan is already cancelled.",
      });
    }

    if (record.paidAmount > 0 || record.payments.length > 0) {
      return res.status(400).json({
        message:
          "This challan has payment history. Resolve or refund the payment before cancellation.",
      });
    }

    record.status = "cancelled";
    await record.save();

    await syncStudentFeeStatus(record.student);

    res.status(200).json({
      message: "Challan cancelled successfully.",
      record,
    });
  } catch (error) {
    console.error("cancelChallan error:", error);
    res.status(500).json({ message: "Failed to cancel challan." });
  }
};

const getOverdueAlerts = async (req, res) => {
  try {
    await refreshOverdueStatuses();

    const overdue = await populateFeeRecord(
      FeeRecord.find({ status: "overdue" }).sort({ dueDate: 1 })
    );

    res.status(200).json({
      count: overdue.length,
      overdue,
    });
  } catch (error) {
    console.error("getOverdueAlerts error:", error);
    res.status(500).json({ message: "Failed to fetch overdue alerts." });
  }
};

export {
  getFeeStats,
  getFeeRecords,
  getStudentFeeRecords,
  generateChallan,
  recordPayment,
  updateFeeRecord,
  cancelChallan,
  getOverdueAlerts,
};