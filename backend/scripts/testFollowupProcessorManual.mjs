import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ScheduledFollowup } from "../src/models/ScheduledFollowup.model.js";
import { Notification } from "../src/models/Notification.model.js";
import { processDueFollowups } from "../src/services/followups/followupProcessor.service.js";

let failed = 0;

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "✅" : "❌"} ${name}`);

  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

const testRunId = `followup-manual-${Date.now()}`;
const targetId = new mongoose.Types.ObjectId();
const phone = "9779800000000";

async function cleanup() {
  await ScheduledFollowup.deleteMany({
    "templateData.testRunId": testRunId,
  });

  await Notification.deleteMany({
    "metadata.testRunId": testRunId,
  });
}

try {
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ MongoDB connected for follow-up processor manual test");

  await cleanup();

  const followup = await ScheduledFollowup.create({
    targetType: "WorkerProfile",
    targetId,
    phone,
    triggerType: "stale_profile",
    templateName: "stale_profile_check",
    templateData: {
      name: "Manual Test",
      testRunId,
    },
    scheduledAt: new Date(Date.now() - 60 * 1000),
    status: "pending",
  });

  assert("created due followup", Boolean(followup?._id));

  const dryRunResult = await processDueFollowups({
    limit: 5,
    dryRun: true,
  });

  assert("dry run scanned at least one followup", dryRunResult.scanned >= 1);
  assert("dry run mode true", dryRunResult.dryRun === true);

  const afterDryRun = await ScheduledFollowup.findById(followup._id).lean();
  assert("dry run keeps followup pending", afterDryRun.status === "pending", afterDryRun.status);

  const realResult = await processDueFollowups({
    limit: 5,
    dryRun: false,
  });

  assert("real process scanned at least one followup", realResult.scanned >= 1);
  assert("real process marked one sent", realResult.sent >= 1, JSON.stringify(realResult, null, 2));

  const afterRealRun = await ScheduledFollowup.findById(followup._id).lean();
  assert("real process marks followup sent", afterRealRun.status === "sent", afterRealRun.status);
  assert("real process sets sentAt", Boolean(afterRealRun.sentAt));
  assert("real process increments attempts", afterRealRun.attempts === 1, String(afterRealRun.attempts));

  const notification = await Notification.findOne({
    type: "follow_up_due",
    "metadata.followupId": String(followup._id),
  }).lean();

  assert("real process creates notification", Boolean(notification?._id));
  assert("notification keeps phone", notification?.phone === phone, notification?.phone);
  assert("notification links entity type", notification?.entityType === "WorkerProfile", notification?.entityType);
  assert("notification metadata delivery mode", notification?.metadata?.deliveryMode === "dashboard_notification");

  if (notification?._id) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "metadata.testRunId": testRunId,
        },
      }
    );
  }

  await cleanup();

  console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);
} catch (error) {
  failed += 1;
  console.error("\n❌ follow-up processor manual test crashed");
  console.error(error);
} finally {
  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}
