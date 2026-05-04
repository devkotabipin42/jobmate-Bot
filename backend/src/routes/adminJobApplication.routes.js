import { Router } from "express";
import {
  listJobApplications,
  getJobApplicationDetail,
  updateJobApplicationStatus,
} from "../controllers/adminJobApplication.controller.js";

const router = Router();

router.get("/", listJobApplications);
router.get("/:id", getJobApplicationDetail);
router.patch("/:id/status", updateJobApplicationStatus);

export default router;
