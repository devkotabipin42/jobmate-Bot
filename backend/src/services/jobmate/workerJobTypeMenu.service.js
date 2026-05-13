export const WORKER_JOB_TYPE_OPTIONS = [
  { value: "1", label: "Driver / Transport" },
  { value: "2", label: "Security Guard" },
  { value: "3", label: "Hotel / Restaurant" },
  { value: "4", label: "Construction / Labor" },
  { value: "5", label: "Farm / Agriculture" },
  { value: "6", label: "Shop / Retail" },
  { value: "7", label: "Sales / Marketing" },
  { value: "8", label: "Other" },
];

export const WORKER_JOB_TYPE_MAP = Object.fromEntries(
  WORKER_JOB_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

export const CANONICAL_WORKER_JOB_TYPE_MENU = WORKER_JOB_TYPE_OPTIONS
  .map((option) => `${option.value}. ${option.value === "8" ? "Aru real kaam" : option.label}`)
  .join("\n");

export function parseCanonicalWorkerJobType(text = "") {
  const trimmed = String(text || "").trim();
  if (WORKER_JOB_TYPE_MAP[trimmed]) return WORKER_JOB_TYPE_MAP[trimmed];

  const value = normalizeWorkerJobTypeText(trimmed);
  if (!value) return null;

  if (/(driver|gadi|truck|bus|bike|delivery)/i.test(value)) {
    return "Driver / Transport";
  }

  if (/(security|guard|watchman)/i.test(value)) {
    return "Security Guard";
  }

  if (/(hotel|restaurant|waiter|kitchen|cook|cafe)/i.test(value)) {
    return "Hotel / Restaurant";
  }

  if (/(farm|agriculture|kheti|krishi)/i.test(value)) {
    return "Farm / Agriculture";
  }

  if (/(sales|marketing|marketting|field marketing|promotion|promoter|parchar)/i.test(value)) {
    return "Sales / Marketing";
  }

  if (/(shop|retail|pasal|counter|shop helper)/i.test(value)) {
    return "Shop / Retail";
  }

  if (/(construction|labor|labour|helper|mistri|plumber|electrician|factory)/i.test(value)) {
    return "Construction / Labor";
  }

  if (/(jun sukai|junsukai|any|other|aru|jasto bhaye pani)/i.test(value)) {
    return "Other";
  }

  return null;
}

function normalizeWorkerJobTypeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
