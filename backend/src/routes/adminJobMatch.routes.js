import { Router } from "express";
import {
  createMatch,
  getMatches,
  patchMatchStatus,
} from "../controllers/adminJobMatch.controller.js";

const router = Router();

router.get("/", getMatches);
router.post("/", createMatch);
router.patch("/:id/status", patchMatchStatus);

export default router;
