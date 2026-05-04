import { Router } from "express";
import {
  listJobApplications,
  updateJobApplicationStatus,
} from "../controllers/adminJobApplication.controller.js";

const router = Router();

router.get("/", listJobApplications);
router.patch("/:id/status", updateJobApplicationStatus);

export default router;
