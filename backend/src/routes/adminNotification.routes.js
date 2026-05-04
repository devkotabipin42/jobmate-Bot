import { Router } from "express";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "../controllers/adminNotification.controller.js";

const router = Router();

router.get("/", getNotifications);
router.patch("/read-all", readAllNotifications);
router.patch("/:id/read", readNotification);

export default router;
