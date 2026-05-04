import { Router } from "express";
import {
  getEmployerLeadWorkerMatches,
} from "../controllers/adminWorkerMatch.controller.js";

const router = Router();

router.get("/:id/matches", getEmployerLeadWorkerMatches);

export default router;
