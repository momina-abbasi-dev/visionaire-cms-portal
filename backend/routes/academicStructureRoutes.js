import express from "express"
import { getAcademicStructureStats, getRelationshipTree } from "../controllers/academicStructureController.js"
import { protect }    from "../middlewares/authMiddleware.js"
import { authRoles }  from "../middlewares/roleMiddleware.js"

const router = express.Router()

router.use(protect)

router.get("/stats", authRoles("admin"), getAcademicStructureStats)
router.get("/tree",  authRoles("admin"), getRelationshipTree)

export default router