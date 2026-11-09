import { generateResult, viewResults } from "../controllers/resultController.js";
import { authRoles } from "../middlewares/roleMiddleware.js"
import { protect } from "../middlewares/authMiddleware.js"
import express from "express";

const router = express.Router();

router.use(protect);

router.post("/generateResult", authRoles("student"), generateResult);

router.get("/myResults", authRoles("student"), viewResults);

export default router;