import express from "express";

import {
    getAdmissionStats,
    applyAdmission,
    getAdmissions,
    reviewAdmission,
} from "../controllers/admissionController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authRoles } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Public application submission
router.post("/", applyAdmission);

// Admin and admission staff
router.get(
    "/stats",
    protect,
    authRoles("admin"),
    getAdmissionStats
);

router.get(
    "/",
    protect,
    authRoles("admin", "admission"),
    getAdmissions
);

router.patch(
    "/:id/review",
    protect,
    authRoles("admin", "admission"),
    reviewAdmission
);

export default router;