import express from "express";
import {
  getFeeStats,
  getFeeRecords,
  getStudentFeeRecords,
  generateChallan,
  recordPayment,
  updateFeeRecord,
  cancelChallan,
  getOverdueAlerts,
} from "../controllers/feesFinanceController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authRoles } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/stats", authRoles("admin"), getFeeStats);
router.get("/overdue", authRoles("admin"), getOverdueAlerts);
router.get("/student/:studentId", authRoles("admin"), getStudentFeeRecords);

router.get("/", authRoles("admin"), getFeeRecords);
router.post("/", authRoles("admin"), generateChallan);
router.post("/:id/payment", authRoles("admin"), recordPayment);
router.put("/:id", authRoles("admin"), updateFeeRecord);
router.patch("/:id/cancel", authRoles("admin"), cancelChallan);

export default router;