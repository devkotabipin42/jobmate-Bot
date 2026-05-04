// Job search safety rules.
// This prevents wrong-location, inactive, or unverified jobs from being shown.

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

  return jobLoc === requested ||
    jobLoc.includes(requested) ||
    requested.includes(jobLoc);
}

export function filterSafeJobMatches({
  jobs = [],
  requestedLocation = "",
} = {}) {
  if (!Array.isArray(jobs)) return [];

  return jobs.filter((job) => {
    if (!isVerifiedActiveJob(job)) return false;

    return isSameLocationSafe(job.location, requestedLocation);
  });
}
