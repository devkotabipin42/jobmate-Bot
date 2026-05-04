import { Router } from "express";
import { getFollowups, processFollowups, cancelFollowupById } from "../controllers/adminFollowup.controller.js";

const router = Router();

router.get("/", getFollowups);
router.post("/process", processFollowups);
router.patch("/:id/cancel", cancelFollowupById);

export default router;
