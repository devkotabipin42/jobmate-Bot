import { BusinessProfile } from "../../models/BusinessProfile.model.js";

export async function getBusinessProfile() {
  let profile = await BusinessProfile.findOne({ singletonKey: "default" }).lean();

  if (!profile) {
    profile = await BusinessProfile.create({
      singletonKey: "default",
      businessName: "JobMate",
      businessType: "jobmate",
      description: "JobMate hiring and business automation platform.",
      location: {
        province: "Lumbini",
        country: "Nepal",
      },
      services: [],
      faqs: [],
    });

    profile = profile.toObject();
  }

  return formatProfile(profile);
}

export async function updateBusinessProfile(payload = {}) {
  const update = {
    businessName: payload.businessName,
    businessType: payload.businessType,
    description: payload.description,
    contact: payload.contact,
    location: payload.location,
    openingHours: payload.openingHours,
    languageStyle: payload.languageStyle,
    botTone: payload.botTone,
    safetyMode: payload.safetyMode,
    isActive: payload.isActive,
  };

  Object.keys(update).forEach((key) => {
    if (update[key] === undefined) delete update[key];
  });

  const profile = await BusinessProfile.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $set: update,
      $setOnInsert: { singletonKey: "default" },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  ).lean();

  return formatProfile(profile);
}

export async function addBusinessService(payload = {}) {
  if (!payload.name) {
    const error = new Error("Service name is required");
    error.statusCode = 400;
    throw error;
  }

  const service = {
    name: payload.name,
    description: payload.description || "",
    priceFrom: payload.priceFrom ?? null,
    priceTo: payload.priceTo ?? null,
    currency: payload.currency || "NPR",
    isActive: payload.isActive ?? true,
  };

  const profile = await BusinessProfile.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $push: { services: service },
      $setOnInsert: { singletonKey: "default" },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  ).lean();

  return formatProfile(profile);
}

export async function deleteBusinessService(serviceId) {
  const profile = await BusinessProfile.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $pull: { services: { _id: serviceId } },
    },
    { returnDocument: "after" }
  ).lean();

  return formatProfile(profile);
}

export async function addBusinessFAQ(payload = {}) {
  if (!payload.question || !payload.answer) {
    const error = new Error("FAQ question and answer are required");
    error.statusCode = 400;
    throw error;
  }

  const faq = {
    question: payload.question,
    answer: payload.answer,
    isActive: payload.isActive ?? true,
  };

  const profile = await BusinessProfile.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $push: { faqs: faq },
      $setOnInsert: { singletonKey: "default" },
    },
    {
      upsert: true,
      returnDocument: "after",
    }
  ).lean();

  return formatProfile(profile);
}

export async function deleteBusinessFAQ(faqId) {
  const profile = await BusinessProfile.findOneAndUpdate(
    { singletonKey: "default" },
    {
      $pull: { faqs: { _id: faqId } },
    },
    { returnDocument: "after" }
  ).lean();

  return formatProfile(profile);
}

function formatProfile(profile) {
  return {
    id: profile._id,
    businessName: profile.businessName || "",
    businessType: profile.businessType || "",
    description: profile.description || "",
    contact: profile.contact || {},
    location: profile.location || {},
    openingHours: profile.openingHours || "",
    languageStyle: profile.languageStyle || "roman_nepali",
    botTone: profile.botTone || "polite_friendly",
    safetyMode: profile.safetyMode || {},
    services: profile.services || [],
    faqs: profile.faqs || [],
    isActive: profile.isActive,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
