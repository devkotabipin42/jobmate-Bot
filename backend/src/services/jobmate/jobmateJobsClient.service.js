import axios from "axios";
import { env } from "../../config/env.js";
import {
  resolveLumbiniLocation,
  getLocationSearchTerms,
  normalize,
} from "./lumbiniLocation.service.js";


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
  const attempts = hasRequestedLocation
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

  for (const attempt of attempts) {
    const rawJobs = await fetchJobs(attempt);

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
    ok: true,
    count: 0,
    strategy: "no_match",
    jobs: [],
  };
}

async function fetchJobs({ keyword = "", location = "", category = "", type = "" }) {
  const url = `${env.JOBMATE_API_BASE_URL.replace(/\/$/, "")}/api/jobs`;

  try {
    const response = await axios.get(url, {
      params: {
        keyword: keyword || undefined,
        location: location || undefined,
        category: category || undefined,
        type: type || undefined,
      },
      timeout: 4000,
    });

    return Array.isArray(response.data?.jobs) ? response.data.jobs : [];
  } catch (error) {
    console.error("❌ JobMate jobs API failed:", {
      status: error?.response?.status,
      message: error?.message,
      keyword,
      location,
      category,
      type,
    });

    return [];
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
