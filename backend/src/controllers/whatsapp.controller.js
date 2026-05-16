import { MetaPayloadNormalizer } from "../services/whatsapp/metaPayloadNormalizer.service.js";
import { classifyIntent } from "../services/automation/intentClassifier.service.js";

import {
  createOrUpdateContactFromNormalizedMessage,
  applyContactIntentState,
} from "../services/automation/contact.service.js";

import {
  getOrCreateConversation,
  updateConversationIntent,
  markConversationOptedOut,
  resetConversationForRestart,
} from "../services/automation/conversationState.service.js";
import {
  buildJobMateMainMenuReply,
  buildUnavailableMainMenuSelectionReply,
  isStartRestartMenuCommand,
  resolveMainMenuSelection,
  shouldHandleMainMenuSelection,
} from "../services/automation/startRestartMenu.service.js";

import {
  reserveMessageForProcessing,
  markMessageProcessed,
  markMessageFailed,
  saveInboundMessage,
  saveOutboundMessage,
} from "../services/automation/message.service.js";

import { handleWorkerRegistration } from "../services/automation/workerRegistration.service.js";
import { handleEmployerLead } from "../services/automation/employerLead.service.js";

import {
  createHandoffRequest,
  shouldCreateHandoff,
  resolveHandoffPriority,
  resolveHandoffReason,
} from "../services/automation/handoff.service.js";

import { buildReplyMessage } from "../services/whatsapp/replyBuilder.service.js";
import { AARATI_SAMPLE_REPLIES } from "../personas/aarati.persona.js";
import { sendWhatsAppTextMessage } from "../services/whatsapp/whatsappClient.service.js";

import {
  parseJobSearchQuery,
  searchJobMateJobs,
  formatJobsForWhatsApp,
} from "../services/jobmate/jobmateJobsClient.service.js";

import { applyAIIntentFallback } from "../services/ai/aiClassifierFallback.service.js";
import { understandMessageWithAI } from "../services/ai/aiBrain.service.js";
import { handleBusinessReceptionistMessage } from "../services/automation/businessReceptionistFlow.service.js";
import { upsertBusinessLeadFromReceptionist } from "../services/business/businessLead.service.js";
import {
  sendTelegramAlert,
  buildEmployerLeadAlert,
  buildWorkerQualifiedAlert,
} from "../services/telegram/telegramAlert.service.js";

import { env } from "../config/env.js";
import { applyJobMateRoutingGuards } from "../services/automation/jobmateRoutingGuards.service.js";
import { detectJobMateSafetyEvent } from "../services/safety/jobmateSafetyGuards.service.js";
import { detectConversationRepairEvent } from "../services/safety/jobmateConversationRepair.service.js";
import { jobmateConfig } from "../configs/jobmate.config.js";
import { findJobMateKnowledgeAnswer } from "../services/rag/jobmateKnowledgeAnswer.service.js";
import { getAaratiHumanBoundaryAnswer } from "../services/aarati/aaratiHumanBoundary.service.js";
import { getAaratiHumanIntentFormattedAnswer } from "../services/aarati/aaratiHumanIntentFormatter.service.js";
import { generateAaratiAiFirstAnswer } from "../services/aarati/aaratiAiFirstRouter.service.js";
import { getAaratiPreFlowQaAnswer } from "../services/aarati/aaratiPreFlowQaGuard.service.js";
import { getAaratiActiveFlowSideReply } from "../services/aarati/aaratiActiveFlowSideReply.service.js";
import { getAaratiHardSafetyBoundaryAnswer } from "../services/aarati/aaratiHardSafetyBoundary.service.js";
import {
  detectNoFlowTrap,
  buildNoFlowTrapReply,
  shouldBlockWorkerFlowParsing,
  shouldBlockEmployerFlowParsing,
} from "../services/aarati/aaratiNoFlowTrapGate.service.js";
import { getAaratiEmployerDirectRoute } from "../services/aarati/aaratiEmployerDirectRouter.service.js";
import { getUserTextForPolish, polishAaratiReply } from "../services/aarati/aaratiReplyPolish.service.js";
import { generateJobMateGeneralAnswer } from "../services/rag/jobmateGeneralAnswer.service.js";
import {
  reduceMenuRepetition,
  rememberLastContextPatch,
} from "../services/aarati/aaratiConversationDirector.service.js";
import { decideAaratiNextAction } from "../services/aarati/aaratiConversationDecision.service.js";
import { decideFollowupReplyContext } from "../services/aarati/aaratiFollowupReplyContextGuard.service.js";
import { detectAaratiEmployerIntentRecovery } from "../services/aarati/aaratiEmployerIntentRecovery.service.js";
import { handleAaratiJobSearchControlGuard } from "../services/aarati/aaratiJobSearchControlGuard.service.js";
import { handleAaratiJobSearchContinuation } from "../services/aarati/aaratiJobSearchContinuation.service.js";
import {
  isJobSearchConfirmationActivation,
  decideJobSearchConfirmationAction,
} from "../services/aarati/aaratiJobSearchConfirmation.service.js";
import { WorkerProfile } from "../models/WorkerProfile.model.js";
import {
  buildDocumentReceivedReply,
  buildSafeDocumentAttachmentMetadata,
  isSupportedDocumentMedia,
  saveWorkerDocumentMetadata,
} from "../services/uploads/documentUpload.service.js";
import {
  buildLeadAgentConversationPatch,
  handleJobMateLeadAgentMessage,
} from "../services/jobmateLeadAgent/jobmateLeadAgent.service.js";
import {
  decideUnderstandingAction,
} from "../services/aaratiUnderstanding/aaratiUnderstanding.service.js";

/**
 * Meta WhatsApp webhook verification.
 * Meta calls this GET endpoint when setting up webhook.
 */

function isGenericHelpRequest(text = "") {
  const value = String(text || "").toLowerCase().trim();

  if (!value) return false;

  const hasHelpWord = /\bhelp\b|sahayog|madat|help gar|help garnu/i.test(value);
  const hasClearHumanRequest = /human|agent|phone|call|team sanga|manche sanga|manxe sanga|staff sanga/i.test(value);
  const hasClearJobMateIntent = /staff|worker|kaam|kam|job|jagir|company|salary|register|apply/i.test(value);

  return hasHelpWord && !hasClearHumanRequest && !hasClearJobMateIntent;
}



export async function verifyWhatsAppWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({
    success: false,
    message: "Webhook verification failed",
  });
}

/**
 * Receive inbound WhatsApp webhook events from Meta.
 */
export async function receiveWhatsAppWebhook(req, res) {
  const normalized = MetaPayloadNormalizer.normalize(req.body);

  if (!normalized.ok) {
    return res.status(200).json({
      success: true,
      ignored: true,
      reason: normalized.reason,
    });
  }

  const phone = normalized.contact.phone;
  const providerMessageId = normalized.message.providerMessageId;

  const reservation = await reserveMessageForProcessing({
    provider: normalized.provider,
    providerMessageId,
    phone,
  });

  if (reservation.isDuplicate) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      reason: reservation.reason,
    });
  }

  const processedMessageId = reservation.processedMessage?._id;

  try {
    let contact = await createOrUpdateContactFromNormalizedMessage(normalized);

    const conversation = await getOrCreateConversation({
      contact,
      channel: "whatsapp",
    });

    // ── Human takeover guard ────────────────────────────────────────────────
    // If an admin has taken over this conversation, save the inbound message
    // for the conversation history but do NOT process or auto-reply.
    if (
      conversation?.botMode === "human_paused" ||
      contact?.botMode === "human_paused"
    ) {
      await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: {
          intent: "human_handoff",
          needsHuman: true,
          priority: "high",
          reason: "bot_paused_human_active",
        },
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        ignored: true,
        reason: "bot_paused_human_active",
      });
    }

    const startMenuText =
      normalized.message.normalizedText ||
      normalized.message.text ||
      "";

    if (env.BOT_MODE === "jobmate_hiring" && isStartRestartMenuCommand(startMenuText)) {
      const menuReply = buildJobMateMainMenuReply();
      const resetConversation = await resetConversationForRestart(conversation, {
        menuActive: true,
        lastQuestion: menuReply,
      });

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation: resetConversation,
        normalized,
        intentResult: {
          intent: "unknown",
          needsHuman: false,
          priority: "low",
          reason: "hard_start_restart_menu_reset",
        },
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: menuReply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation: resetConversation,
        text: menuReply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation: resetConversation,
        intent: "unknown",
        state: "idle",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate start/restart menu reset handled message",
        reason: "hard_start_restart_menu_reset",
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    if (
      env.BOT_MODE === "jobmate_hiring" &&
      shouldHandleMainMenuSelection({ text: startMenuText, conversation })
    ) {
      const menuSelection = resolveMainMenuSelection(startMenuText);
      const resetConversation = await resetConversationForRestart(conversation, {
        menuActive: false,
        lastQuestion: null,
      });

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation: resetConversation,
        normalized,
        intentResult: {
          intent: menuSelection.intent,
          needsHuman: false,
          priority: "low",
          reason: menuSelection.reason,
        },
      });

      let flowResult = null;

      if (menuSelection.flow === "worker") {
        flowResult = await handleWorkerRegistration({
          contact,
          conversation: resetConversation,
          normalizedMessage: normalized,
        });
      } else if (menuSelection.flow === "employer") {
        flowResult = await handleEmployerLead({
          contact,
          conversation: resetConversation,
          normalizedMessage: normalized,
          aiExtraction: null,
        });
      } else if (menuSelection.flow === "unavailable") {
        flowResult = {
          intent: "unknown",
          currentState: "idle",
          messageToSend: buildUnavailableMainMenuSelectionReply(),
          conversation: resetConversation,
        };
      } else {
        flowResult = await handleJobMateLeadAgentMessage({
          contact,
          conversation: resetConversation,
          normalizedMessage: buildSyntheticNormalizedMessage({
            normalized,
            text: "sahakari partnership garna cha",
          }),
        });
      }

      const activeConversation = flowResult?.conversation || resetConversation;
      const replyText = flowResult?.reply || flowResult?.messageToSend || "";

      if (flowResult?.state && menuSelection.flow === "sahakari") {
        const patch = buildLeadAgentConversationPatch({
          result: flowResult,
          inboundMessageId: inboundMessage._id,
        });

        if (patch && activeConversation?._id) {
          const ConvModel = activeConversation.constructor;
          await ConvModel.updateOne(
            { _id: activeConversation._id },
            patch,
            { runValidators: false }
          );
        }
      }

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: replyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation: activeConversation,
        text: replyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      const conversationIntent =
        menuSelection.flow === "sahakari"
          ? flowResult?.conversationIntent || "unknown"
          : menuSelection.intent;

      await updateConversationIntent({
        conversation: activeConversation,
        intent: conversationIntent,
        state: flowResult?.currentState || activeConversation.currentState || "idle",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate main menu selection handled message",
        reason: menuSelection.reason,
        intent: menuSelection.intent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const activeAutomationFlowRoute =
      env.BOT_MODE === "jobmate_hiring"
        ? getJobMateAutomationActiveFlowRoute(conversation)
        : null;

    if (activeAutomationFlowRoute === "employer") {
      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: {
          intent: "employer_lead",
          needsHuman: false,
          priority: "low",
          reason: "active_employer_flow_state_priority",
        },
      });

      const flowResult = await handleEmployerLead({
        contact,
        conversation,
        normalizedMessage: normalized,
        aiExtraction: null,
      });

      const activeConversation = flowResult?.conversation || conversation;
      const replyText = flowResult?.reply || flowResult?.messageToSend || "";

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: replyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation: activeConversation,
        text: replyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      const employerFlowDoneIntent = flowResult?.isComplete
        ? "unknown"
        : flowResult?.intent === "worker_registration"
          ? "worker_registration"
          : "employer_lead";

      const employerFlowDoneState = flowResult?.isComplete
        ? "idle"
        : flowResult?.intent === "worker_registration"
          ? "ask_jobType"
          : flowResult?.currentState || activeConversation.currentState || "idle";

      const employerFlowDoneMeta = flowResult?.intent === "worker_registration"
        ? { lastAskedField: "jobType", activeFlow: "worker_registration", collectedData: {} }
        : {};

      await updateConversationIntent({
        conversation: activeConversation,
        intent: employerFlowDoneIntent,
        state: employerFlowDoneState,
        metadata: employerFlowDoneMeta,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate active employer flow handled message",
        reason: "active_employer_flow_state_priority",
        intent: employerFlowDoneIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    if (activeAutomationFlowRoute === "worker") {
      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: {
          intent: "worker_registration",
          needsHuman: false,
          priority: "low",
          reason: "active_worker_flow_state_priority",
        },
      });

      const flowResult = await handleWorkerRegistration({
        contact,
        conversation,
        normalizedMessage: normalized,
      });

      const activeConversation = flowResult?.conversation || conversation;
      const replyText = flowResult?.reply || flowResult?.messageToSend || "";

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: replyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation: activeConversation,
        text: replyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      const workerFlowDoneIntent = flowResult?.intent === "employer_lead"
        ? "employer_lead"
        : "worker_registration";
      const workerFlowDoneState = flowResult?.intent === "employer_lead"
        ? "ask_business_name"
        : flowResult?.currentState || activeConversation.currentState || "idle";
      const workerFlowDoneMeta = flowResult?.intent === "employer_lead"
        ? { collectedData: {}, lastAskedField: null, pendingEmployerSwitch: false }
        : (flowResult?.metadataUpdate || {});

      await updateConversationIntent({
        conversation: activeConversation,
        intent: workerFlowDoneIntent,
        state: workerFlowDoneState,
        metadata: workerFlowDoneMeta,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate active worker flow handled message",
        reason: "active_worker_flow_state_priority",
        intent: workerFlowDoneIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    if (env.BOT_MODE === "jobmate_hiring") {
      const understandingText =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";
      const understandingAction = decideUnderstandingAction({
        text: understandingText,
        conversation,
      });

      if (
        ["boundary", "reply_only"].includes(understandingAction.action) &&
        understandingAction.reply
      ) {
        const understandingIntentResult = {
          intent: "unknown",
          needsHuman: false,
          priority: "low",
          reason: `aarati_understanding:${understandingAction.reason}`,
        };

        const inboundMessage = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: understandingIntentResult,
        });

        const sendResult = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: understandingAction.reply,
        });

        const outboundMessage = await saveOutboundMessage({
          contact,
          conversation,
          text: understandingAction.reply,
          providerMessageId: sendResult.providerMessageId,
          status: "sent",
        });

        await updateConversationIntent({
          conversation,
          intent: conversation.currentIntent || "unknown",
          state: conversation.currentState || "idle",
          lastInboundMessageId: inboundMessage._id,
          lastOutboundMessageId: outboundMessage._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati understanding handled message",
          intent: understandingIntentResult.intent,
          mappedFlow: understandingAction.mappedFlow,
          reason: understandingAction.reason,
          replied: true,
          sendSkipped: sendResult.skipped || false,
        });
      }
    }

    if (env.BOT_MODE === "jobmate_hiring") {
      const leadAgentResult = await handleJobMateLeadAgentMessage({
        contact,
        conversation,
        normalizedMessage: normalized,
      });

      if (leadAgentResult?.handled) {
        const leadAgentIntentResult = {
          intent: toWebhookMessageIntent(leadAgentResult),
          needsHuman: Boolean(leadAgentResult.needsHuman),
          priority: leadAgentResult.priority || "low",
          reason: leadAgentResult.reason || "jobmate_lead_agent",
        };

        const inboundMessage = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: leadAgentIntentResult,
        });

        const sendResult = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: leadAgentResult.reply,
        });

        const outboundMessage = await saveOutboundMessage({
          contact,
          conversation,
          text: leadAgentResult.reply,
          providerMessageId: sendResult.providerMessageId,
          status: "sent",
        });

        const patch = buildLeadAgentConversationPatch({
          result: leadAgentResult,
          inboundMessageId: inboundMessage._id,
          outboundMessageId: outboundMessage._id,
        });

        if (patch && conversation?._id) {
          const ConvModel = conversation.constructor;
          await ConvModel.updateOne(
            { _id: conversation._id },
            patch,
            { runValidators: false }
          );
        }

        if (["worker_registration", "employer_lead"].includes(leadAgentIntentResult.intent)) {
          contact = await applyContactIntentState(contact, leadAgentIntentResult);
        }

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "JobMate lead agent handled message",
          intent: leadAgentIntentResult.intent,
          reason: leadAgentResult.reason,
          replied: true,
          leadDraftCreated: Boolean(leadAgentResult.leadDraft),
          taskDraftCreated: Boolean(leadAgentResult.taskDraft),
          sendSkipped: sendResult.skipped || false,
        });
      }
    }

    // ── AARATI-20A: Follow-up Reply Context Guard ────────────────────────────
    // Priority #2 in routing ladder — BEFORE safety guards, classifyIntent,
    // employer parser, Mapbox, and all other classifiers.
    // Intercepts numeric replies (1/2/3) when conversation is awaiting a
    // follow-up reply (e.g. candidate_reengagement sent by jobmate_followup).
    if (env.BOT_MODE === "jobmate_hiring") {
      const followupText =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";

      // Diagnostic: log what the conversation metadata looks like at this point.
      // If awaitingFollowupReply is false/undefined here, context was not saved.
      const _cd20a = conversation.metadata?.collectedData || {};
      console.log("AARATI_20A_PRE_DECISION_CONTEXT", {
        phone: contact.phone,
        canonicalPhone: contact.phone,
        conversationId: String(conversation._id),
        text: followupText,
        awaitingFollowupReply: _cd20a.awaitingFollowupReply ?? false,
        followupType: _cd20a.followupType ?? null,
        currentState: conversation.currentState,
        state: conversation.currentState,
        activeFlow: conversation.currentIntent,
      });

      const followupDecision = decideFollowupReplyContext({
        text: followupText,
        phone: contact.phone,
        conversation,
      });

      if (followupDecision.shouldHandle) {
        console.log("AARATI_20A_GUARD_HIT", {
          phone: contact.phone,
          canonicalPhone: contact.phone,
          conversationId: String(conversation._id),
          choice: followupText,
          followupType: _cd20a.followupType ?? null,
          reason: followupDecision.reason,
        });
        const patch20a = { ...(followupDecision.metadataPatch || {}) };

        const nextConversationIntent20a =
          followupDecision.nextState === "awaiting_job_search_query"
            ? "job_search"
            : "unknown";

        if (followupDecision.nextState) {
          patch20a["currentState"] = followupDecision.nextState;
        } else {
          patch20a["currentState"] = "idle";
        }

        // Critical AARATI-20A fix:
        // Once candidate follow-up is handled, do NOT leave old employer_lead active.
        // Otherwise the next short reply like "driver" or "1" falls back into employer flow.
        patch20a["currentIntent"] = nextConversationIntent20a;

        const ConvModel = conversation.constructor;
        await ConvModel.updateOne(
          { _id: conversation._id },
          { $set: patch20a },
          { runValidators: false }
        );

        const inboundMessage20a = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: {
            intent: nextConversationIntent20a,
            needsHuman: false,
            priority: "low",
            reason: followupDecision.reason,
          },
        });

        const sendResult20a = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: followupDecision.replyText,
        });

        const outboundMessage20a = await saveOutboundMessage({
          contact,
          conversation,
          text: followupDecision.replyText,
          providerMessageId: sendResult20a.providerMessageId,
          status: "sent",
        });

        await updateConversationIntent({
          conversation,
          intent: nextConversationIntent20a,
          state: followupDecision.nextState || "idle",
          lastInboundMessageId: inboundMessage20a._id,
          lastOutboundMessageId: outboundMessage20a._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati 20A follow-up reply context guard handled message",
          reason: followupDecision.reason,
          replied: true,
          sendSkipped: sendResult20a.skipped || false,
        });
      }
    }
    // ── End AARATI-20A guard ──────────────────────────────────────────────────

    // ── AARATI-20E: Job search control/confirmation guard ─────────────────────
    // Runs before AARATI-20B continuation so control words like "hus", "ok",
    // "job chaiyo", and "start" do not retry the previous job search forever.
    if (env.BOT_MODE === "jobmate_hiring") {
      const controlText20e =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";

      const controlDecision20e = handleAaratiJobSearchControlGuard({
        text: controlText20e,
        conversation,
      });

      if (controlDecision20e.shouldHandle) {
        console.log(
          controlDecision20e.intent === "restart"
            ? "AARATI_20E_CONTROL_COMMAND_HIT"
            : "AARATI_20E_CONFIRMATION_BEFORE_SEARCH_HIT",
          {
            phone: contact.phone,
            conversationId: String(conversation._id),
            text: controlText20e,
            reason: controlDecision20e.reason,
          }
        );

        if (controlDecision20e.statePatch && conversation?._id) {
          const ConvModel20e = conversation.constructor;
          await ConvModel20e.updateOne(
            { _id: conversation._id },
            { $set: controlDecision20e.statePatch },
            { runValidators: false }
          );
        }

        const inboundMessage20e = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: {
            intent: controlDecision20e.intent || "unknown",
            needsHuman: false,
            priority: "low",
            reason: controlDecision20e.reason,
          },
        });

        const sendResult20e = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: controlDecision20e.replyText,
        });

        const outboundMessage20e = await saveOutboundMessage({
          contact,
          conversation,
          text: controlDecision20e.replyText,
          providerMessageId: sendResult20e.providerMessageId,
          status: "sent",
        });

        await updateConversationIntent({
          conversation,
          intent: controlDecision20e.intent || "unknown",
          state:
            controlDecision20e.statePatch?.currentState ||
            conversation.currentState ||
            "idle",
          lastInboundMessageId: inboundMessage20e._id,
          lastOutboundMessageId: outboundMessage20e._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati 20E job search control guard handled message",
          reason: controlDecision20e.reason,
          replied: true,
          sendSkipped: sendResult20e.skipped || false,
        });
      }
    }
    // ── End AARATI-20E guard ──────────────────────────────────────────────────

    // ── AARATI-20F: Employer intent recovery guard ───────────────────────────
    // Runs early so "malai manxe chahiyo" / "staff khojna" enters employer flow
    // before generic AI/human boundary replies can swallow it.
    if (env.BOT_MODE === "jobmate_hiring") {
      const employerRecoveryText20f =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";

      const employerRecovery20f = detectAaratiEmployerIntentRecovery({
        text: employerRecoveryText20f,
        conversation,
      });

      if (employerRecovery20f.shouldHandle) {
        console.log("AARATI_20F_EMPLOYER_INTENT_RECOVERY_HIT", {
          phone: contact.phone,
          conversationId: String(conversation._id),
          text: employerRecoveryText20f,
          reason: employerRecovery20f.reason,
          previousState: conversation.currentState,
          previousIntent: conversation.currentIntent,
        });

        if (conversation?._id) {
          const ConvModel20f = conversation.constructor;
          await ConvModel20f.updateOne(
            { _id: conversation._id },
            { $set: employerRecovery20f.statePatch },
            { runValidators: false }
          );
        }

        const inboundMessage20f = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: {
            intent: "employer_lead",
            needsHuman: false,
            priority: "medium",
            reason: employerRecovery20f.reason,
          },
        });

        const sendResult20f = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: employerRecovery20f.replyText,
        });

        const outboundMessage20f = await saveOutboundMessage({
          contact,
          conversation,
          text: employerRecovery20f.replyText,
          providerMessageId: sendResult20f.providerMessageId,
          status: "sent",
        });

        await updateConversationIntent({
          conversation,
          intent: "employer_lead",
          state: "ask_vacancy_role",
          lastInboundMessageId: inboundMessage20f._id,
          lastOutboundMessageId: outboundMessage20f._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati 20F employer intent recovery handled message",
          reason: employerRecovery20f.reason,
          replied: true,
          sendSkipped: sendResult20f.skipped || false,
        });
      }
    }
    // ── End AARATI-20F guard ─────────────────────────────────────────────────

    // ── AARATI-20B: Job Search Continuation Guard ─────────────────────────────
    // Priority #3 — after 20A follow-up guard, before safety/AI/classifier/
    // employer/worker parsers.  Handles the multi-turn "location + job type"
    // conversation that starts after a candidate_reengagement "1" reply.
    // Deterministic: no Gemini, no Mapbox, no employer parser.
    if (env.BOT_MODE === "jobmate_hiring") {
      const jobSearchText =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";

      const jobSearchResult = handleAaratiJobSearchContinuation({
        text: jobSearchText,
        conversation,
      });

      if (jobSearchResult.shouldHandle) {
        const ConvModel20b = conversation.constructor;

        // Save inbound message first (before state patch so we capture raw intent).
        const inboundMsg20b = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: {
            intent: "job_search",
            needsHuman: false,
            priority: "low",
            reason: jobSearchResult.reason,
          },
        });

        if (jobSearchResult.shouldSearchJobs) {
          // ── AARATI-20B+20C: Both location + jobType known — run job search ──
          // Run search BEFORE applying state patch so we can set the correct
          // next state based on whether the API timed out or returned results.
          console.log("AARATI_20B_JOB_SEARCH_EXECUTED", {
            phone: contact.phone,
            conversationId: String(conversation._id),
            query: jobSearchResult.query,
            reason: jobSearchResult.reason,
          });

          const searchResult20b = await searchJobMateJobs({
            keyword: jobSearchResult.query.keyword || "",
            location: jobSearchResult.query.location || "",
            category: jobSearchResult.query.category || "",
          });

          // ── AARATI-20C: Distinguish API timeout from true zero results ─────
          // searchJobMateJobs returns ok:false when the HTTP request failed or
          // timed out. ok:true with count:0 means the API responded with no jobs.
          // "No jobs found" is only accurate when the API actually responded.
          const isApiTimeout =
            !searchResult20b.ok ||
            searchResult20b.reason === "JOBMATE_API_FAILED_OR_TIMEOUT";

          let replyText20b;
          let finalStatePatch20b;

          if (isApiTimeout) {
            // API timed out — preserve the search query as pendingJobSearch so
            // the next message from the user (even "job chaiyo") automatically
            // merges the saved location+jobType and retries the search via the
            // existing pending-merge logic in handleAaratiJobSearchContinuation.
            const loc20c = jobSearchResult.query.location || "";
            const kw20c = jobSearchResult.query.keyword || "";

            replyText20b =
              `JobMate system bata job list fetch garna ali time lagyo 🙏\n` +
              `Tapai ko ${loc20c}${kw20c ? ` ${kw20c}` : ""} job search save gariyo.\n` +
              `Hamro team le check garera suitable job aayo bhane contact garnecha.`;

            finalStatePatch20b = {
              "metadata.collectedData.lastJobSearch": {
                query: jobSearchResult.query,
                count: 0,
                strategy: "api_failed_or_timeout",
                jobSearchError: "JOBMATE_API_FAILED_OR_TIMEOUT",
                searchedAt: new Date(),
              },
              // Keep pending so the guard can merge + retry on next turn.
              "metadata.collectedData.pendingJobSearch": {
                location: jobSearchResult.query.location || null,
                jobType: jobSearchResult.query.keyword || null,
                retryCount: 0,
              },
              currentState: "awaiting_job_search_query",
              currentIntent: "job_search",
            };

            console.log("AARATI_20C_JOB_SEARCH_TIMEOUT", {
              phone: contact.phone,
              conversationId: String(conversation._id),
              query: jobSearchResult.query,
              preservedPending: { location: loc20c, jobType: kw20c },
            });
          } else {
            // API responded (has jobs or genuinely zero results) — truthful reply.
            replyText20b = formatJobsForWhatsApp({
              jobs: searchResult20b.jobs || [],
              location: jobSearchResult.query.location || "",
              keyword: jobSearchResult.query.keyword || "",
            });

            finalStatePatch20b = {
              ...jobSearchResult.statePatch,   // pendingJobSearch:null, currentState:job_search_results
              "metadata.collectedData.lastJobSearch": {
                query: jobSearchResult.query,
                count: searchResult20b.count || 0,
                strategy: searchResult20b.strategy || "",
                jobSearchError: null,
                searchedAt: new Date(),
              },
            };
          }

          await ConvModel20b.updateOne(
            { _id: conversation._id },
            { $set: finalStatePatch20b },
            { runValidators: false }
          );

          const sendResult20b = await sendWhatsAppTextMessage({
            to: contact.phone,
            text: replyText20b,
          });

          const outboundMsg20b = await saveOutboundMessage({
            contact,
            conversation,
            text: replyText20b,
            providerMessageId: sendResult20b.providerMessageId,
            status: "sent",
          });

          const nextState20bFinal = finalStatePatch20b.currentState || "job_search_results";

          await updateConversationIntent({
            conversation,
            intent: "job_search",
            state: nextState20bFinal,
            lastInboundMessageId: inboundMsg20b._id,
            lastOutboundMessageId: outboundMsg20b._id,
          });

          await markMessageProcessed(processedMessageId);

          return res.status(200).json({
            success: true,
            message: isApiTimeout
              ? "Aarati 20C job search — API timeout, context preserved for retry"
              : "Aarati 20B job search continuation — results sent",
            reason: jobSearchResult.reason,
            replied: true,
            sendSkipped: sendResult20b.skipped || false,
          });
        }

        // ── Partial (location only / jobType only) or reprompt ──────────────
        // Apply state patch now (partial cases always have a deterministic next state).
        await ConvModel20b.updateOne(
          { _id: conversation._id },
          { $set: jobSearchResult.statePatch },
          { runValidators: false }
        );

        const logLabel =
          jobSearchResult.reason === "JOB_SEARCH_REPROMPT"
            ? "AARATI_20B_JOB_SEARCH_REPROMPT"
            : "AARATI_20B_JOB_SEARCH_PARTIAL_SAVED";

        console.log(logLabel, {
          phone: contact.phone,
          conversationId: String(conversation._id),
          reason: jobSearchResult.reason,
          query: jobSearchResult.query,
        });

        const sendResult20bPartial = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: jobSearchResult.replyText,
        });

        const outboundMsg20bPartial = await saveOutboundMessage({
          contact,
          conversation,
          text: jobSearchResult.replyText,
          providerMessageId: sendResult20bPartial.providerMessageId,
          status: "sent",
        });

        const nextState20b =
          jobSearchResult.statePatch?.currentState ||
          conversation.currentState;

        await updateConversationIntent({
          conversation,
          intent: "job_search",
          state: nextState20b,
          lastInboundMessageId: inboundMsg20b._id,
          lastOutboundMessageId: outboundMsg20bPartial._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati 20B job search continuation handled message",
          reason: jobSearchResult.reason,
          replied: true,
          sendSkipped: sendResult20bPartial.skipped || false,
        });
      }
    }
    // ── End AARATI-20B guard ──────────────────────────────────────────────────

    // ── AARATI-20D: Job Search Confirmation / Profile Save Guard ─────────────
    // Priority #4 — after 20B, before safety guards, Mapbox, Gemini, worker reg.
    // When user sees job_search_results and replies with a confirmation phrase
    // ("ok hubxa", "yes", "job chaiyo", etc.), use lastJobSearch.query to save
    // the profile. NEVER save raw confirmation text as area/location.
    if (env.BOT_MODE === "jobmate_hiring") {
      const confirmText20d =
        normalized.message.normalizedText ||
        normalized.message.text ||
        "";

      const activation20d = isJobSearchConfirmationActivation({
        text: confirmText20d,
        conversation,
      });

      if (activation20d.active) {
        // Fetch existing WorkerProfile to check availability/documents.
        const workerProfile20d = await WorkerProfile.findOne({
          contactId: contact._id,
        }).lean();

        const confirm20d = decideJobSearchConfirmationAction({
          text: confirmText20d,
          conversation,
          workerProfile: workerProfile20d,
        });

        if (confirm20d.shouldHandle) {
          console.log("AARATI_20D_JOB_SEARCH_CONFIRM_HIT", {
            phone: contact.phone,
            conversationId: String(conversation._id),
            reason: confirm20d.reason,
            queryUsed: confirm20d.queryUsed,
            missingField: confirm20d.missingField,
          });

          if (confirm20d.queryUsed?.location || confirm20d.queryUsed?.keyword) {
            console.log("AARATI_20D_PROFILE_CONTEXT_FROM_LAST_SEARCH", {
              phone: contact.phone,
              location: confirm20d.queryUsed?.location,
              keyword: confirm20d.queryUsed?.keyword,
              rawText: confirmText20d,
            });
          }

          // Proof: raw confirmation text is NOT used as location.
          console.log("AARATI_20D_BLOCKED_RAW_CONFIRMATION_AS_LOCATION", {
            rawText: confirmText20d,
            usedLocation: confirm20d.queryUsed?.location || "(none)",
            usedKeyword: confirm20d.queryUsed?.keyword || "(none)",
          });

          const ConvModel20d = conversation.constructor;

          // Apply conversation state patch.
          await ConvModel20d.updateOne(
            { _id: conversation._id },
            { $set: confirm20d.nextConvPatch },
            { runValidators: false }
          );

          // Apply worker profile update (if any — null for idempotent case).
          if (confirm20d.profileUpdate) {
            await WorkerProfile.findOneAndUpdate(
              { contactId: contact._id },
              {
                $setOnInsert: {
                  contactId: contact._id,
                  fullName: contact.displayName || "",
                  phone: contact.phone,
                  source: "whatsapp",
                },
                ...confirm20d.profileUpdate,
              },
              { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
            );
          }

          const inboundMsg20d = await saveInboundMessage({
            contact,
            conversation,
            normalized,
            intentResult: {
              intent: "worker_registration",
              needsHuman: false,
              priority: "low",
              reason: `aarati_20d:${confirm20d.reason}`,
            },
          });

          const sendResult20d = await sendWhatsAppTextMessage({
            to: contact.phone,
            text: confirm20d.replyText,
          });

          const outboundMsg20d = await saveOutboundMessage({
            contact,
            conversation,
            text: confirm20d.replyText,
            providerMessageId: sendResult20d.providerMessageId,
            status: "sent",
          });

          await updateConversationIntent({
            conversation,
            intent: "worker_registration",
            state: confirm20d.nextState || "idle",
            lastInboundMessageId: inboundMsg20d._id,
            lastOutboundMessageId: outboundMsg20d._id,
          });

          await markMessageProcessed(processedMessageId);

          return res.status(200).json({
            success: true,
            message: "Aarati 20D job search confirmation handled",
            reason: confirm20d.reason,
            replied: true,
            sendSkipped: sendResult20d.skipped || false,
          });
        }
      }
    }
    // ── End AARATI-20D guard ──────────────────────────────────────────────────

    const safetyEvent =
      env.BOT_MODE === "jobmate_hiring"
        ? await detectJobMateSafetyEvent({ conversation, normalized })
        : null;

    if (safetyEvent) {
      const safetyIntentResult = {
        intent: safetyEvent.intent,
        needsHuman: safetyEvent.type === "unsafe_hiring",
        priority: safetyEvent.priority || "medium",
        reason: safetyEvent.type,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: safetyIntentResult,
      });

      if (safetyEvent.updateConversation && conversation?._id) {
        const Model = conversation.constructor;
        await Model.updateOne(
          { _id: conversation._id },
          {
            $set: {
              currentState: safetyEvent.updateConversation.currentState,
              "metadata.lastAskedField": safetyEvent.updateConversation.lastAskedField,
              "metadata.collectedData.pendingDocumentPrivacyConcern":
                safetyEvent.updateConversation.pendingDocumentPrivacyConcern,
            },
          },
          { runValidators: false }
        );
      }

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: safetyEvent.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: safetyEvent.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: safetyEvent.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate safety guard handled message",
        safetyType: safetyEvent.type,
        intent: safetyEvent.intent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const repairEvent =
      env.BOT_MODE === "jobmate_hiring"
        ? detectConversationRepairEvent({ conversation, normalized })
        : null;

    if (repairEvent) {
      const repairIntentResult = {
        intent: repairEvent.intent,
        needsHuman: Boolean(repairEvent.needsHuman),
        priority: repairEvent.priority || "medium",
        reason: repairEvent.type,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: repairIntentResult,
      });

      let handoff = null;

      if (repairEvent.needsHuman) {
        handoff = await createHandoffRequest({
          contact,
          conversation,
          reason: repairEvent.type,
          lastUserMessage: normalized.message.text || "",
          priority: repairEvent.priority || "high",
          callRequired: false,
          metadata: {
            intent: repairEvent.intent,
            source: "conversation_repair_guard",
            repairType: repairEvent.type,
          },
        });
      }

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: repairEvent.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: repairEvent.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: repairEvent.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate conversation repair handled message",
        repairType: repairEvent.type,
        intent: repairEvent.intent,
        replied: true,
        handoffCreated: Boolean(handoff),
        sendSkipped: sendResult.skipped || false,
      });
    }

    const humanBoundaryAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? getAaratiHumanBoundaryAnswer({ normalized, conversation })
        : null;

    if (humanBoundaryAnswer) {
      const humanBoundaryIntentResult = {
        intent: humanBoundaryAnswer.intent || "unknown",
        needsHuman: humanBoundaryAnswer.intent === "frustrated",
        priority: humanBoundaryAnswer.intent === "frustrated" ? "medium" : "low",
        reason: humanBoundaryAnswer.source,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: humanBoundaryIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: humanBoundaryAnswer.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: humanBoundaryAnswer.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: humanBoundaryIntentResult.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Aarati human boundary handled message",
        source: humanBoundaryAnswer.source,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const hardSafetyAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? getAaratiHardSafetyBoundaryAnswer({ normalized })
        : null;

    if (hardSafetyAnswer) {
      const hardSafetyIntentResult = {
        intent: hardSafetyAnswer.intent || "unknown",
        needsHuman: hardSafetyAnswer.detectedIntent === "frustration_or_abuse",
        priority: hardSafetyAnswer.detectedIntent === "frustration_or_abuse" ? "medium" : "low",
        reason: `${hardSafetyAnswer.source}:${hardSafetyAnswer.detectedIntent}`,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: hardSafetyIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: hardSafetyAnswer.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: hardSafetyAnswer.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: hardSafetyIntentResult.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Aarati hard safety boundary handled message",
        source: hardSafetyAnswer.source,
        detectedIntent: hardSafetyAnswer.detectedIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const preFlowQaAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? getAaratiPreFlowQaAnswer({ normalized, conversation })
        : null;

    if (preFlowQaAnswer) {
      const preFlowQaIntentResult = {
        intent: preFlowQaAnswer.intent || "unknown",
        needsHuman: false,
        priority: "low",
        reason: `${preFlowQaAnswer.source}:${preFlowQaAnswer.detectedIntent}`,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: preFlowQaIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: preFlowQaAnswer.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: preFlowQaAnswer.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: preFlowQaIntentResult.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Aarati pre-flow QA handled message",
        source: preFlowQaAnswer.source,
        detectedIntent: preFlowQaAnswer.detectedIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const knowledgeAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? findJobMateKnowledgeAnswer({ normalized })
        : null;

    if (knowledgeAnswer) {
      const polishedKnowledgeReply = polishAaratiReply({
        userText: getUserTextForPolish(normalized),
        reply: knowledgeAnswer.answer,
        source: knowledgeAnswer.source,
      });

      const knowledgeReplyText =
        polishedKnowledgeReply?.reply || knowledgeAnswer.answer;

      const knowledgeIntentResult = {
        intent: "unknown",
        needsHuman: false,
        priority: "low",
        reason: `knowledge_answer:${knowledgeAnswer.topic}`,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: knowledgeIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: knowledgeReplyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: knowledgeReplyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: "unknown",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate knowledge answer handled message",
        topic: knowledgeAnswer.topic,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const aiFirstAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? await generateAaratiAiFirstAnswer({ normalized, conversation })
        : null;

    if (aiFirstAnswer) {
      const aiFirstIntentResult = {
        intent: aiFirstAnswer.intent || "unknown",
        needsHuman: aiFirstAnswer.handoffNeeded || aiFirstAnswer.intent === "human_handoff",
        priority: aiFirstAnswer.handoffNeeded ? "medium" : "low",
        reason: `${aiFirstAnswer.source}:${aiFirstAnswer.detectedIntent}`,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: aiFirstIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: aiFirstAnswer.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: aiFirstAnswer.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: aiFirstIntentResult.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Aarati AI-first router handled message",
        source: aiFirstAnswer.source,
        detectedIntent: aiFirstAnswer.detectedIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

    const generalAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? await generateJobMateGeneralAnswer({ conversation, normalized })
        : null;

    if (generalAnswer) {
      const polishedGeneralReply = polishAaratiReply({
        userText: getUserTextForPolish(normalized),
        reply: generalAnswer.reply,
        source: generalAnswer.source,
      });

      const generalReplyText =
        polishedGeneralReply?.reply || generalAnswer.reply;

      const generalIntentResult = {
        intent: "unknown",
        needsHuman: false,
        priority: "low",
        reason: generalAnswer.source,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: generalIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: generalReplyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: generalReplyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: "unknown",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "JobMate general AI answer handled message",
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }


    if (env.BOT_MODE === "jobmate_hiring" && isSupportedDocumentMedia(normalized)) {
      const humanIntentFormattedAnswer =
      env.BOT_MODE === "jobmate_hiring"
        ? getAaratiHumanIntentFormattedAnswer({ normalized, conversation })
        : null;

    if (humanIntentFormattedAnswer) {
      const humanIntentResult = {
        intent: humanIntentFormattedAnswer.intent || "unknown",
        needsHuman: false,
        priority: "low",
        reason: `${humanIntentFormattedAnswer.source}:${humanIntentFormattedAnswer.detectedIntent}`,
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: humanIntentResult,
      });

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: humanIntentFormattedAnswer.reply,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: humanIntentFormattedAnswer.reply,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: humanIntentResult.intent,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Aarati human intent formatter handled message",
        source: humanIntentFormattedAnswer.source,
        detectedIntent: humanIntentFormattedAnswer.detectedIntent,
        replied: true,
        sendSkipped: sendResult.skipped || false,
      });
    }

      const isWorkerDocumentMediaContext =
        conversation?.currentIntent === "worker_registration" ||
        conversation?.metadata?.activeFlow === "worker_registration";
      const shouldAdvanceWorkerDocumentStep =
        isWorkerDocumentMediaContext &&
        (conversation?.currentState === "ask_document_status" ||
          conversation?.currentState === "ask_documents" ||
          conversation?.metadata?.lastAskedField === "documents");
      const mediaConversationIntent = isWorkerDocumentMediaContext
        ? "worker_registration"
        : "document_upload";
      let mediaConversationState = shouldAdvanceWorkerDocumentStep
        ? "ask_fullName"
        : conversation?.currentState || null;

      const mediaIntentResult = {
        intent: mediaConversationIntent,
        needsHuman: false,
        priority: "medium",
        reason: "WhatsApp media document received",
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: mediaIntentResult,
      });

      const saved = await saveWorkerDocumentMetadata({
        contact,
        normalized,
      });

      const currentJobmateProfile = {
        ...(conversation?.metadata?.collectedData || {}),
      };

      let replyText = buildDocumentReceivedReply(saved?.document);

      if (shouldAdvanceWorkerDocumentStep) {
        const nextProfile = {
          ...currentJobmateProfile,
          documents: "yes",
          documentReceived: true,
          documentStatus: "received",
          ...(saved?.document
            ? { documentAttachment: buildSafeDocumentAttachmentMetadata(saved.document) }
            : {}),
        };

        if (conversation?._id) {
          const Model = conversation.constructor;
          await Model.updateOne(
            { _id: conversation._id },
            {
              $set: {
                currentState: "ask_fullName",
                "metadata.collectedData": nextProfile,
                "metadata.lastAskedField": "fullName",
                "metadata.activeFlow": "worker_registration",
              },
            },
            { runValidators: false }
          );
        }

        replyText = "Document photo receive bhayo 🙏\nTapai ko naam pathaunu hola.";
      } else if (isWorkerDocumentMediaContext && conversation?._id) {
        const nextProfile = {
          ...currentJobmateProfile,
          documentReceived: true,
          documentStatus: "received",
          ...(saved?.document
            ? { documentAttachment: buildSafeDocumentAttachmentMetadata(saved.document) }
            : {}),
        };
        const Model = conversation.constructor;
        await Model.updateOne(
          { _id: conversation._id },
          {
            $set: {
              currentState: mediaConversationState,
              "metadata.collectedData": nextProfile,
              "metadata.activeFlow": "worker_registration",
            },
          },
          { runValidators: false }
        );
      }

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: replyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: replyText,
        providerMessageId: sendResult.providerMessageId,
        status: "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: mediaConversationIntent,
        state: mediaConversationState,
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Document metadata captured",
        intent: mediaConversationIntent,
        replied: true,
        workerId: saved?.worker?._id || null,
        documentType: saved?.document?.type || "other",
        sendSkipped: sendResult.skipped || false,
      });
    }

    // ── AARATI-19A: Conversation-Aware Decision Engine ────────────────────────
    // Runs AFTER all early-exit handlers (safetyEvent, repairEvent,
    // humanBoundary, hardSafety, preFlowQa, knowledge, aiFirst, generalAnswer,
    // document media) and BEFORE classifyIntent / handleEmployerLead /
    // handleWorkerRegistration / job search / Mapbox / location resolver.
    if (env.BOT_MODE === "jobmate_hiring") {
      const d19aText =
        normalized.message.normalizedText || normalized.message.text || "";
      const d19aDecision = decideAaratiNextAction({
        text: d19aText,
        normalizedText: d19aText,
        conversationState: conversation,
        collectedData: conversation?.metadata?.collectedData || {},
        previousUserMessage:
          conversation?.metadata?.lastUserMessage || "",
        previousBotMessage: conversation?.metadata?.lastBotMessage || "",
        lastGateDecision: conversation?.metadata?.lastGateDecision || {},
        lastBlockedCategory:
          conversation?.metadata?.lastBlockedCategory || "",
      });

      if (d19aDecision.bypassFlow && d19aDecision.reply) {
        const d19aIntentResult = {
          intent:
            d19aDecision.category === "forbidden_employer_request" ||
            d19aDecision.category === "referential_forbidden_request"
              ? "frustrated"
              : "unknown",
          needsHuman: false,
          priority: "low",
          reason: `aarati_decision_19a:${d19aDecision.category}`,
        };

        const inboundMessage = await saveInboundMessage({
          contact,
          conversation,
          normalized,
          intentResult: d19aIntentResult,
        });

        // Persist lastGateDecision and lastBlockedCategory in conversation
        // metadata; when preserveState=true do NOT touch currentState.
        const d19aPatch = {
          "metadata.lastGateDecision": {
            category: d19aDecision.category,
            action: d19aDecision.action,
            bypassFlow: true,
          },
          "metadata.lastUserMessage": d19aText.slice(0, 200),
        };
        if (d19aDecision.nextStatePatch?.lastBlockedCategory) {
          d19aPatch["metadata.lastBlockedCategory"] =
            d19aDecision.nextStatePatch.lastBlockedCategory;
        }
        // NEW 19E: persist extracted name to conversation metadata
        if (d19aDecision.extractedName && d19aDecision.category === "name_capture") {
          d19aPatch["metadata.displayName"] = d19aDecision.extractedName;
        }
        if (conversation?._id) {
          const ConvModel = conversation.constructor;
          await ConvModel.updateOne(
            { _id: conversation._id },
            { $set: d19aPatch },
            { runValidators: false }
          );
        }

        const sendResult = await sendWhatsAppTextMessage({
          to: contact.phone,
          text: d19aDecision.reply,
        });

        const outboundMessage = await saveOutboundMessage({
          contact,
          conversation,
          text: d19aDecision.reply,
          providerMessageId: sendResult.providerMessageId,
          status: "sent",
        });

        await updateConversationIntent({
          conversation,
          intent: d19aIntentResult.intent,
          lastInboundMessageId: inboundMessage._id,
          lastOutboundMessageId: outboundMessage._id,
        });

        await markMessageProcessed(processedMessageId);

        return res.status(200).json({
          success: true,
          message: "Aarati 19A decision engine handled message",
          category: d19aDecision.category,
          action: d19aDecision.action,
          preserveState: d19aDecision.preserveState,
          replied: true,
          sendSkipped: sendResult.skipped || false,
        });
      }
      // NEW 19C: when a new valid job search has a different role than the
      // stored collectedData, unset stale search fields so old jobType/category
      // doesn't bleed into the new search.
      if (
        d19aDecision.allowFlow &&
        d19aDecision.clearCollectedFields?.length &&
        conversation?._id
      ) {
        const unsetPatch = {};
        for (const field of d19aDecision.clearCollectedFields) {
          unsetPatch[`metadata.collectedData.${field}`] = "";
        }
        const ConvModel19c = conversation.constructor;
        await ConvModel19c.updateOne(
          { _id: conversation._id },
          { $unset: unsetPatch },
          { runValidators: false }
        );
        if (conversation.metadata?.collectedData) {
          for (const field of d19aDecision.clearCollectedFields) {
            delete conversation.metadata.collectedData[field];
          }
        }
      }
    }
    // ── End AARATI-19A/19C ───────────────────────────────────────────────────

    if (env.BOT_MODE === "business_receptionist") {
      const businessIntentResult = {
        intent: "unknown",
        needsHuman: false,
        priority: "low",
        reason: "Business receptionist mode",
      };

      const inboundMessage = await saveInboundMessage({
        contact,
        conversation,
        normalized,
        intentResult: businessIntentResult,
      });

      const flowResult = await handleBusinessReceptionistMessage({
        contact,
        conversation,
        normalizedMessage: normalized,
      });

      const businessLead = await upsertBusinessLeadFromReceptionist({
        contact,
        conversation,
        normalizedMessage: normalized,
        flowResult,
      });

      let handoff = null;

      if (flowResult?.needsHuman) {
        handoff = await createHandoffRequest({
          contact,
          conversation,
          reason:
            flowResult.intent === "human_request"
              ? "user_requested_human"
              : flowResult.intent === "discount_request"
                ? "call_required"
                : "unknown",
          lastUserMessage: normalized.message.text || "",
          priority: flowResult.priority || "medium",
          callRequired: flowResult.priority === "high",
          metadata: {
            intent: "unknown",
            source: "business_receptionist",
            reason: flowResult.reason || "",
            lead: flowResult.lead || {},
          },
        });

        await sendTelegramAlert(
          `📞 BUSINESS RECEPTIONIST HANDOFF\n\n` +
            `Contact: ${contact.displayName || "Unknown"}\n` +
            `Phone: ${contact.phone}\n` +
            `Intent: ${flowResult.intent}\n` +
            `Message: ${normalized.message.text || ""}`
        );
      }

      const replyText = flowResult.messageToSend;

      const sendResult = await sendWhatsAppTextMessage({
        to: contact.phone,
        text: replyText,
      });

      const outboundMessage = await saveOutboundMessage({
        contact,
        conversation,
        text: replyText,
        providerMessageId: sendResult.providerMessageId,
        status: sendResult.skipped ? "sent" : "sent",
      });

      await updateConversationIntent({
        conversation,
        intent: "unknown",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        mode: "business_receptionist",
        message: "Business receptionist webhook processed",
        intent: flowResult.intent,
        replied: true,
        handoffCreated: Boolean(handoff),
        businessLeadId: businessLead?.id || null,
        sendSkipped: sendResult.skipped || false,
      });
    }

    let intentResult = classifyIntent({
      phone: normalized.contact.phone,
      messageType: normalized.message.type,
      text: normalized.message.normalizedText,
      buttonId: normalized.message.buttonId,
      listId: normalized.message.listId,
    });

    const employerDirectRoute = getAaratiEmployerDirectRoute({
      normalized,
      conversation,
    });

    if (employerDirectRoute) {
      intentResult = {
        ...intentResult,
        intent: employerDirectRoute.intent,
        needsHuman: false,
        priority: "medium",
        reason: employerDirectRoute.reason,
      };
    }

    intentResult = applyConversationIntentOverride({
      intentResult,
      conversation,
      normalized,
    });

    const aiBrain = await understandMessageWithAI({
      text: normalized.message.text || normalized.message.normalizedText,
      ruleIntentResult: intentResult,
      conversation,
    });

    intentResult = aiBrain.intentResult || intentResult;

    applyJobMateRoutingGuards({
      intentResult,
      aiBrain,
      conversation,
      normalized,
      env,
    });

    console.log("🧠 AI BRAIN RESULT:", {
      source: aiBrain.source,
      usedAI: aiBrain.usedAI,
      aiIntent: aiBrain.ai?.intent,
      aiConfidence: aiBrain.ai?.confidence,
      aiLocation: aiBrain.ai?.location,
      aiRole: aiBrain.ai?.role,
      aiQuantity: aiBrain.ai?.quantity,
      aiSalaryMin: aiBrain.ai?.salaryMin,
      finalIntent: intentResult.intent,
      state: conversation?.currentState,
      step: conversation?.metadata?.qualificationStep,
    });

    const inboundMessage = await saveInboundMessage({
      contact,
      conversation,
      normalized,
      intentResult,
    });

    await updateConversationIntent({
      conversation,
      intent: intentResult.intent,
      lastInboundMessageId: inboundMessage._id,
    });

    contact = await applyContactIntentState(contact, intentResult);

    let flowResult = null;

    if (intentResult.intent === "restart") {
      await resetConversationForRestart(conversation);

      flowResult = {
        intent: "restart",
        messageToSend: AARATI_SAMPLE_REPLIES.greeting,
      };
    } else if (
      env.BOT_MODE === "jobmate_hiring" &&
      intentResult.intent === "employer_lead"
    ) {
      console.log("🧠 EMPLOYER FLOW:", {
        intent: intentResult.intent,
        state: conversation?.currentState,
        step: conversation?.metadata?.qualificationStep,
      });

      const employerFlowText = normalized.message.normalizedText || normalized.message.text || "";
      const employerSideReply = getAaratiActiveFlowSideReply({ text: employerFlowText, conversation });

      if (employerSideReply) {
        flowResult = {
          intent: "employer_lead",
          messageToSend: employerSideReply,
        };
      } else if (shouldBlockEmployerFlowParsing({ text: employerFlowText, conversation })) {
        const employerTrap = detectNoFlowTrap({ text: employerFlowText, conversation });
        flowResult = {
          intent: employerTrap === "frustration" ? "frustrated" : "unknown",
          messageToSend: buildNoFlowTrapReply({ trap: employerTrap, conversation }),
          source: "no_flow_trap_gate",
        };
      } else {
        flowResult = await handleEmployerLead({
          contact,
          conversation,
          normalizedMessage: normalized,
          aiExtraction: aiBrain?.ai || null,
        });
      }
    } else if (
      env.BOT_MODE === "jobmate_hiring" &&
      (
        ["worker_registration", "job_search"].includes(intentResult.intent) ||
        Boolean(conversation?.metadata?.lastAskedField)
      )
    ) {
      const workerFlowText = normalized.message.normalizedText || normalized.message.text || "";
      if (shouldBlockWorkerFlowParsing({ text: workerFlowText, conversation })) {
        const workerTrap = detectNoFlowTrap({ text: workerFlowText, conversation });
        flowResult = {
          intent: workerTrap === "frustration" ? "frustrated" : "unknown",
          messageToSend: buildNoFlowTrapReply({ trap: workerTrap, conversation }),
          source: "no_flow_trap_gate",
        };
      } else {
        flowResult = await handleWorkerRegistration({
          contact,
          conversation,
          normalizedMessage: normalized,
        });
      }
    }

    if (!flowResult && intentResult.intent === "job_search") {
      const selected = getSelectedJobFromConversation({
        conversation,
        text: normalized.message.normalizedText,
      });

      if (selected) {
        conversation.metadata = {
          ...sanitizeConversationMetadata(conversation.metadata),
          selectedJob: selected.job,
          selectedJobIndex: selected.index,
          lastQuestion: "job_interest_confirmation",
        };
        await conversation.save();

        flowResult = {
          intent: "job_search",
          messageToSend: buildSelectedJobReply(selected),
          selectedJob: selected.job,
        };
      } else {
        const parsedQuery = parseJobSearchQuery(normalized.message.normalizedText);

        const query = {
          keyword: aiBrain?.ai?.keyword || parsedQuery.keyword,
          location: aiBrain?.ai?.location || parsedQuery.location,
          category: aiBrain?.ai?.category || parsedQuery.category,
        };

        const jobSearchResult = await searchJobMateJobs(query);

        const jobsForMemory = jobSearchResult.jobs.map((job) => ({
          id: job._id,
          title: job.title,
          companyName: job.employer?.company_name || "Verified Employer",
          location: job.location,
          salary_min: job.salary_min,
          salary_max: job.salary_max,
          type: job.type,
          category: job.category,
        }));

        conversation.currentIntent = "job_search";
        conversation.currentState = "job_search_results";
        conversation.metadata = {
          ...sanitizeConversationMetadata(conversation.metadata),
          lastJobSearch: {
            query,
            count: jobSearchResult.count,
            strategy: jobSearchResult.strategy,
            jobs: jobsForMemory,
            searchedAt: new Date(),
          },
          lastQuestion: "job_search_results",
        };
        await conversation.save();

        flowResult = {
          intent: "job_search",
          messageToSend: formatJobsForWhatsApp({
            jobs: jobSearchResult.jobs,
            location: query.location,
            keyword: query.keyword,
          }),
          jobSearch: {
            query,
            count: jobSearchResult.count,
            strategy: jobSearchResult.strategy,
          },
        };
      }
    }

    if (intentResult.intent === "opt_out") {
      await markConversationOptedOut(conversation);
    }

    let handoff = null;

    if (shouldCreateHandoff({ intentResult, flowResult })) {
      handoff = await createHandoffRequest({
        contact,
        conversation,
        reason: resolveHandoffReason({ intentResult, flowResult }),
        lastUserMessage: normalized.message.text || "",
        priority: resolveHandoffPriority({ intentResult, flowResult }),
        callRequired:
          intentResult.intent === "human_handoff" ||
          flowResult?.handoffReason === "high_value_employer",
        metadata: {
          intent: intentResult.intent,
          source: "whatsapp_webhook",
        },
      });

      if (flowResult?.employerLead) {
        const alertText = buildEmployerLeadAlert({
          contact,
          employerLead: flowResult.employerLead,
          handoff,
        });

        await sendTelegramAlert(alertText);
      }

      if (flowResult?.worker) {
        const alertText = buildWorkerQualifiedAlert({
          contact,
          worker: flowResult.worker,
          handoff,
        });

        await sendTelegramAlert(alertText);
      }
    }

    const activeConversation = flowResult?.conversation || conversation;

    const rawReplyText = buildReplyMessage({
      contact,
      intentResult,
      flowResult,
      conversation: activeConversation,
    });

    // Repetition guard: avoid sending the same generic menu twice in a row.
    const replyText = reduceMenuRepetition({
      reply: rawReplyText,
      conversation: activeConversation,
    });

    const sendResult = await sendWhatsAppTextMessage({
      to: contact.phone,
      text: replyText,
    });

    const outboundMessage = await saveOutboundMessage({
      contact,
      conversation: activeConversation,
      text: replyText,
      providerMessageId: sendResult.providerMessageId,
      status: sendResult.skipped ? "sent" : "sent",
    });

    await updateConversationIntent({
      conversation: activeConversation,
      intent: flowResult?.intent || intentResult.intent,
      lastOutboundMessageId: outboundMessage._id,
    });

    // Store lightweight context for next-message awareness (non-critical).
    const contextPatch = rememberLastContextPatch({
      text: normalized.message.text || normalized.message.normalizedText || "",
      reply: replyText,
      route: intentResult.intent,
      conversation: activeConversation,
    });
    if (activeConversation?._id && Object.keys(contextPatch).length) {
      const ConvModel = activeConversation.constructor;
      ConvModel.updateOne(
        { _id: activeConversation._id },
        {
          $set: Object.fromEntries(
            Object.entries(contextPatch).map(([k, v]) => [`metadata.${k}`, v])
          ),
        },
        { runValidators: false }
      ).catch(() => {}); // non-critical — do not block the response
    }

    await markMessageProcessed(processedMessageId);

    return res.status(200).json({
      success: true,
      message: "Webhook processed",
      intent: intentResult.intent,
      replied: true,
      sendSkipped: sendResult.skipped || false,
    });
  } catch (error) {
    await markMessageFailed(processedMessageId, error.message);

    console.error("❌ WhatsApp webhook processing failed:", sanitizeWebhookError(error));

    return res.status(200).json({
      success: false,
      message: "Webhook received but processing failed",
      error: error.message,
    });
  }
}


function sanitizeWebhookError(error) {
  return {
    status: error?.response?.status || null,
    message: error?.response?.data?.error?.message || error?.message || "Unknown error",
    code: error?.response?.data?.error?.code || null,
    type: error?.response?.data?.error?.type || null,
    fbtrace_id: error?.response?.data?.error?.fbtrace_id || null,
  };
}

function toWebhookMessageIntent(leadAgentResult = {}) {
  if (leadAgentResult.intent === "reset") return "restart";

  if (
    ["worker_registration", "employer_lead"].includes(
      leadAgentResult.conversationIntent
    )
  ) {
    return leadAgentResult.conversationIntent;
  }

  return "unknown";
}

function buildSyntheticNormalizedMessage({ normalized = {}, text = "" } = {}) {
  return {
    ...normalized,
    message: {
      ...(normalized.message || {}),
      text,
      normalizedText: String(text || "").toLowerCase(),
      type: "text",
    },
  };
}

function applyConversationIntentOverride({ intentResult, conversation, normalized }) {
  const text = normalized?.message?.normalizedText || "";

  const activeWorkerStates = [
    "ask_job_type",
    "ask_district",
    "ask_availability",
    "ask_document_status",
    "ask_location",
    "job_search_results",
    // New engine state names (Phase 1 refactor)
    "ask_jobType",
    "ask_documents",
    "showed_jobs",
    "asked_register",
    "search_done",
    "rejected",
    "completed",
  ];

  const activeEmployerStates = [
    "ask_business_name",
    "ask_business_name_after_ai",
    "ask_vacancy",
    "ask_vacancy_role",
    "ask_location",
    "ask_urgency",
      "ask_salary_range",
      "ask_work_type",
  ];

  const safeContinuationIntents = [
    "unknown",
    "positive",
    "negative",
    "defer",
  ];

  // Job search result routing:
  // If user just saw job results and replies 1/2/3,
  // treat it as job selection, not worker/employer menu.
  if (
    conversation?.metadata?.lastJobSearch?.jobs?.length &&
    /^[1-9][0-9]*$/.test(text)
  ) {
    return {
      ...intentResult,
      intent: "job_search",
      needsHuman: false,
      priority: "low",
      reason: "Selected job from search results",
    };
  }

  // START menu routing:
  // If conversation is idle and user replies 1/2/3, map to correct flow.
  if (conversation?.currentState === "idle") {
    if (text === "1") {
      return {
        ...intentResult,
        intent: "worker_registration",
        needsHuman: false,
        priority: "low",
        reason: "Menu selected: worker registration",
      };
    }

    if (text === "2") {
      return {
        ...intentResult,
        intent: "employer_lead",
        needsHuman: false,
        priority: "low",
        reason: "Menu selected: employer lead",
      };
    }

    if (text === "3") {
      return {
        ...intentResult,
        intent: "human_handoff",
        needsHuman: true,
        priority: "high",
        reason: "Menu selected: human support",
      };
    }
  }

  // Employer flow lock:
  // If the conversation is already collecting employer details,
  // short answers like "butwal" or "1" must continue employer flow,
  // not become jobseeker search/registration.
  // Exclude "completed" and "idle" — those mean the flow is done and should not be locked.
  const isPostFlowState = ["completed", "idle", ""].includes(conversation?.currentState || "");
  const isEmployerFlowActive =
    !isPostFlowState &&
    (activeEmployerStates.includes(conversation?.currentState) ||
    conversation?.currentIntent === "employer_lead" ||
    (Number(conversation?.metadata?.qualificationStep || 0) >= 1 &&
      Number(conversation?.metadata?.qualificationStep || 0) <= 4 &&
      activeEmployerStates.includes(conversation?.currentState)));

  if (
    isEmployerFlowActive &&
    !["restart", "opt_out", "human_handoff", "frustrated"].includes(intentResult.intent)
  ) {
    return {
      ...intentResult,
      intent: "employer_lead",
      needsHuman: false,
      priority: "low",
      reason: "Locked to active employer flow",
    };
  }

  const isWorkerFlowActive =
    activeWorkerStates.includes(conversation?.currentState) ||
    conversation?.currentIntent === "worker_registration" ||
    conversation?.metadata?.activeFlow === "worker_registration" ||
    ["jobType", "district", "availability", "documents"].includes(
      conversation?.metadata?.lastAskedField
    );

  if (
    isWorkerFlowActive &&
    !["restart", "opt_out", "human_handoff", "frustrated"].includes(intentResult.intent)
  ) {
    return {
      ...intentResult,
      intent: "worker_registration",
      needsHuman: false,
      priority: "low",
      reason: "Locked to active worker flow",
    };
  }

  // If user is clearly searching jobs, do not force old worker registration state.
  if (intentResult.intent === "job_search") {
    return intentResult;
  }

  if (
    safeContinuationIntents.includes(intentResult.intent) &&
    activeWorkerStates.includes(conversation?.currentState)
  ) {
    return {
      ...intentResult,
      intent: "worker_registration",
      needsHuman: false,
      priority: "low",
      reason: "Continued worker flow by conversation state",
    };
  }

  // If user is angry/frustrated, do not force old employer flow.
  if (intentResult.intent === "frustrated") {
    return intentResult;
  }

  if (
    safeContinuationIntents.includes(intentResult.intent) &&
    activeEmployerStates.includes(conversation?.currentState)
  ) {
    return {
      ...intentResult,
      intent: "employer_lead",
      needsHuman: false,
      priority: "low",
      reason: "Continued employer flow by conversation state",
    };
  }

  return intentResult;
}

const AUTOMATION_WORKER_ACTIVE_STATES = new Set([
  "ask_job_type",
  "ask_jobType",
  "ask_district",
  "ask_location",
  "ask_availability",
  "ask_document_status",
  "ask_documents",
  "ask_fullName",
  "ask_providedPhone",
  "ask_age",
  "ask_experience",
  "ask_expectedSalary",
  "ask_confirmation",
  "asked_register",
]);

const AUTOMATION_WORKER_ACTIVE_FIELDS = new Set([
  "jobType",
  "district",
  "location",
  "availability",
  "documents",
  "fullName",
  "providedPhone",
  "age",
  "experience",
  "expectedSalary",
  "confirmation",
]);

export function getJobMateAutomationActiveFlowRoute(conversation = {}) {
  if (isActiveAutomationEmployerLeadConversation(conversation)) {
    return "employer";
  }

  if (isActiveAutomationWorkerRegistrationConversation(conversation)) {
    return "worker";
  }

  return null;
}

function isActiveAutomationWorkerRegistrationConversation(conversation = {}) {
  const currentIntent = String(conversation?.currentIntent || "");
  const currentState = String(conversation?.currentState || "");
  const activeFlow = String(conversation?.metadata?.activeFlow || "");
  const lastAskedField = String(conversation?.metadata?.lastAskedField || "");
  const leadAgentFlow = conversation?.metadata?.jobmateLeadAgent?.flow;

  if (leadAgentFlow) return false;
  if (["employer_lead", "employer"].includes(currentIntent) || activeFlow === "employer_lead") {
    return false;
  }
  if (["", "idle", "completed"].includes(currentState)) return false;

  const workerOwned =
    currentIntent === "worker_registration" ||
    activeFlow === "worker_registration" ||
    AUTOMATION_WORKER_ACTIVE_FIELDS.has(lastAskedField);

  if (!workerOwned) return false;

  return (
    activeFlow === "worker_registration" ||
    AUTOMATION_WORKER_ACTIVE_STATES.has(currentState) ||
    AUTOMATION_WORKER_ACTIVE_FIELDS.has(lastAskedField)
  );
}

const AUTOMATION_EMPLOYER_ACTIVE_STATES = new Set([
  "ask_business_name",
  "ask_business_name_after_ai",
  "ask_vacancy",
  "ask_vacancy_role",
  "ask_role",
  "ask_location",
  "ask_business_location",
  "ask_area",
  "ask_district",
  "ask_urgency",
  "ask_salary_range",
  "ask_work_type",
]);

function isActiveAutomationEmployerLeadConversation(conversation = {}) {
  const currentIntent = String(conversation?.currentIntent || "");
  const currentState = String(conversation?.currentState || "");
  const activeFlow = String(conversation?.metadata?.activeFlow || "");
  const qualificationStep = Number(conversation?.metadata?.qualificationStep || 0);
  const leadAgentFlow = conversation?.metadata?.jobmateLeadAgent?.flow;

  if (leadAgentFlow) return false;
  if (!["employer_lead", "employer"].includes(currentIntent) && activeFlow !== "employer_lead") {
    return false;
  }

  return (
    AUTOMATION_EMPLOYER_ACTIVE_STATES.has(currentState) ||
    (qualificationStep > 0 && qualificationStep < 7)
  );
}


function getSelectedJobFromConversation({ conversation, text }) {
  const number = Number(String(text || "").trim());

  if (!Number.isInteger(number) || number < 1) return null;

  const jobs = conversation?.metadata?.lastJobSearch?.jobs || [];
  const selectedJob = jobs[number - 1];

  if (!selectedJob) return null;

  return {
    index: number,
    job: selectedJob,
  };
}

function buildSelectedJobReply(selected) {
  const job = selected.job;

  const salary =
    job.salary_min && job.salary_max
      ? `NPR ${Number(job.salary_min).toLocaleString()}–${Number(job.salary_max).toLocaleString()}`
      : "Salary not mentioned";

  return `Tapai le yo job select garnubhayo:

${selected.index}. ${job.title}
🏢 ${job.companyName || "Verified Employer"}
📍 ${job.location || "-"}
💰 ${salary}
🕒 ${job.type || "-"}

Ke tapai yo job ma interested hunuhuncha?

1. Yes, apply/interest submit garna
2. More details herna
3. Arko job khojna`;
}


function safeDisplayName(name) {
  const value = String(name || "").trim();

  if (!value) return "Mitra";

  const badNames = ["recruiter", "unknown", "undefined", "null"];

  if (badNames.includes(value.toLowerCase())) {
    return "Mitra";
  }

  return value;
}


function shouldExtractDetailsWithAI({ intent, text, conversation }) {
  const message = String(text || "").toLowerCase();

  // Use AI for rich employer messages so we can extract role, quantity, salary, location.
  if (intent === "employer_lead") {
    return (
      /\d+/.test(message) ||
      message.includes("salary") ||
      message.includes("waiter") ||
      message.includes("driver") ||
      message.includes("helper") ||
      message.includes("staff") ||
      message.includes("worker") ||
      message.includes("hotel") ||
      message.includes("factory") ||
      message.includes("bardaghat") ||
      message.includes("bardghat") ||
      message.includes("butwal")
    );
  }

  // Use AI for job searches to normalize typo/location/category.
  if (intent === "job_search") {
    return true;
  }

  // Use AI for frustrated messages to classify scam/fake/abuse safely.
  if (intent === "frustrated") {
    return true;
  }

  return false;
}

function sanitizeConversationMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return {};

  const safe = { ...metadata };

  // Avoid leaking business receptionist state into JobMate mode.
  if (env.BOT_MODE !== "business_receptionist") {
    delete safe.businessReceptionist;
  }

  return safe;
}
