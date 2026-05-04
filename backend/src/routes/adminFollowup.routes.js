import { Router } from "express";
import { getFollowups } from "../controllers/adminFollowup.controller.js";

const router = Router();

router.get("/", getFollowups);

export default router;
