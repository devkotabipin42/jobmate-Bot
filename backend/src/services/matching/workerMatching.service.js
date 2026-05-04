import { EmployerLead } from "../../models/EmployerLead.model.js";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";

function normalize(value = "") {
  return String(value || "").toLowerCase().trim();
}

function employerRoleToWorkerPreferences(role = "") {
  const value = normalize(role);

  if (/driver|transport|delivery/.test(value)) return ["driver_transport"];
  if (/security|guard/.test(value)) return ["security_guard"];
  if (/kitchen|cook|waiter|hotel|restaurant/.test(value)) return ["hotel_restaurant"];
  if (/frontend|backend|developer|it|software|web/.test(value)) return ["it_web"];
  if (/shop|seller|sales|marketing|promoter|retail/.test(value)) return ["shop_retail"];
  if (/helper|labor|labour|construction/.test(value)) return ["construction_labor", "other"];

  return [value || "other"];
}

function scoreWorkerForNeed(worker = {}, need = {}, lead = {}) {
  let score = 0;
  const reasons = [];

  const workerDistrict = normalize(worker.location?.district);
  const leadDistrict = normalize(lead.location?.district);
  const workerArea = normalize(worker.location?.area);
  const leadArea = normalize(lead.location?.area);

  if (leadArea && workerArea && workerArea === leadArea) {
    score += 35;
    reasons.push("same_area");
  } else if (leadDistrict && workerDistrict && workerDistrict === leadDistrict) {
    score += 25;
    reasons.push("same_district");
  }

  const wantedPrefs = employerRoleToWorkerPreferences(need.role);
  const workerPrefs = (worker.jobPreferences || []).map((pref) => normalize(pref));

  const prefMatch = wantedPrefs.some((pref) => workerPrefs.includes(normalize(pref)));

  if (prefMatch) {
    score += 35;
    reasons.push("role_match");
  }

  if (worker.availability === "immediate") {
    score += 15;
    reasons.push("immediate_available");
  } else if (worker.availability === "within_1_week") {
    score += 10;
    reasons.push("available_soon");
  } else if (worker.availability === "within_2_weeks") {
    score += 7;
    reasons.push("available_within_2_weeks");
  }

  if (worker.documentStatus === "ready") {
    score += 10;
    reasons.push("documents_ready");
  }

  if (worker.profileStatus === "verified") {
    score += 10;
    reasons.push("verified_profile");
  } else if (worker.profileStatus === "complete") {
    score += 5;
    reasons.push("complete_profile");
  }

  score += Math.min(Number(worker.score || 0), 100) * 0.05;

  return {
    score: Math.round(score),
    reasons,
    wantedPreferences: wantedPrefs,
  };
}

export async function findMatchingWorkersForEmployerLead({
  employerLeadId,
  limit = 20,
} = {}) {
  if (!employerLeadId) {
    throw new Error("Missing employerLeadId");
  }

  const lead = await EmployerLead.findById(employerLeadId).lean();

  if (!lead) {
    return {
      lead: null,
      matches: [],
    };
  }

  const needs = Array.isArray(lead.hiringNeeds) ? lead.hiringNeeds : [];
  const district = lead.location?.district || "";

  const query = {
    profileStatus: { $in: ["complete", "verified"] },
  };

  if (district) {
    query["location.district"] = district;
  }

  const workers = await WorkerProfile.find(query)
    .sort({ score: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const matches = [];

  for (const worker of workers) {
    for (const need of needs) {
      const match = scoreWorkerForNeed(worker, need, lead);

      if (match.score < 35) continue;

      matches.push({
        workerId: worker._id,
        workerName: worker.fullName || "Worker",
        phone: worker.phone,
        location: worker.location,
        jobPreferences: worker.jobPreferences || [],
        availability: worker.availability,
        documentStatus: worker.documentStatus,
        profileStatus: worker.profileStatus,
        workerScore: worker.score || 0,
        matchedNeed: {
          role: need.role,
          quantity: need.quantity,
        },
        matchScore: match.score,
        matchReasons: match.reasons,
        wantedPreferences: match.wantedPreferences,
      });
    }
  }

  matches.sort((a, b) => b.matchScore - a.matchScore);

  return {
    lead: {
      id: lead._id,
      businessName: lead.businessName,
      phone: lead.phone,
      location: lead.location,
      hiringNeeds: lead.hiringNeeds,
      urgencyLevel: lead.urgencyLevel,
      leadStatus: lead.leadStatus,
      verificationStatus: lead.verificationStatus,
    },
    matches: matches.slice(0, Number(limit || 20)),
  };
}
