import {
    createAssignment,
    deactivateAssignment,
    getAssignments,
    updateAssignment,
} from "../controllers/academicAssignmentController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createAssignment);
router.patch("/:id", authRoles("admin"), updateAssignment);
router.patch("/:id/deactivate", authRoles("admin"), deactivateAssignment);

router.get("/", authRoles("admin"), getAssignments);

export default router;