import express from "express";
import { createUser, getAllUsers, getUserById, updateUser, deleteUser, getUserStats } from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";
import { authRoles } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/",        authRoles("admin"), createUser);
router.get("/",         authRoles("admin"), getAllUsers);
router.get("/stats",    authRoles("admin"), getUserStats);  // ← must be ABOVE /:id

router.get("/:id",      authRoles("admin"), getUserById);
router.put("/:id",      authRoles("admin"), updateUser);
router.delete("/:id",   authRoles("admin"), deleteUser);

export default router;