import { Contact } from "../../models/Contact.model.js";
import { Conversation } from "../../models/Conversation.model.js";
import { Message } from "../../models/Message.model.js";
import { EmployerLead } from "../../models/EmployerLead.model.js";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";

export async function getConversations({
  search,
  contactType,
  status,
  page = 1,
  limit = 20,
}) {
  const contactQuery = {};

  if (contactType) {
    contactQuery.contactType = contactType;
  }

  if (status) {
    contactQuery.status = status;
  }

  if (search) {
    contactQuery.$or = [
      { displayName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { waId: { $regex: search, $options: "i" } },
    ];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [contacts, total] = await Promise.all([
    Contact.find(contactQuery)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Contact.countDocuments(contactQuery),
  ]);

  const contactIds = contacts.map((contact) => contact._id);

  const [conversations, latestMessages, employerLeads, workers] =
    await Promise.all([
      Conversation.find({ contactId: { $in: contactIds } }).lean(),

      Message.aggregate([
        {
          $match: {
            contactId: { $in: contactIds },
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$contactId",
            latestMessage: { $first: "$$ROOT" },
            messageCount: { $sum: 1 },
          },
        },
      ]),

      EmployerLead.find({ contactId: { $in: contactIds } }).lean(),
      WorkerProfile.find({ contactId: { $in: contactIds } }).lean(),
    ]);

  const conversationMap = new Map(
    conversations.map((conversation) => [
      String(conversation.contactId),
      conversation,
    ])
  );

  const latestMessageMap = new Map(
    latestMessages.map((item) => [String(item._id), item])
  );

  const employerMap = new Map(
    employerLeads.map((lead) => [String(lead.contactId), lead])
  );

  const workerMap = new Map(
    workers.map((worker) => [String(worker.contactId), worker])
  );

  return {
    items: contacts.map((contact) => {
      const key = String(contact._id);
      const conversation = conversationMap.get(key);
      const latestMessageInfo = latestMessageMap.get(key);
      const employerLead = employerMap.get(key);
      const worker = workerMap.get(key);

      return formatConversationListItem({
        contact,
        conversation,
        latestMessageInfo,
        employerLead,
        worker,
      });
    }),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getConversationMessages({
  contactId,
  page = 1,
  limit = 50,
}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [contact, conversation, messages, total, employerLead, worker] =
    await Promise.all([
      Contact.findById(contactId).lean(),
      Conversation.findOne({ contactId }).lean(),

      Message.find({ contactId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),

      Message.countDocuments({ contactId }),

      EmployerLead.findOne({ contactId })
        .sort({ createdAt: -1 })
        .lean(),

      WorkerProfile.findOne({ contactId })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

  if (!contact) {
    return null;
  }

  return {
    contact: {
      id: contact._id,
      displayName: contact.displayName || "Mitra",
      phone: contact.phone || "-",
      waId: contact.waId || "-",
      contactType: contact.contactType || "unknown",
      status: contact.status || "active",
      botMode: contact.botMode || "bot",
      language: contact.language || "nepali_english",
      lastMessageAt: contact.lastMessageAt || null,
      createdAt: contact.createdAt,
    },

    conversation: conversation
      ? {
          id: conversation._id,
          currentIntent: conversation.currentIntent || "unknown",
          currentState: conversation.currentState || "idle",
          metadata: conversation.metadata || {},
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        }
      : null,

    employerLead: employerLead
      ? {
          id: employerLead._id,
          businessName: employerLead.businessName || "-",
          contactPerson: employerLead.contactPerson || "-",
          phone: employerLead.phone || "-",
          location: employerLead.location || {},
          hiringNeeds: employerLead.hiringNeeds || [],
          leadStatus: employerLead.leadStatus || "new",
          urgencyLevel: employerLead.urgencyLevel || "unknown",
          score: employerLead.score || 0,
        }
      : null,

    worker: worker
      ? {
          id: worker._id,
          fullName: worker.fullName || "-",
          phone: worker.phone || "-",
          jobPreferences: worker.jobPreferences || [],
          location: worker.location || {},
          availability: worker.availability || "unknown",
          documentStatus: worker.documentStatus || "unknown",
          profileStatus: worker.profileStatus || "new",
          score: worker.score || 0,
        }
      : null,

    messages: messages.reverse().map(formatMessage),

    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

function formatConversationListItem({
  contact,
  conversation,
  latestMessageInfo,
  employerLead,
  worker,
}) {
  const latestMessage = latestMessageInfo?.latestMessage || null;

  return {
    contactId: contact._id,
    displayName: contact.displayName || "Mitra",
    phone: contact.phone || "-",
    contactType: contact.contactType || "unknown",
    status: contact.status || "active",
    botMode: contact.botMode || "bot",

    currentIntent: conversation?.currentIntent || "unknown",
    currentState: conversation?.currentState || "idle",

    latestMessage: latestMessage
      ? {
          id: latestMessage._id,
          direction: latestMessage.direction,
          text: latestMessage.text || "",
          intent: latestMessage.intent || "unknown",
          status: latestMessage.status || "",
          createdAt: latestMessage.createdAt,
        }
      : null,

    messageCount: latestMessageInfo?.messageCount || 0,

    employerSummary: employerLead
      ? {
          id: employerLead._id,
          businessName: employerLead.businessName || "-",
          leadStatus: employerLead.leadStatus || "new",
          urgencyLevel: employerLead.urgencyLevel || "unknown",
          score: employerLead.score || 0,
        }
      : null,

    workerSummary: worker
      ? {
          id: worker._id,
          fullName: worker.fullName || "-",
          profileStatus: worker.profileStatus || "new",
          score: worker.score || 0,
        }
      : null,

    lastMessageAt: contact.lastMessageAt || latestMessage?.createdAt || null,
    createdAt: contact.createdAt,
  };
}

function formatMessage(message) {
  return {
    id: message._id,
    direction: message.direction || "inbound",
    channel: message.channel || "whatsapp",
    provider: message.provider || "meta_whatsapp",
    providerMessageId: message.providerMessageId || null,

    messageType: message.messageType || "text",
    text: message.text || "",
    normalizedText: message.normalizedText || "",

    intent: message.intent || "unknown",

    buttonId: message.buttonId || null,
    buttonTitle: message.buttonTitle || null,
    listId: message.listId || null,
    listTitle: message.listTitle || null,

    media: message.media || null,
    location: message.location || null,

    status: message.status || "",
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}
