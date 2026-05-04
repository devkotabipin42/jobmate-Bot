// Job search safety rules.
// Prevents wrong-location, inactive, unverified, or wrong-category jobs from being shown.

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVerifiedActiveJob(job = {}) {
  if (!job) return false;
  if (job.is_active === false) return false;
  if (job.is_verified === false) return false;
  return true;
}

export function isSameLocationSafe(jobLocation = "", requestedLocation = "") {
  const jobLoc = normalizeText(jobLocation);
  const requested = normalizeText(requestedLocation);

  if (!jobLoc || !requested) return false;

  return (
    jobLoc === requested ||
    jobLoc.includes(requested) ||
    requested.includes(jobLoc)
  );
}

function getCategoryTerms(jobType = "") {
  const value = normalizeText(jobType);

  if (!value || /other|jun sukai|any/.test(value)) return [];

  const groups = {
    "it tech": ["it", "tech", "frontend", "backend", "developer", "software", "computer", "web", "react"],
    "driver transport": ["driver", "transport", "delivery", "truck", "bus", "bike", "gadi", "vehicle"],
    hospitality: ["hotel", "restaurant", "waiter", "kitchen", "cook", "hospitality", "cafe"],
    "shop retail": ["shop", "retail", "sales", "seller", "counter", "pasal", "store"],
    security: ["security", "guard", "watchman"],
    "construction labor": ["construction", "labor", "labour", "helper", "mistri", "worker"],
    "farm agriculture": ["farm", "agriculture", "krishi", "kheti"],
  };

  return groups[value] || value.split(/\s+/).filter(Boolean);
}

export function isSameCategorySafe(job = {}, requestedJobType = "") {
  const terms = getCategoryTerms(requestedJobType);

  if (!terms.length) return true;

  const haystack = normalizeText([
    job.title,
    job.category,
    job.type,
    job.description,
  ].filter(Boolean).join(" "));

  if (!haystack) return false;

  return terms.some((term) => haystack.includes(normalizeText(term)));
}

export function filterSafeJobMatches({
  jobs = [],
  requestedLocation = "",
  requestedJobType = "",
} = {}) {
  if (!Array.isArray(jobs)) return [];

  return jobs.filter((job) => {
    if (!isVerifiedActiveJob(job)) return false;
    if (!isSameLocationSafe(job.location, requestedLocation)) return false;
    if (!isSameCategorySafe(job, requestedJobType)) return false;
    return true;
  });
}
