// Job search step — runs after location is known.
// Calls JobMate API, filters verified+active+safe jobs,
// returns formatted reply or null if no jobs.

import { searchJobMateJobs, formatJobsForWhatsApp } from "./jobmateJobsClient.service.js";
import { filterSafeJobMatches } from "./jobSearchSafety.service.js";

/**
 * Run job search if location is set and not yet searched.
 * Returns reply message + state, or null to continue normal flow.
 */
export async function runJobSearchStep(profile, text = "") {
  // If user explicitly asks to register after seeing jobs, skip search
  // and let normal profile collection take over.
  const t = String(text || "").toLowerCase().trim();
  if (profile.jobSearchDone && /^(register|registr|1|haan|yes|haan register|profile)/i.test(t)) {
    return null;
  }

  // Skip if no location
  if (!profile.location) return null;

  // Skip if already searched (avoid repeat)
  if (profile.jobSearchDone) return null;

  // Skip if outside Lumbini (handled by shortCircuit)
  if (profile.isOutsideLumbini) return null;

  const result = await searchJobMateJobs({
    location: profile.location,
    keyword: "",
    category: "",
    type: "",
    limit: 5,
  });

  // Mark as searched so we don't search again on every message
  const updates = { jobSearchDone: true };

  const safeJobs = result.ok
    ? filterSafeJobMatches({
        jobs: result.jobs,
        requestedLocation: profile.location,
      })
    : [];

  if (safeJobs.length > 0) {
    const jobsList = formatJobsForWhatsApp({
      jobs: safeJobs,
      location: profile.location,
      keyword: profile.jobType || "",
    });

    return {
      messageToSend: `${jobsList}\n\nProfile register garna chahanu huncha bhane "register" lekhnu hola.`,
      profileUpdates: { ...updates, jobSearchResults: safeJobs },
      state: "showed_jobs",
    };
  }

  // No jobs found — offer registration
  const loc = profile.location;
  return {
    messageToSend: `${loc} ma ahile JobMate ko verified job listing bhetiyena 🙏

Tara tension nalinu. Tapai ko detail save garchu, naya kaam aayo bhane hamro team le 24-48 ghanta vitra contact garcha.

Profile register garna chahanu huncha?
1. Haan, register garchu
2. Pachi try garchu`,
    profileUpdates: { ...updates, noJobsFound: true },
    state: "asked_register",
  };
}
