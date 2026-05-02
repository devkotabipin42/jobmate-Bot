import { WorkerProfile } from "../../models/WorkerProfile.model.js";

export async function getWorkers({
  status,
  availability,
  district,
  search,
  page = 1,
  limit = 20,
}) {
  const query = {};

  if (status) {
    query.profileStatus = status;
  }

  if (availability) {
    query.availability = availability;
  }

  if (district) {
    query["location.district"] = district;
  }

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { jobPreferences: { $regex: search, $options: "i" } },
      { "location.area": { $regex: search, $options: "i" } },
      { "location.district": { $regex: search, $options: "i" } },
    ];
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (safePage - 1) * safeLimit;

  const [items, total] = await Promise.all([
    WorkerProfile.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    WorkerProfile.countDocuments(query),
  ]);

  return {
    items: items.map(formatWorker),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getWorkerById(id) {
  const worker = await WorkerProfile.findById(id).lean();
  if (!worker) return null;
  return formatWorker(worker);
}

export async function updateWorkerStatus(id, status) {
  const allowedStatuses = [
    "new",
    "incomplete",
    "complete",
    "qualified",
    "verified",
    "matched",
    "placed",
    "inactive",
    "rejected",
  ];

  if (!allowedStatuses.includes(status)) {
    const error = new Error("Invalid worker profile status");
    error.statusCode = 400;
    throw error;
  }

  const worker = await WorkerProfile.findByIdAndUpdate(
    id,
    {
      $set: {
        profileStatus: status,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  ).lean();

  if (!worker) return null;

  return formatWorker(worker);
}

function formatWorker(worker) {
  return {
    id: worker._id,
    contactId: worker.contactId || null,

    fullName: worker.fullName || "-",
    phone: worker.phone || "-",
    whatsapp: worker.whatsapp || worker.phone || "-",

    jobPreferences: worker.jobPreferences || [],

    location: {
      area: worker.location?.area || "-",
      district: worker.location?.district || "-",
      province: worker.location?.province || "-",
      country: worker.location?.country || "Nepal",
    },

    availability: worker.availability || "unknown",
    documentStatus: worker.documentStatus || "unknown",
    profileStatus: worker.profileStatus || "new",

    score: worker.score || 0,

    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
  };
}
