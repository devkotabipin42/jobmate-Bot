import { BusinessLead } from "../../models/BusinessLead.model.js";
import { BusinessProfile } from "../../models/BusinessProfile.model.js";
import { extractBusinessLeadWithAI } from "../ai/businessLeadExtractionAI.service.js";

const SKIP_MENU_SOURCES = new Set([
  "business_menu_services",
  "business_menu_booking",
  "business_menu_location",
]);

export async function upsertBusinessLeadFromReceptionist({
  contact,
  conversation,
  normalizedMessage,
  flowResult,
}) {
  const messageText =
    normalizedMessage?.message?.text ||
    normalizedMessage?.message?.normalizedText ||
    "";

  // Do not create leads for simple menu clicks like 1/2/3.
  // Lead should start when user selects a service, asks discount/human, or gives booking details.
  if (SKIP_MENU_SOURCES.has(flowResult?.source)) {
    return null;
  }

  const businessProfile = await BusinessProfile.findOne({
    singletonKey: "default",
    isActive: true,
  }).lean();

  const leadData = flowResult?.lead || {};

  const selectedService =
    leadData.service ||
    leadData.interest ||
    conversation?.metadata?.businessReceptionist?.selectedService ||
    "";

  const aiExtraction = await extractBusinessLeadWithAI({
    messageText,
    selectedService,
    businessType: businessProfile?.businessType || "",
  });

  const service =
    aiExtraction?.service ||
    selectedService ||
    "";

  const shouldSave =
    Boolean(service) ||
    Boolean(flowResult?.needsHuman) ||
    ["booking_request", "discount_request", "human_request", "price_inquiry", "service_inquiry"].includes(
      flowResult?.intent
    );

  if (!shouldSave) return null;

  const isSimpleAck = /^(ok|okay|huncha|huss|hus|thanks|thank you|dhanyabaad|dhanyabad|la|thik xa|thik cha)$/i.test(
    messageText.trim()
  );

  const bookingMessage =
    ["booking_request", "lead_capture"].includes(flowResult?.intent) && !isSimpleAck
      ? messageText
      : "";

  const update = {
    contactId: contact._id,
    conversationId: conversation?._id || null,
    phone: contact.phone,
    displayName: contact.displayName || "",
    customerName:
      leadData.name ||
      aiExtraction?.customerName ||
      conversation?.metadata?.businessReceptionist?.customerName ||
      "",
    businessProfileId: businessProfile?._id || null,
    source: "whatsapp",
    intent: aiExtraction?.intent || flowResult?.intent || "unknown",
    service,
    interest: leadData.interest || service || "",
    preferredDate:
      aiExtraction?.preferredDate ||
      leadData.preferredDate ||
      extractDateHint(messageText),
    preferredTime:
      aiExtraction?.preferredTime ||
      leadData.preferredTime ||
      extractTimeHint(messageText),
    location: aiExtraction?.location || leadData.location || "",
    firstMessage: messageText,
    bookingMessage,
    lastMessage: messageText,
    priority: flowResult?.priority || "low",
    needsHuman: Boolean(flowResult?.needsHuman || aiExtraction?.needsHuman),
  };

  Object.keys(update).forEach((key) => {
    if (update[key] === undefined) delete update[key];
  });

  // Do not overwrite useful existing lead fields with empty values
  const safeUpdate = { ...update };

  for (const key of [
    "service",
    "interest",
    "preferredDate",
    "preferredTime",
    "location",
    "customerName",
    "bookingMessage",
  ]) {
    if (safeUpdate[key] === "") {
      delete safeUpdate[key];
    }
  }

  delete safeUpdate.firstMessage;

  const lead = await BusinessLead.findOneAndUpdate(
    {
      contactId: contact._id,
      status: { $in: ["new", "contacted"] },
    },
    {
      $set: safeUpdate,
      $setOnInsert: {
        status: "new",
        firstMessage: messageText,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  ).lean();

  return formatBusinessLead(lead);
}

function extractDateHint(text = "") {
  const lower = String(text).toLowerCase();

  if (
    lower.includes("bholi") ||
    lower.includes("boli") ||
    lower.includes("voli") ||
    lower.includes("tomorrow")
  ) return "tomorrow";
  if (
    lower.includes("aaja") ||
    lower.includes("aaile") ||
    lower.includes("ahile") ||
    lower.includes("today")
  ) return "today";
  if (lower.includes("parsi")) return "day_after_tomorrow";

  return "";
}

function extractTimeHint(text = "") {
  const lower = String(text).toLowerCase();

  const relativeHourMatch = lower.match(/(\d{1,2})\s*(ganta|hour|hours)\s*(paxi|later)/);
  if (relativeHourMatch) return `${relativeHourMatch[1]} hours later`;

  if (lower.includes("akxin paxi") || lower.includes("ekxin paxi") || lower.includes("ali paxi")) {
    return "soon";
  }

  const match =
    lower.match(/(\d{1,2})\s*(baje|bje|bajey|bajje|am|pm)/) ||
    lower.match(/(\d{1,2}):(\d{2})/);

  if (lower.includes("deuso") || lower.includes("diuso") || lower.includes("afternoon")) {
    return "afternoon";
  }

  if (lower.includes("bihana") || lower.includes("morning")) {
    return "morning";
  }

  if (lower.includes("belka") || lower.includes("evening")) {
    return "evening";
  }

  if (!match) return "";

  return match[0];
}

function formatBusinessLead(lead) {
  if (!lead) return null;

  return {
    id: lead._id,
    contactId: lead.contactId,
    conversationId: lead.conversationId,
    phone: lead.phone,
    displayName: lead.displayName,
    intent: lead.intent,
    service: lead.service,
    interest: lead.interest,
    preferredDate: lead.preferredDate,
    preferredTime: lead.preferredTime,
    status: lead.status,
    priority: lead.priority,
    needsHuman: lead.needsHuman,
    lastMessage: lead.lastMessage,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
