function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuantity(text = "") {
  const match = String(text || "").match(/\b(\d{1,3})\s*(?:jana|ota|wota|staff|worker|manxe|manche|जना)?\b/i);
  return match ? Number(match[1]) : null;
}

function extractRole(text = "") {
  const value = normalizeText(text);
  const rolePatterns = [
    ["Marketing Staff", /\bmarketing|sales\b/i],
    ["Cook", /\bcook|kitchen|chef\b/i],
    ["Driver", /\bdriver|transport|gadi|delivery\b/i],
    ["Security Guard", /\bsecurity|guard\b/i],
    ["Helper", /\bhelper|labor|labour|construction\b/i],
    ["Waiter", /\bwaiter|hotel|restaurant\b/i],
  ];

  return rolePatterns.find(([, pattern]) => pattern.test(value))?.[0] || "";
}

function extractLocation(text = "") {
  const value = normalizeText(text);
  const knownLocations = [
    "jimirbar",
    "jimirebar",
    "jimirbaar",
    "bardaghat",
    "butwal",
    "parasi",
    "bhairahawa",
    "nawalparasi",
    "rupandehi",
  ];

  return knownLocations.find((location) => new RegExp(`\\b${location}\\b`, "i").test(value)) || "";
}

export function interpretQuestion({ text = "", conversation = {} } = {}) {
  const normalized = normalizeText(text);
  const entities = {
    quantity: extractQuantity(normalized),
    role: extractRole(normalized),
    location: extractLocation(normalized),
    activeFlow: conversation?.metadata?.activeFlow || "",
    currentState: conversation?.currentState || "",
  };

  if (!normalized) {
    return {
      simpleMeaning: "empty_or_non_text_message",
      possibleIntent: "unclear",
      confidence: 0.2,
      entities,
    };
  }

  if (/website\s*(design|banau|bana|banaune)|app\s*(banau|bana|banaune|building)|logo\s*design|digital\s*marketing\s*garxau|design\s*garxau/i.test(normalized)) {
    return {
      simpleMeaning: "asks JobMate to provide website/app/design service",
      possibleIntent: "outside_service",
      confidence: 0.95,
      entities,
    };
  }

  if (/love\s*letter|prem\s*patra|letter\s*(lekh|lekhi|likh)|song|joke|entertainment|caption\s*lekh/i.test(normalized)) {
    return {
      simpleMeaning: "asks unrelated writing or entertainment help",
      possibleIntent: "outside_entertainment",
      confidence: 0.9,
      entities,
    };
  }

  if (/salary\s*nadine|salary\s*nadi|paisa\s*nadi|paisa\s*nadine|free\s*(worker|staff|labor|labour)|bina\s*(salary|paisa)|unpaid/i.test(normalized)) {
    return {
      simpleMeaning: "asks for unpaid or unfair labor",
      possibleIntent: "risky_unpaid_labor",
      confidence: 0.96,
      entities,
    };
  }

  if (/underage|child\s*(worker|labor|labour)|bal\s*shram|bachcha\s*worker|minor/i.test(normalized)) {
    return {
      simpleMeaning: "asks about underage worker",
      possibleIntent: "risky_underage_worker",
      confidence: 0.95,
      entities,
    };
  }

  if (/fake\s*(document|license|citizenship|cv)|nakali\s*(document|license|citizenship|cv)|jhut[o]?\s*(document|license|cv)/i.test(normalized)) {
    return {
      simpleMeaning: "asks about fake documents",
      possibleIntent: "risky_fake_documents",
      confidence: 0.95,
      entities,
    };
  }

  if (/illegal|taskari|chor[iy]?|fraud|scam|manxe\s*bech|traffick/i.test(normalized)) {
    return {
      simpleMeaning: "asks about illegal work",
      possibleIntent: "risky_illegal_work",
      confidence: 0.95,
      entities,
    };
  }

  if (/job\s*guarantee|guarantee\s*(huncha|hunchha|din|dine)|sure\s*job|pakka\s*job|salary\s*guarantee/i.test(normalized)) {
    return {
      simpleMeaning: "asks whether JobMate guarantees job or salary",
      possibleIntent: "support_job_guarantee",
      confidence: 0.92,
      entities,
    };
  }

  if (/(worker|job|registration|register|job\s*khojna|kaam\s*khojna).*(paisa|fee|charge|cost|lincha|lagcha|tirnu)|paisa.*(worker|job|registration|register)|free.*(job|worker|registration)/i.test(normalized)) {
    return {
      simpleMeaning: "asks worker-side fee or registration cost",
      possibleIntent: "support_worker_fee",
      confidence: 0.9,
      entities,
    };
  }

  if (/document|citizenship|nagarikta|license|cv|privacy|safe|secure|photo\s*patha/i.test(normalized)) {
    return {
      simpleMeaning: "asks about document, CV, or privacy support",
      possibleIntent: "support_document_privacy",
      confidence: 0.76,
      entities,
    };
  }

  if (/sahakari|cooperative|pilot|partnership/i.test(normalized)) {
    return {
      simpleMeaning: "asks about sahakari pilot or partnership",
      possibleIntent: "support_sahakari_info",
      confidence: 0.78,
      entities,
    };
  }

  if (/(staff|worker|manxe|manche|employee|hiring|hire|chahiyo|chaiyo|chainxa|chahinxa).*(staff|worker|manxe|manche|employee|hiring|hire|jana|marketing|cook|driver|guard|helper)|\b\d{1,3}\s*jana\b/i.test(normalized)) {
    return {
      simpleMeaning: "employer is looking for staff",
      possibleIntent: "employer_lead",
      confidence: entities.quantity || entities.role ? 0.92 : 0.8,
      entities,
    };
  }

  if (/staff\s*chahiyo|staff\s*chaiyo|worker\s*chahiyo|worker\s*chaiyo|manxe\s*chahiyo|manche\s*chahiyo|hire\s*garna/i.test(normalized)) {
    return {
      simpleMeaning: "employer is looking for staff",
      possibleIntent: "employer_lead",
      confidence: 0.88,
      entities,
    };
  }

  if (/malai.*(kaam|kam|job|jagir).*(chahiyo|chaiyo|khojna|khojnu)|\b(kaam|kam|job|jagir)\s*(chahiyo|chaiyo|khojna|khojnu)\b|rojgar|jagir\s*chahiyo/i.test(normalized)) {
    return {
      simpleMeaning: "worker is looking for job or registration",
      possibleIntent: "worker_registration",
      confidence: 0.88,
      entities,
    };
  }

  if (entities.location && /(job|kaam|kam|vacancy|opening|cha|chha|xa|available)/i.test(normalized)) {
    return {
      simpleMeaning: "asks about jobs in a location",
      possibleIntent: "job_search",
      confidence: 0.72,
      entities,
    };
  }

  if (/jobmate\s*(ke|k|kasari|about)|service\s*area|location|fee|pricing|replacement|support/i.test(normalized)) {
    return {
      simpleMeaning: "asks general JobMate support question",
      possibleIntent: "support_answer",
      confidence: 0.65,
      entities,
    };
  }

  return {
    simpleMeaning: "unclear JobMate-related meaning",
    possibleIntent: "unclear",
    confidence: 0.35,
    entities,
  };
}
