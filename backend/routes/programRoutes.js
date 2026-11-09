import { createProgram, getPrograms, getProgramById, updateProgram, deleteProgram } from "../controllers/programController.js"
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createProgram);

router.get("/", getPrograms);

router.get("/:id", getProgramById);

router.put("/:id", authRoles("admin"), updateProgram);

router.delete("/:id", authRoles("admin"), deleteProgram);

export default router;