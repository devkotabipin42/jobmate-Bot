import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import whatsappRoutes from "./routes/whatsapp.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import adminRoutes from "./routes/admin.routes.js";
import adminJobMatchRoutes from "./routes/adminJobMatch.routes.js";
import adminFollowupRoutes from "./routes/adminFollowup.routes.js";
import adminNotificationRoutes from "./routes/adminNotification.routes.js";
import adminWorkerMatchRoutes from "./routes/adminWorkerMatch.routes.js";
import adminJobApplicationRoutes from "./routes/adminJobApplication.routes.js";
import adminEmployerLeadVerificationRoutes from "./routes/adminEmployerLeadVerification.routes.js";
import adminPendingKnowledgeRoutes from "./routes/adminPendingKnowledge.routes.js";
import jobmateFollowupExternalRoutes from './routes/external/jobmateFollowupExternal.routes.js'
import { startFollowupRunner } from "./services/followups/followupRunner.service.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({
    app: "JobMate Communication Automation API",
    status: "running",
    environment: env.NODE_ENV,
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/matches", adminJobMatchRoutes);
app.use('/api/external', jobmateFollowupExternalRoutes)
app.use("/api/admin/followups", adminFollowupRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/employer-leads", adminWorkerMatchRoutes);
app.use("/api/admin/job-applications", adminJobApplicationRoutes);
app.use("/api/admin/employer-leads", adminEmployerLeadVerificationRoutes);
app.use("/api/admin/pending-knowledge", adminPendingKnowledgeRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

await connectDB();
startFollowupRunner();

app.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`);
});
