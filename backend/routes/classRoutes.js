import { createClass, getClasses, getClassById, updateClass, deleteClass } from "../controllers/classController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createClass);

router.get("/", authRoles("admin"), getClasses);

router.get("/:id", authRoles("admin"), getClassById);

router.put("/:id", authRoles("admin"), updateClass);

router.delete("/:id", authRoles("admin"), deleteClass);

export default router;