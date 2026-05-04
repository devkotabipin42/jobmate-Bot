import { env } from "../../config/env.js";
import {
  listDueFollowups,
  markFollowupSent,
  markFollowupFailed,
} from "./followupScheduler.service.js";
import { buildFollowupMessage } from "./followupTemplates.js";
import { createNotification } from "../notifications/notification.service.js";
import { sendWhatsAppTextMessage } from "../whatsapp/whatsappClient.service.js";

function resolveEntityType(targetType = "") {
  if (["WorkerProfile", "EmployerLead", "JobApplication"].includes(targetType)) {
    return targetType;
  }

  return "System";
}

function buildNotificationTitle(followup = {}) {
  const trigger = String(followup.triggerType || "follow_up_due")
    .replace(/_/g, " ")
    .trim();

  return `Follow-up due: ${trigger}`;
}

export async function processDueFollowups({ limit = 25, dryRun = false } = {}) {
  const followups = await listDueFollowups({ limit });

  const results = {
    scanned: followups.length,
    sent: 0,
    failed: 0,
    dryRun: Boolean(dryRun),
    items: [],
  };

  for (const followup of followups) {
    try {
      const message = buildFollowupMessage(
        followup.templateName,
        followup.templateData || {}
      );

      if (!message) {
        throw new Error(`Missing follow-up template: ${followup.templateName}`);
      }

      let deliveryMode = "dashboard_notification";
      let whatsappResult = null;

      if (!dryRun && env.FOLLOWUP_WHATSAPP_SEND_ENABLED) {
        whatsappResult = await sendWhatsAppTextMessage({
          to: followup.phone,
          text: message,
        });

        deliveryMode = whatsappResult?.skipped
          ? "whatsapp_skipped_dashboard_notification"
          : "whatsapp_and_dashboard_notification";
      }

      if (!dryRun) {
        await createNotification({
          type: "follow_up_due",
          title: buildNotificationTitle(followup),
          message,
          priority: "medium",
          entityType: resolveEntityType(followup.targetType),
          entityId: followup.targetId,
          phone: followup.phone,
          metadata: {
            followupId: String(followup._id),
            triggerType: followup.triggerType,
            templateName: followup.templateName,
            templateData: followup.templateData || {},
            deliveryMode,
            whatsapp: whatsappResult
              ? {
                  skipped: Boolean(whatsappResult.skipped),
                  reason: whatsappResult.reason || "",
                  provider: whatsappResult.provider || "",
                  providerMessageId: whatsappResult.providerMessageId || "",
                }
              : null,
          },
        });

        await markFollowupSent(followup._id);
      }

      results.sent += 1;
      results.items.push({
        id: String(followup._id),
        status: dryRun ? "dry_run" : "sent",
        phone: followup.phone,
        triggerType: followup.triggerType,
        templateName: followup.templateName,
        deliveryMode: dryRun ? "dry_run" : deliveryMode,
      });
    } catch (error) {
      results.failed += 1;

      if (!dryRun) {
        await markFollowupFailed(followup._id, error.message);
      }

      results.items.push({
        id: String(followup._id),
        status: "failed",
        phone: followup.phone,
        triggerType: followup.triggerType,
        templateName: followup.templateName,
        error: error.message,
      });
    }
  }

  return results;
}
