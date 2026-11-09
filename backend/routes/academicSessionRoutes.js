import express from "express";
import {
    createAcademicSession,
    getAcademicSessionById,
    getAcademicSessions,
    updateAcademicSession,
} from "../controllers/academicSessionController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authRoles("admin"));

router.get("/", getAcademicSessions);
router.get("/:id", getAcademicSessionById);
router.post("/", createAcademicSession);
router.patch("/:id", updateAcademicSession);

export default router;
