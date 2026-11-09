import { createDepartment, getDepartments, getDepartmentById, updateDepartment, deleteDepartment} from "../controllers/departmentController.js";
import { authRoles } from "../middlewares/roleMiddleware.js";
import { protect } from "../middlewares/authMiddleware.js";
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/", authRoles("admin"), createDepartment);

router.get("/", getDepartments);

router.get("/:id", getDepartmentById);

router.put("/:id", authRoles("admin"), updateDepartment);

router.delete("/:id", authRoles("admin"), deleteDepartment);

export default router;