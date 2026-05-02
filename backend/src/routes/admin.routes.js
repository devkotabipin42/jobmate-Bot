import express from "express";
import { adminLogin } from "../controllers/adminAuth.controller.js";
import { requireAdminAuth } from "../middleware/adminAuth.middleware.js";
import {
  getAdminBusinessLeads,
  patchAdminBusinessLeadStatus,
} from "../controllers/adminBusinessLead.controller.js";
import {
  getAdminBusinessProfile,
  patchAdminBusinessProfile,
  postAdminBusinessService,
  deleteAdminBusinessService,
  postAdminBusinessFAQ,
  deleteAdminBusinessFAQ,
} from "../controllers/adminBusinessProfile.controller.js";

import {
  getAdminDashboardSummary,

  listAdminEmployerLeads,
  getAdminEmployerLeadDetail,
  patchAdminEmployerLeadStatus,

  listAdminWorkers,
  getAdminWorkerDetail,
  patchAdminWorkerStatus,

  listAdminHandoffs,
  getAdminHandoffDetail,
  patchAdminHandoffStatus,
  patchAdminHandoffAssign,
  patchAdminHandoffCall,

  listAdminConversations,
  getAdminConversationMessages,
} from "../controllers/admin.controller.js";

const router = express.Router();

router.post("/auth/login", adminLogin);
router.use(requireAdminAuth);



router.get("/business-leads", getAdminBusinessLeads);
router.patch("/business-leads/:leadId/status", patchAdminBusinessLeadStatus);

router.get("/business-profile", getAdminBusinessProfile);
router.patch("/business-profile", patchAdminBusinessProfile);

router.post("/business-profile/services", postAdminBusinessService);
router.delete("/business-profile/services/:serviceId", deleteAdminBusinessService);

router.post("/business-profile/faqs", postAdminBusinessFAQ);
router.delete("/business-profile/faqs/:faqId", deleteAdminBusinessFAQ);

router.get("/dashboard/summary", getAdminDashboardSummary);

router.get("/employer-leads", listAdminEmployerLeads);
router.get("/employer-leads/:id", getAdminEmployerLeadDetail);
router.patch("/employer-leads/:id/status", patchAdminEmployerLeadStatus);

router.get("/workers", listAdminWorkers);
router.get("/workers/:id", getAdminWorkerDetail);
router.patch("/workers/:id/status", patchAdminWorkerStatus);

router.get("/handoffs", listAdminHandoffs);
router.get("/handoffs/:id", getAdminHandoffDetail);
router.patch("/handoffs/:id/status", patchAdminHandoffStatus);
router.patch("/handoffs/:id/assign", patchAdminHandoffAssign);
router.patch("/handoffs/:id/call", patchAdminHandoffCall);

router.get("/conversations", listAdminConversations);
router.get("/conversations/:contactId/messages", getAdminConversationMessages);

export default router;
