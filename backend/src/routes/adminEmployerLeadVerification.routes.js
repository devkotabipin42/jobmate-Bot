import { Router } from "express";
import {
  updateEmployerLeadVerification,
} from "../controllers/adminEmployerLeadVerification.controller.js";

const router = Router();

router.patch("/:id/verification", updateEmployerLeadVerification);

export default router;
