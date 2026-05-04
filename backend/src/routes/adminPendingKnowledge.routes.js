import { Router } from "express";
import {
  listPendingKnowledge,
  approvePendingKnowledge,
  rejectPendingKnowledge,
  applyPendingKnowledge,
} from "../controllers/adminPendingKnowledge.controller.js";

const router = Router();

router.get("/", listPendingKnowledge);
router.post("/:id/approve", approvePendingKnowledge);
router.post("/:id/apply", applyPendingKnowledge);
router.post("/:id/reject", rejectPendingKnowledge);

export default router;
