import { createSubject, getSubjects, getSubjectById, updateSubject, deleteSubject } from "../controllers/subjectController.js";
import {protect} from "../middlewares/authMiddleware.js";
import {authRoles} from "../middlewares/roleMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createSubject);

router.get("/", getSubjects);

router.get("/:id", getSubjectById);

router.put("/:id", authRoles("admin"), updateSubject);

router.delete("/:id", authRoles("admin"), deleteSubject);

export default router;