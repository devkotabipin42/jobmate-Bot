import { BusinessProfile } from "../../models/BusinessProfile.model.js";
import { Conversation } from "../../models/Conversation.model.js";
import { generateBusinessReceptionistReply } from "../ai/businessReceptionistAI.service.js";
import { generateNaturalBusinessReply } from "../ai/businessReplyAI.service.js";

export async function handleBusinessReceptionistMessage({
  contact,
  conversation,
  normalizedMessage,
}) {
  const text = String(
    normalizedMessage?.message?.text ||
      normalizedMessage?.message?.normalizedText ||
      normalizedMessage?.message?.buttonId ||
      normalizedMessage?.message?.buttonTitle ||
      ""
  ).trim();

  const clean = text.toLowerCase().trim();

  if (["start", "restart", "menu", "hi", "hello", "namaste"].includes(clean)) {
    await setBusinessState(conversation, {
      lastQuestion: "main_menu",
      selectedService: null,
    });
  }

  const menuResult = await handleBusinessMenuOption({
    text,
    conversation,
  });

  if (menuResult) {
    return {
      ...menuResult,
      contact,
      conversation,
    };
  }

  const postBookingAck = await handlePostBookingAck({
    text,
    conversation,
  });

  if (postBookingAck) {
    return {
      ...postBookingAck,
      contact,
      conversation,
    };
  }

  const nameCapture = await handleNameCapture({
    text,
    conversation,
  });

  if (nameCapture) {
    return {
      ...nameCapture,
      contact,
      conversation,
    };
  }

  const bookingFollowUp = await handleBookingFollowUp({
    text,
    conversation,
  });

  if (bookingFollowUp) {
    return {
      ...bookingFollowUp,
      contact,
      conversation,
    };
  }

  const aiResult = await generateBusinessReceptionistReply(text);

  return {
    intent: aiResult.intent || "unknown",
    messageToSend: aiResult.reply,
    needsHuman: Boolean(aiResult.needsHuman),
    priority: aiResult.priority || "low",
    reason: aiResult.reason || "",
    source: aiResult.source || "business_receptionist",
    lead: aiResult.lead || {},
    contact,
    conversation,
  };
}

async function handleBusinessMenuOption({ text, conversation }) {
  const clean = String(text || "").trim().toLowerCase();

  const profile = await BusinessProfile.findOne({
    singletonKey: "default",
    isActive: true,
  }).lean();

  if (!profile) {
    return {
      intent: "unknown",
      messageToSend:
        "Business details setup hudai cha. Hamro team le chhittai reply garnuhuncha.",
      needsHuman: true,
      priority: "medium",
      reason: "Business profile missing",
      source: "business_menu_no_profile",
      lead: {},
    };
  }

  const services = (profile.services || []).filter(
    (service) => service.isActive !== false
  );

  const latestConversation = conversation?._id
    ? await Conversation.findById(conversation._id).lean()
    : null;

  const lastQuestion =
    latestConversation?.metadata?.businessReceptionist?.lastQuestion ||
    conversation?.metadata?.businessReceptionist?.lastQuestion;

  // If user is choosing from services list
  if (/^\d+$/.test(clean) && lastQuestion === "service_selection") {
    const index = Number(clean) - 1;
    const selectedService = services[index];

    if (!selectedService) {
      return {
        intent: "service_inquiry",
        messageToSend:
          "Yo number service list ma dekhiiyena 🙏 Service list bata milne number pathaunu hola.",
        needsHuman: false,
        priority: "low",
        reason: "Invalid service selection",
        source: "business_invalid_service_selection",
        lead: {},
      };
    }

    await setBusinessState(conversation, {
      lastQuestion: "service_detail",
      selectedService: selectedService.name,
    });

    return {
      intent: "service_inquiry",
      messageToSend: buildServiceDetailReply(selectedService),
      needsHuman: false,
      priority: "low",
      reason: `Selected service: ${selectedService.name}`,
      source: "business_service_selected",
      lead: {
        service: selectedService.name,
        interest: selectedService.name,
      },
    };
  }

  // Main menu option 1 = show services
  if (clean === "1" || clean === "service" || clean === "services" || clean === "price") {
    await setBusinessState(conversation, {
      lastQuestion: "service_selection",
      selectedService: null,
    });

    const serviceList = services
      .slice(0, 8)
      .map((service, index) => {
        const price = formatServicePrice(service);
        return `${index + 1}. ${service.name}${price ? ` — ${price}` : ""}`;
      })
      .join("\n");

    return {
      intent: "price_inquiry",
      messageToSend: serviceList
        ? `Hajur, hamra services haru:\n\n${serviceList}\n\nKun service ko detail bujhna chahanu huncha? Number pathaunus.`
        : "Services list ahile update hudai cha. Kun service chahiyeko ho pathaunus, team le confirm garera reply garnuhuncha.",
      needsHuman: services.length === 0,
      priority: services.length === 0 ? "medium" : "low",
      reason: "Business menu services selected",
      source: "business_menu_services",
      lead: {},
    };
  }

  // Main menu option 2 = booking
  if (clean === "2") {
    await setBusinessState(conversation, {
      lastQuestion: "booking_service",
      selectedService: null,
    });

    return {
      intent: "booking_request",
      messageToSend:
        "Booking garna milcha 🙏\n\nKun service ko lagi booking garna khojnu bhayeko ho? Ani preferred date/time pani pathaunu hola.",
      needsHuman: false,
      priority: "low",
      reason: "Business menu booking selected",
      source: "business_menu_booking",
      lead: {},
    };
  }

  // Main menu option 3 = location
  if (clean === "3") {
    const area = profile.location?.area || "";
    const district = profile.location?.district || "";
    const province = profile.location?.province || "";
    const mapLink = profile.location?.mapLink || "";

    const locationText = [area, district, province].filter(Boolean).join(", ");

    return {
      intent: "location_inquiry",
      messageToSend: locationText
        ? `Hamro location ${locationText} ma ho.${mapLink ? `\nMap: ${mapLink}` : ""}`
        : "Location detail hamro team le confirm garera pathaunuhuncha.",
      needsHuman: !locationText,
      priority: locationText ? "low" : "medium",
      reason: "Business menu location selected",
      source: "business_menu_location",
      lead: {},
    };
  }

  return null;
}

async function setBusinessState(conversation, state = {}) {
  if (!conversation?._id) return;

  const businessReceptionistState = {
    ...(conversation.metadata?.businessReceptionist || {}),
    ...state,
    updatedAt: new Date(),
  };

  // Update DB directly so nested metadata is always persisted reliably.
  await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $set: {
        currentIntent: "unknown",
        currentState: "idle",
        "metadata.businessReceptionist": businessReceptionistState,
      },
    },
    { returnDocument: "after" }
  );

  // Also update local object for same-request logic.
  conversation.currentIntent = "unknown";
  conversation.currentState = "idle";
  conversation.metadata = {
    ...(conversation.metadata || {}),
    businessReceptionist: businessReceptionistState,
  };
}

function buildServiceDetailReply(service) {
  const price = formatServicePrice(service);

  let reply = `${service.name}`;

  if (price) {
    reply += ` ${price} bata available cha.`;
  } else {
    reply += " ko price hamro team le confirm garera pathaunuhuncha.";
  }

  if (service.description) {
    reply += `\n${service.description}`;
  }

  reply += "\n\nTapai yo service ko lagi booking/detail bujhna chahanu huncha?";

  return reply;
}

async function handlePostBookingAck({ text, conversation }) {
  const clean = String(text || "").trim().toLowerCase();

  const latestConversation = conversation?._id
    ? await Conversation.findById(conversation._id).lean()
    : null;

  const state =
    latestConversation?.metadata?.businessReceptionist ||
    conversation?.metadata?.businessReceptionist ||
    {};

  if (!["booking_ready_for_confirmation", "booking_completed"].includes(state.lastQuestion)) {
    return null;
  }

  const isAck = [
    "ok",
    "okay",
    "huncha",
    "huss",
    "hus",
    "thank you",
    "thanks",
    "dhanyabaad",
    "dhanyabad",
    "la",
    "thik xa",
    "thik cha",
  ].some((word) => clean === word || clean.includes(word));

  if (!isAck) return null;

  await setBusinessState(conversation, {
    lastQuestion: "booking_completed",
    selectedService: state.selectedService || "",
    customerName: state.customerName || "",
  });

  return {
    intent: "lead_capture",
    messageToSend:
      "Hajur, dhanyabaad 🙏\n\nHamro team/owner le availability confirm garera tapai lai reply garnuhuncha.",
    needsHuman: false,
    priority: "low",
    reason: "Customer acknowledged booking confirmation",
    source: "business_post_booking_ack",
    lead: {
      name: state.customerName || "",
      service: state.selectedService || "",
      interest: state.selectedService || "",
    },
  };
}


async function handleNameCapture({ text, conversation }) {
  const clean = String(text || "").trim();

  const latestConversation = conversation?._id
    ? await Conversation.findById(conversation._id).lean()
    : null;

  const state =
    latestConversation?.metadata?.businessReceptionist ||
    conversation?.metadata?.businessReceptionist ||
    {};

  if (state.lastQuestion !== "ask_name") return null;

  const customerName = extractCustomerName(clean);

  if (!customerName) {
    return {
      intent: "lead_capture",
      messageToSend:
        "Tapai ko naam matra pathaunu hola, booking note garna sajilo huncha 🙏",
      needsHuman: false,
      priority: "low",
      reason: "Waiting for customer name",
      source: "business_name_capture_retry",
      lead: {
        service: state.selectedService || "",
        interest: state.selectedService || "",
      },
    };
  }

  await setBusinessState(conversation, {
    lastQuestion: "booking_ready_for_confirmation",
    selectedService: state.selectedService || "",
    customerName,
  });

  return {
    intent: "lead_capture",
    messageToSend:
      `Dhanyabaad ${capitalizeName(customerName)} ji 🙏\n\n` +
      `Tapai ko ${state.selectedService || "service"} booking request note bhayo. ` +
      `Hamro team/owner le availability confirm garera tapai lai reply garnuhuncha.`,
    needsHuman: true,
    priority: "high",
    reason: "Customer name captured for booking",
    source: "business_name_captured",
    lead: {
      name: capitalizeName(customerName),
      service: state.selectedService || "",
      interest: state.selectedService || "",
    },
  };
}

function extractCustomerName(text = "") {
  let clean = String(text || "")
    .toLowerCase()
    .replace(/mero\s+(naam|nam|name)\s*/g, "")
    .replace(/my\s+name\s+is\s*/g, "")
    .replace(/^(naam|nam|name)\s*(chai|ho|is)?\s*/g, "")
    .replace(/\s+(ho|ko|ta|tw|chai)\s*$/g, "")
    .replace(/ho name tw|ho name ta|ho naam tw|ho naam ta|ho nam tw|ho nam ta/g, "")
    .replace(/name tw|name ta|naam tw|naam ta|nam tw|nam ta/g, "")
    .replace(/ma |maa /g, "")
    .replace(/[।,?!.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const badWords = [
    "booking",
    "book",
    "bholi",
    "boli",
    "voli",
    "aaja",
    "deuso",
    "diuso",
    "baje",
    "khali",
    "hunxa",
    "xa",
    "chaina",
    "garidinu",
    "gardinu",
    "ho",
    "hu",
    "hun",
    "hoina",
    "ko",
    "ko ho",
    "ta",
    "tw",
  ];

  const parts = clean
    .split(" ")
    .filter(Boolean)
    .filter((word) => !badWords.includes(word));

  if (parts.length === 0) return "";

  return parts.slice(0, 3).join(" ");
}

function capitalizeName(name = "") {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function handleBookingFollowUp({ text, conversation }) {
  const clean = String(text || "").trim().toLowerCase();

  const latestConversation = conversation?._id
    ? await Conversation.findById(conversation._id).lean()
    : null;

  const state =
    latestConversation?.metadata?.businessReceptionist ||
    conversation?.metadata?.businessReceptionist ||
    {};

  const selectedService = state.selectedService || "";
  const lastQuestion = state.lastQuestion || "";

  const looksLikeBooking =
    includesAny(clean, [
      "book",
      "booking",
      "aauxu",
      "aauchu",
      "aaunxu",
      "aaunchu",
      "gardinu",
      "garidinu",
      "bholi",
      "boli",
      "voli",
      "tomorrow",
      "aaja",
      "today",
      "parsi",
      "deuso",
      "diuso",
      "bihana",
      "belka",
      "baje",
      "am",
      "pm",
    ]);

  if (!selectedService || !looksLikeBooking) return null;

  if (!["service_detail", "booking_service"].includes(lastQuestion)) {
    return null;
  }

  await setBusinessState(conversation, {
    lastQuestion: "ask_name",
    selectedService,
  });

  const profile = await BusinessProfile.findOne({
    singletonKey: "default",
    isActive: true,
  }).lean();

  const naturalReply = await generateNaturalBusinessReply({
    businessName: profile?.businessName || "hamro business",
    businessType: profile?.businessType || "local_business",
    selectedService,
    userMessage: text,
    replyGoal: "availability_or_booking_followup",
  });

  return {
    intent: "booking_request",
    messageToSend:
      naturalReply ||
      (`Hajur, ${selectedService} ko booking request note gareko chu.\n\n` +
        `Hamro team/owner le time confirm garera tapai lai reply garnuhuncha. Tapai ko naam pathaunuhola?`),
    needsHuman: true,
    priority: "high",
    reason: "User gave booking date/time after selecting service",
    source: naturalReply ? "business_booking_reply_ai" : "business_booking_followup",
    lead: {
      service: selectedService,
      interest: selectedService,
    },
  };
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(String(word).toLowerCase()));
}

function formatServicePrice(service = {}) {
  const currency = service.currency || "NPR";
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from && to) {
    return `${currency} ${Number(from).toLocaleString()}-${Number(to).toLocaleString()}`;
  }

  if (from) {
    return `${currency} ${Number(from).toLocaleString()}+`;
  }

  return "";
}
