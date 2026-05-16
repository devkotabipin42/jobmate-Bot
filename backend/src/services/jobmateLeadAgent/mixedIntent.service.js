import { normalizeLeadAgentText } from "./intent.service.js";

export function detectMixedLeadIntent(text = "") {
  const value = normalizeLeadAgentText(text);
  if (!value) return null;
  if (isHelpOrConfusionChoice(value)) return null;
  if (isPaidEmployerCorrectionDemand(value)) return null;

  const worker = findWorkerIntentIndex(value);
  const employer = findEmployerIntentIndex(value);
  const hasWorker = worker.index >= 0;
  const hasEmployer = employer.index >= 0;

  if (!hasWorker || !hasEmployer) return null;

  if (hasSahakariUmbrellaContext(value)) {
    return {
      type: "sahakari_umbrella",
      originalMessage: text,
    };
  }

  if (hasClearWorkerFirstThenLaterEmployer(value, worker.index, employer.index)) {
    return {
      type: "worker_primary",
      originalMessage: text,
      primaryText: trimPrimarySegment(text),
    };
  }

  if (hasClearEmployerFirstThenLaterWorker(value, worker.index, employer.index)) {
    return {
      type: "employer_primary",
      originalMessage: text,
      primaryText: trimPrimarySegment(text),
    };
  }

  return {
    type: "clarify",
    originalMessage: text,
  };
}

export function isMixedIntentClarificationState(state = {}) {
  return state?.status === "mixed_intent_clarification";
}

export function parseMixedIntentChoice(text = "") {
  const value = normalizeLeadAgentText(text);

  if (/^(1|one)$/i.test(value) || /\b(job registration|job khojna|worker registration)\b/i.test(value)) {
    return "worker";
  }

  if (/^(2|two)$/i.test(value) || /\b(staff demand|staff khojna|staff request|employer|staff)\b/i.test(value)) {
    return "employer";
  }

  return "";
}

export function buildMixedIntentClarificationReply() {
  return [
    "Hajur, duita kura aayo: job khojna ra staff khojna.",
    "Pahila kun handle garum?",
    "1. Job khojna",
    "2. Staff khojna",
    "Daya garera 1 ya 2 type garnus.",
  ].join("\n");
}

export function buildPrimaryAcknowledgement(type = "") {
  if (type === "worker_primary") {
    return "Pahila job registration garau, pachi staff demand pani register garna milcha.";
  }

  if (type === "employer_primary") {
    return "Pahila staff demand register garau, pachi job registration pani garna milcha.";
  }

  return "";
}

function findWorkerIntentIndex(value = "") {
  return findFirstIndex(value, [
    /\b(job|kaam|kam|work|jagir)\s+(chahiyo|chaiyo|khojdai|khojne|khojna|pauxa|painxa|paincha|pauna)\b/i,
    /\b(job|kaam|kam|work|jagir)\b.*\b(khojdai|khojne|khojna|chahiyo|chaiyo|painxa|paincha|pauna)\b/i,
    /\b(jobseeker|job seeker|job khojne|kaam khojne|worker registration)\b/i,
    /\b(bhai|cousin|member|members)\b.*\b(job|kaam|kam|work|jagir)\b/i,
  ]);
}

function findEmployerIntentIndex(value = "") {
  return findFirstIndex(value, [
    /\b(staff|helper|waiter|cook|driver|cleaner|guard|security|worker|manche|manxe)\s+(chahiyo|chaiyo|chainxa|chaincha|chahincha|chahinchha)\b/i,
    /\b(staff|helper|waiter|cook|driver|cleaner|guard|security|worker|manche|manxe)\b.*\b(chahiyo|chaiyo|chainxa|chaincha|chahincha|chahinchha)\b/i,
    /\b(company|pasal|shop|business|owner|restaurant|hotel|local business)\b.*\b(staff|helper|waiter|worker|manche|manxe|chahiyo|chaiyo|chainxa|chahincha)\b/i,
    /\b\d{1,3}\s*(?:jana\s*)?(waiter|helper|cook|driver|cleaner|staff|worker)\b/i,
    /\b(employer|staff demand|staff request)\b/i,
  ]);
}

function isHelpOrConfusionChoice(value = "") {
  return /\b(employer|jobseeker|job seeker)\b.*\bconfuse\b|\bconfuse\b.*\b(employer|jobseeker|job seeker)\b/i.test(value);
}

function isPaidEmployerCorrectionDemand(value = "") {
  return /\bpaid\s+job\s+ho\b/i.test(value) &&
    /\b(staff|helper|waiter|cook|driver|cleaner|guard|security|worker|manche|manxe)\b.*\b(chahiyo|chaiyo|chainxa|chaincha|chahincha|chahinchha)\b/i.test(value);
}

function hasSahakariUmbrellaContext(value = "") {
  if (!/\b(sahakari|cooperative|co op|coop)\b/i.test(value)) return false;

  return /\b(hamro\s+sahakari|sahakari\s+ma|sahakari\s+ko\s+manager|ma\s+sahakari\s+ko\s+manager|members?\b|business owner|local business)\b/i.test(value);
}

function hasClearWorkerFirstThenLaterEmployer(value = "", workerIndex = -1, employerIndex = -1) {
  return workerIndex >= 0 &&
    employerIndex > workerIndex &&
    /\bpachi\b/i.test(value) &&
    /\b(job|kaam|kam)\b.*\b(pachi)\b.*\b(shop|pasal|staff|helper|worker)\b/i.test(value);
}

function hasClearEmployerFirstThenLaterWorker(value = "", workerIndex = -1, employerIndex = -1) {
  return employerIndex >= 0 &&
    workerIndex > employerIndex &&
    /\bmalai\s+staff\s+chahiyo\b.*\b(job|kaam|kam)\b/i.test(value);
}

function trimPrimarySegment(text = "") {
  const [first] = String(text || "").split(/\b(?:but|pachi|tara)\b/i);
  return (first || text).trim();
}

function findFirstIndex(value = "", patterns = []) {
  let best = -1;

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match || match.index === undefined) continue;
    if (best === -1 || match.index < best) best = match.index;
  }

  return { index: best };
}
