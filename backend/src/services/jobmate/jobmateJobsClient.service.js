import axios from "axios";
import { env } from "../../config/env.js";
import {
  resolveLumbiniLocation,
  getLocationSearchTerms,
  normalize,
} from "./lumbiniLocation.service.js";


const JOBMATE_API_TIMEOUT_MS = Number(env.JOBMATE_API_TIMEOUT_MS || 5000);
const JOBMATE_FAST_SEARCH = Boolean(env.JOBMATE_FAST_SEARCH);
const JOBMATE_JOB_CACHE_TTL_MS = Number(env.JOBMATE_JOB_CACHE_TTL_MS || 5 * 60 * 1000);
const JOBMATE_JOB_CACHE = new Map();

const SUSPICIOUS_KEYWORDS = [
  "registration fee",
  "security deposit",
  "send money",
  "telegram @",
  "daily payment",
  "work permit",
  "refundable",
  "earn 50,000",
  "captcha",
  "like videos",
  "subscribe to channels",
];

export async function searchJobMateJobs({
  keyword = "",
  location = "",
  category = "",
  type = "",
  limit = 5,
}) {
  if (!env.JOBMATE_API_BASE_URL) {
    return {
      ok: false,
      reason: "JOBMATE_API_BASE_URL_NOT_CONFIGURED",
      jobs: [],
    };
  }

  const hasRequestedLocation = Boolean(String(location || "").trim());

  // If user asked for a specific location, never show jobs from other locations.
  // Wrong-location jobs destroy trust, so keep search strict by location.
  const attempts = JOBMATE_FAST_SEARCH
    ? [
        // Fast mode: fetch by location only, then apply local safety filters.
        // This avoids API keyword/category mismatch while still preventing wrong jobs.
        { keyword: "", location, category: "", type: "", label: "location_fast" },
      ]
    : hasRequestedLocation
      ? [
          { keyword, location, category, type, label: "strict" },
          { keyword: "", location, category, type, label: "location_category" },
          { keyword: "", location, category: "", type, label: "location_only" },
        ]
      : [
          { keyword, location, category, type, label: "strict" },
          { keyword, location: "", category: "", type, label: "keyword_only" },
          { keyword: "", location: "", category, type, label: "category_only" },
        ];

  let lastError = null;

  for (const attempt of attempts) {
    const fetchResult = await fetchJobs(attempt);
    const rawJobs = fetchResult.jobs || [];

    if (fetchResult.error) {
      lastError = fetchResult.error;
    }

    const safeJobs = rawJobs
      .filter((job) => job?.is_active === true)
      .filter((job) => job?.is_verified === true)
      .filter((job) => matchesRequestedLocation(job, location))
      .filter((job) => !isSuspiciousJob(job));

    if (safeJobs.length > 0) {
      const finalJobs = String(location || "").trim()
        ? safeJobs.filter((job) => matchesRequestedLocation(job, location))
        : safeJobs;

      if (finalJobs.length === 0) {
        continue;
      }

      return {
        ok: true,
        count: finalJobs.length,
        strategy: attempt.label,
        jobs: finalJobs.slice(0, limit),
      };
    }
  }

  return {
    ok: !lastError,
    reason: lastError ? "JOBMATE_API_FAILED_OR_TIMEOUT" : "NO_SAFE_MATCH",
    count: 0,
    strategy: lastError ? "api_failed_or_timeout" : "no_match",
    jobs: [],
  };
}

function makeJobCacheKey({ keyword = "", location = "", category = "", type = "" } = {}) {
  return JSON.stringify({
    keyword: String(keyword || "").toLowerCase().trim(),
    location: String(location || "").toLowerCase().trim(),
    category: String(category || "").toLowerCase().trim(),
    type: String(type || "").toLowerCase().trim(),
  });
}

function getCachedJobs(key) {
  const cached = JOBMATE_JOB_CACHE.get(key);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    JOBMATE_JOB_CACHE.delete(key);
    return null;
  }

  return cached.jobs || [];
}

function setCachedJobs(key, jobs = []) {
  JOBMATE_JOB_CACHE.set(key, {
    jobs,
    expiresAt: Date.now() + JOBMATE_JOB_CACHE_TTL_MS,
  });
}

async function fetchJobs({ keyword = "", location = "", category = "", type = "" }) {
  const url = `${env.JOBMATE_API_BASE_URL.replace(/\/$/, "")}/api/jobs`;
  const cacheKey = makeJobCacheKey({ keyword, location, category, type });

  const cachedBeforeRequest = getCachedJobs(cacheKey);

  try {
    const response = await axios.get(url, {
      params: {
        keyword: keyword || undefined,
        location: location || undefined,
        category: category || undefined,
        type: type || undefined,
      },
      timeout: JOBMATE_API_TIMEOUT_MS,
    });

    const jobs = Array.isArray(response.data?.jobs) ? response.data.jobs : [];
    setCachedJobs(cacheKey, jobs);

    return {
      jobs,
      error: null,
      cached: false,
    };
  } catch (error) {
    if (cachedBeforeRequest) {
      console.warn("⚠️ JobMate jobs API failed, using cached jobs:", {
        message: error?.message,
        keyword,
        location,
        category,
        type,
      });

      return {
        jobs: cachedBeforeRequest,
        error: null,
        cached: true,
      };
    }

    console.error("❌ JobMate jobs API failed:", {
      status: error?.response?.status,
      message: error?.message,
      keyword,
      location,
      category,
      type,
    });

    return {
      jobs: [],
      error: {
        status: error?.response?.status,
        message: error?.message,
      },
      cached: false,
    };
  }
}

export function parseJobSearchQuery(text = "") {
  const normalized = String(text).toLowerCase().trim();

  const location = detectLocation(normalized);
  const category = detectCategory(normalized);
  const keyword = detectKeyword(normalized);

  return {
    keyword,
    location,
    category,
  };
}

export function formatJobsForWhatsApp({ jobs = [], location = "", keyword = "" }) {
  if (!jobs.length) {
    return `Ahile ${location || "yo area"} ma ${keyword || "tapai le khojeko"} job भेटिएन।

Tara tapai ko details JobMate ma save garna sakchhaun.
Naya suitable job aayo bhane hamro team le contact garnecha. 🙏

Profile register garna "job chaiyo" lekhnu hola.`;
  }

  const lines = jobs.map((job, index) => {
    const salary =
      job.salary_min && job.salary_max
        ? `NPR ${Number(job.salary_min).toLocaleString()}–${Number(job.salary_max).toLocaleString()}`
        : "Salary not mentioned";

    const company = job.employer?.company_name || "Verified Employer";

    return `${index + 1}. ${job.title}
🏢 ${company}
📍 ${job.location}
💰 ${salary}
🕒 ${job.type || "-"}`;
  });

  return `JobMate मा ${jobs.length} ota verified job भेटियो:

${lines.join("\n\n")}

Apply/interest ko lagi job number reply garnuhos, e.g. 1`;
}

function matchesRequestedLocation(job = {}, requestedLocation = "") {
  const requested = String(requestedLocation || "").trim();

  if (!requested) return true;

  const resolved = resolveLumbiniLocation(requested);
  const jobText = normalize(
    [
      job.location,
      job.area,
      job.district,
      job.city,
      job.address,
      job.province,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!jobText) return false;

  if (resolved?.scope === "province") {
    return jobText.includes("lumbini");
  }

  const allowedTerms = getLocationSearchTerms(requested);

  return allowedTerms.some((term) => {
    if (!term) return false;
    return jobText.includes(term);
  });
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s,.-]+/g, " ")
    .trim();
}


function detectLocation(text) {
  if (includesAny(text, ["butwal", "बुटवल"])) return "Butwal";
  if (includesAny(text, ["bardaghat", "bhardaghat", "bardghat", "bardaght", "bardghaat", "bhardaght", "बर्दघाट"])) return "Bardaghat";
  if (includesAny(text, ["bhairahawa", "bhairawa", "siddharthanagar", "भैरहवा"])) return "Bhairahawa";
  if (includesAny(text, ["parasi", "ramgram", "परासी"])) return "Parasi";
  if (includesAny(text, ["sunwal", "सुनवल"])) return "Sunwal";
  if (includesAny(text, ["tilottama", "manigram", "तिलोत्तमा"])) return "Tilottama";
  if (includesAny(text, ["devdaha", "देवदह"])) return "Devdaha";
  if (includesAny(text, ["taulihawa", "तौलिहवा"])) return "Taulihawa";
  if (includesAny(text, ["nepalgunj", "नेपालगञ्ज"])) return "Nepalgunj";
  if (includesAny(text, ["ghorahi", "घोराही"])) return "Ghorahi";
  if (includesAny(text, ["tulsipur", "तुलसीपुर"])) return "Tulsipur";
  if (includesAny(text, ["tansen", "तानसेन"])) return "Tansen";
  if (includesAny(text, ["remote", "online", "work from home"])) return "Remote";
  return "";
}

function detectCategory(text) {
  if (includesAny(text, ["it", "tech", "developer", "frontend", "backend", "react"])) return "IT/Tech";
  if (includesAny(text, ["hotel", "restaurant", "waiter", "kitchen"])) return "Hospitality";
  if (includesAny(text, ["bank", "finance"])) return "Finance/Banking";
  if (includesAny(text, ["teacher", "school", "education"])) return "Education";
  return "";
}

function detectKeyword(text) {
  const removeWords = [
    "ma",
    "maa",
    "job",
    "cha",
    "xa",
    "chha",
    "chahiyo",
    "khojna",
    "khojdai",
    "vacancy",
    "काम",
    "जागिर",
  ];

  let cleaned = text;
  for (const word of removeWords) {
    cleaned = cleaned.replaceAll(word, " ");
  }

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (includesAny(text, ["hotel", "restaurant", "waiter"])) return "hotel";
  if (includesAny(text, ["driver"])) return "driver";
  if (includesAny(text, ["security", "guard"])) return "security";
  if (includesAny(text, ["frontend", "developer", "react"])) return "frontend";
  if (includesAny(text, ["it", "tech"])) return "IT";

  return cleaned;
}

function isSuspiciousJob(job) {
  const text = `${job.title || ""} ${job.description || ""}`.toLowerCase();

  return SUSPICIOUS_KEYWORDS.some((keyword) => text.includes(keyword));
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}
