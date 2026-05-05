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
import { getAaratiEmployerDirectRoute } from "../services/aarati/aaratiEmployerDirectRouter.service.js";
import { getUserTextForPolish, polishAaratiReply } from "../services/aarati/aaratiReplyPolish.service.js";
import { generateJobMateGeneralAnswer } from "../services/rag/jobmateGeneralAnswer.service.js";
import {
  buildDocumentReceivedReply,
  isSupportedDocumentMedia,
  saveWorkerDocumentMetadata,
} from "../services/uploads/documentUpload.service.js";

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

    const mediaIntentResult = {
        intent: "document_upload",
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

      const shouldCompleteProfile =
        conversation?.currentState === "ask_documents" ||
        conversation?.metadata?.lastAskedField === "documents";

      let replyText = buildDocumentReceivedReply(saved?.document);

      if (shouldCompleteProfile) {
        const completedProfile = {
          ...currentJobmateProfile,
          documents: "yes",
        };

        if (typeof jobmateConfig.onComplete === "function") {
          await jobmateConfig.onComplete({
            contact,
            profile: completedProfile,
            conversation,
          });
        }

        if (conversation?._id) {
          const Model = conversation.constructor;
          await Model.updateOne(
            { _id: conversation._id },
            {
              $set: {
                currentState: "completed",
                "metadata.collectedData": completedProfile,
                "metadata.lastAskedField": null,
              },
            },
            { runValidators: false }
          );
        }

        const completionText =
          typeof jobmateConfig.completionMessage === "function"
            ? jobmateConfig.completionMessage(completedProfile)
            : "Dhanyabaad 🙏 Tapai ko detail JobMate ma save bhayo.";

        replyText = `${replyText}\n\n${completionText}`;
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
        intent: "document_upload",
        lastInboundMessageId: inboundMessage._id,
        lastOutboundMessageId: outboundMessage._id,
      });

      await markMessageProcessed(processedMessageId);

      return res.status(200).json({
        success: true,
        message: "Document metadata captured",
        intent: "document_upload",
        replied: true,
        workerId: saved?.worker?._id || null,
        documentType: saved?.document?.type || "other",
        sendSkipped: sendResult.skipped || false,
      });
    }


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

      flowResult = await handleEmployerLead({
        contact,
        conversation,
        normalizedMessage: normalized,
        aiExtraction: aiBrain?.ai || null,
      });
    } else if (
      env.BOT_MODE === "jobmate_hiring" &&
      (
        ["worker_registration", "job_search"].includes(intentResult.intent) ||
        Boolean(conversation?.metadata?.lastAskedField)
      )
    ) {
      flowResult = await handleWorkerRegistration({
        contact,
        conversation,
        normalizedMessage: normalized,
      });
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

    const replyText = buildReplyMessage({
      contact,
      intentResult,
      flowResult,
      conversation: flowResult?.conversation || conversation,
    });

    const sendResult = await sendWhatsAppTextMessage({
      to: contact.phone,
      text: replyText,
    });

    const outboundMessage = await saveOutboundMessage({
      contact,
      conversation: flowResult?.conversation || conversation,
      text: replyText,
      providerMessageId: sendResult.providerMessageId,
      status: sendResult.skipped ? "sent" : "sent",
    });

    await updateConversationIntent({
      conversation: flowResult?.conversation || conversation,
      intent: flowResult?.intent || intentResult.intent,
      lastOutboundMessageId: outboundMessage._id,
    });

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
  const isEmployerFlowActive =
    activeEmployerStates.includes(conversation?.currentState) ||
    conversation?.currentIntent === "employer_lead" ||
    (Number(conversation?.metadata?.qualificationStep || 0) >= 1 &&
      Number(conversation?.metadata?.qualificationStep || 0) <= 4 &&
      activeEmployerStates.includes(conversation?.currentState));

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
