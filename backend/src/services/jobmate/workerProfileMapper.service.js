// Worker profile mapper for JobMate jobseeker flow.
// Converts Aarati conversation profile into WorkerProfile schema-compatible values.

export function mapJobTypeToPreference(jobType = "") {
  const value = String(jobType || "").toLowerCase();

  if (/driver|transport|delivery|gadi|truck|bus/i.test(value)) return "driver_transport";
  if (/security|guard/i.test(value)) return "security_guard";
  if (/hotel|restaurant|hospitality|waiter|kitchen|cook/i.test(value)) return "hotel_restaurant";
  if (/construction|labor|labour|helper|mistri/i.test(value)) return "construction_labor";
  if (/farm|agriculture|krishi|kheti/i.test(value)) return "farm_agriculture";
  if (/shop|retail|sales|pasal|counter/i.test(value)) return "shop_retail";
  if (/frontend|backend|developer|it|software|web/i.test(value)) return "it_web";
  if (/other|aru/i.test(value)) return "other";

  return value || "other";
}

export function mapAvailabilityToWorkerEnum(availability = "") {
  const value = String(availability || "").toLowerCase().trim();

  if (/immediate|this_week|yo hapta|ahile|turunta|ready/i.test(value)) return "immediate";
  if (/within_1_week|1 week|ek hapta/i.test(value)) return "within_1_week";
  if (/within_2_weeks|2 week|1-2|dui hapta/i.test(value)) return "within_2_weeks";
  if (/within_1_month|month|mahina/i.test(value)) return "within_1_month";
  if (/not_decided|not decided|pachi|later|unknown/i.test(value)) return "not_decided";

  // New conversation engine collects work-style values here.
  // Only full-time implies immediate availability.
  // Part-time / shift / flexible are preferences, but WorkerProfile
  // availability enum does not support them yet, so do not mark them immediate.
  if (/full-time|full_time/i.test(value)) return "immediate";
  if (/part-time|part_time|shift|any|flexible/i.test(value)) return "not_decided";

  return "unknown";
}

export function mapDocumentsToWorkerEnum(documents = "") {
  const value = String(documents || "").toLowerCase().trim();

  if (/ready|yes|cha|chha|license|citizenship|cv|document.*cha/i.test(value)) return "ready";
  if (/partial|kehi|available_later|later|pachi/i.test(value)) return "available_later";
  if (/privacy_concern|privacy|trust|leak|safe|secure/i.test(value)) return "not_available";
  if (/no|chaina|chhaina|not_available|छैन/i.test(value)) return "not_available";

  return "unknown";
}

export function buildWorkerProfileUpdateFromAaratiProfile({
  contact,
  profile = {},
} = {}) {
  const phone = contact?.phone || contact?.phoneNumber || contact?.from || "";

  const jobPreference = mapJobTypeToPreference(profile.jobType);
  const availability = mapAvailabilityToWorkerEnum(profile.availability);
  const documentStatus = mapDocumentsToWorkerEnum(profile.documents || profile.documentStatus);

  const fullName =
    profile.fullName ||
    (/recruiter|admin|business|unknown/i.test(String(contact?.displayName || ""))
      ? ""
      : String(contact?.displayName || "").trim());

  return {
    filter: {
      contactId: contact._id,
    },
    update: {
      $set: {
        contactId: contact._id,
        phone,
        fullName,
        "location.area": profile.location || "",
        "location.district": profile.district || "",
        "location.province": profile.province || "Lumbini",
        "location.country": "Nepal",
        availability,
        documentStatus,
        profileStatus: "complete",
        source: "whatsapp",
        lastQualifiedAt: new Date(),
        metadata: {
          aaratiRawProfile: profile,
          rawAvailability: profile.availability || "",
          rawDocuments: profile.documents || "",
          jobSearchResults: profile.jobSearchResults || [],
          selectedJob: profile.selectedJob || null,
          selectedJobId: profile.selectedJobId || "",
          selectedJobTitle: profile.selectedJobTitle || "",
          selectedCompanyName: profile.selectedCompanyName || "",
          isApplyingToSelectedJob: Boolean(profile.isApplyingToSelectedJob),
          noJobsFound: Boolean(profile.noJobsFound),
        },
      },
      $addToSet: {
        jobPreferences: jobPreference,
      },
      $inc: {
        score: documentStatus === "ready" ? 20 : 12,
      },
    },
    options: {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: false,
    },
  };
}
