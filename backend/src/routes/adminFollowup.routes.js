import { Router } from "express";
import { getFollowups, processFollowups } from "../controllers/adminFollowup.controller.js";

const router = Router();

router.get("/", getFollowups);
router.post("/process", processFollowups);

export default router;
