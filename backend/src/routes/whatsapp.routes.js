import express from "express";
import {
  verifyWhatsAppWebhook,
  receiveWhatsAppWebhook,
} from "../controllers/whatsapp.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

router.get("/webhook", asyncHandler(verifyWhatsAppWebhook));
router.post("/webhook", asyncHandler(receiveWhatsAppWebhook));

export default router;
