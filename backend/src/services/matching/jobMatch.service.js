import { EmployerLead } from "../../models/EmployerLead.model.js";
import { WorkerProfile } from "../../models/WorkerProfile.model.js";
import { JobApplication } from "../../models/JobApplication.model.js";
import { JobMatch } from "../../models/JobMatch.model.js";
import { createNotification } from "../notifications/notification.service.js";

function formatRoleLabel(role = "") {
  const labels = {
    driver: "Driver",
    driver_transport: "Driver / Transport",
    frontend_developer: "Frontend Developer",
    it_web: "IT / Web",
    marketing_staff: "Marketing Staff",
    kitchen_staff: "Kitchen Staff",
    shopkeeper: "Shopkeeper",
    security_guard: "Security Guard",
    waiter: "Waiter",
    helper_staff: "Helper",
  };

  return labels[role] || String(role || "Staff").replace(/_/g, " ");
}

function computeDefaultMatchScore({ worker = {}, employerLead = {}, role = "" } = {}) {
  let score = 0;
  const reasons = [];

  const workerDistrict = String(worker.location?.district || "").toLowerCase();
  const leadDistrict = String(employerLead.location?.district || "").toLowerCase();

  const workerArea = String(worker.location?.area || "").toLowerCase();
  const leadArea = String(employerLead.location?.area || "").toLowerCase();

  if (workerArea && leadArea && workerArea === leadArea) {
    score += 35;
    reasons.push("same_area");
  } else if (workerDistrict && leadDistrict && workerDistrict === leadDistrict) {
    score += 25;
    reasons.push("same_district");
  }

  const prefs = (worker.jobPreferences || []).map((item) => String(item).toLowerCase());
  const roleValue = String(role || "").toLowerCase();

  if (
    prefs.includes(roleValue) ||
    (roleValue.includes("driver") && prefs.includes("driver_transport")) ||
    (roleValue.includes("frontend") && prefs.includes("it_web")) ||
    (roleValue.includes("marketing") && prefs.includes("shop_retail"))
  ) {
    score += 35;
    reasons.push("role_match");
  }

  if (worker.availability === "immediate") {
    score += 15;
    reasons.push("immediate_available");
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

  return {
    score: Math.min(Math.round(score), 100),
    reasons,
  };
}

export async function createJobMatch({
  employerLeadId,
  workerId,
  jobApplicationId = null,
  role = "",
  matchScore = null,
  matchReasons = [],
  notes = "",
  source = "dashboard",
} = {}) {
  if (!employerLeadId || !workerId) {
    throw new Error("employerLeadId and workerId are required");
  }

  const [employerLead, worker, jobApplication] = await Promise.all([
    EmployerLead.findById(employerLeadId).lean(),
    WorkerProfile.findById(workerId).lean(),
    jobApplicationId ? JobApplication.findById(jobApplicationId).lean() : null,
  ]);

  if (!employerLead) {
    return {
      ok: false,
      statusCode: 404,
      message: "Employer lead not found",
    };
  }

  if (!worker) {
    return {
      ok: false,
      statusCode: 404,
      message: "Worker profile not found",
    };
  }

  const selectedRole =
    role ||
    employerLead.hiringNeeds?.[0]?.role ||
    worker.jobPreferences?.[0] ||
    "";

  const computed =
    matchScore === null
      ? computeDefaultMatchScore({ worker, employerLead, role: selectedRole })
      : { score: Number(matchScore || 0), reasons: matchReasons || [] };

  const match = await JobMatch.findOneAndUpdate(
    {
      employerLeadId,
      workerId,
      role: selectedRole,
    },
    {
      $setOnInsert: {
        employerLeadId,
        workerId,
        jobApplicationId: jobApplication?._id || jobApplicationId || null,
        matchedAt: new Date(),
      },
      $set: {
        employerPhone: employerLead.phone || "",
        workerPhone: worker.phone || "",
        businessName: employerLead.businessName || "",
        workerName: worker.fullName || "Worker",
        role: selectedRole,
        roleLabel: formatRoleLabel(selectedRole),
        location: employerLead.location || {},
        matchScore: computed.score,
        matchReasons: computed.reasons,
        source,
        notes,
        metadata: {
          employerLead: {
            businessName: employerLead.businessName,
            location: employerLead.location,
            hiringNeeds: employerLead.hiringNeeds,
          },
          worker: {
            jobPreferences: worker.jobPreferences,
            availability: worker.availability,
            documentStatus: worker.documentStatus,
            profileStatus: worker.profileStatus,
          },
          jobApplication: jobApplication || null,
        },
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
      runValidators: false,
    }
  );

  await createNotification({
    type: "system_alert",
    title: `Worker matched: ${match.workerPhone || "Worker"}`,
    message: `${match.workerPhone || "Worker"} matched for ${match.businessName || "employer"} (${match.roleLabel}).`,
    priority: match.matchScore >= 70 ? "high" : "medium",
    entityType: "System",
    entityId: match._id,
    phone: match.workerPhone,
    metadata: {
      matchId: match._id,
      employerLeadId,
      workerId,
      role: match.role,
      matchScore: match.matchScore,
    },
  });

  return {
    ok: true,
    match,
  };
}

export async function listJobMatches({
  status = "",
  employerLeadId = "",
  workerId = "",
  limit = 50,
} = {}) {
  const query = {};

  if (status) query.status = status;
  if (employerLeadId) query.employerLeadId = employerLeadId;
  if (workerId) query.workerId = workerId;

  return JobMatch.find(query)
    .sort({ updatedAt: -1 })
    .limit(Math.min(Number(limit || 50), 200))
    .lean();
}

export async function updateJobMatchStatus({
  id,
  status,
  notes = "",
} = {}) {
  if (!id || !status) {
    throw new Error("id and status are required");
  }

  const update = {
    $set: {
      status,
      lastStatusAt: new Date(),
      ...(typeof notes === "string" ? { notes } : {}),
      ...(status === "placed" ? { placedAt: new Date() } : {}),
    },
  };

  const match = await JobMatch.findByIdAndUpdate(id, update, {
    returnDocument: "after",
    runValidators: false,
  }).lean();

  if (match && status === "placed") {
    await createNotification({
      type: "system_alert",
      title: `Placement completed: ${match.workerPhone || "Worker"}`,
      message: `${match.workerPhone || "Worker"} placed for ${match.businessName || "employer"} as ${match.roleLabel || match.role || "staff"}.`,
      priority: "urgent",
      entityType: "System",
      entityId: match._id,
      phone: match.workerPhone,
      metadata: {
        matchId: match._id,
        employerLeadId: match.employerLeadId,
        workerId: match.workerId,
        role: match.role,
        businessName: match.businessName,
        status: match.status,
      },
    });
  }

  return match;
}
