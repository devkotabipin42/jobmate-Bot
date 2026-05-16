const PROVIDER_WORDS =
  /gemini|openai|chatgpt|gpt|language model|ai model|large language model|provider|system prompt|as an ai/i;

const TOO_UNRELATED_PATTERNS = [
  /solve.*homework/i,
  /write.*essay/i,
  /politics|election|president|prime minister|party/i,
  /religion|god|bible|quran|hindu|muslim|christian/i,
  /coding|javascript|react|node|python|programming/i,
];

const HARD_UNSAFE_PATTERNS = [
  /fake document|fake cv|fake license|duplicate citizenship/i,
  /underage worker|child labor|child labour/i,
  /passport hold|keep passport|salary hold/i,
  /no salary|free work|bonded labor|bonded labour/i,
  /trafficking|illegal work|visa scam/i,
];

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[।.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function limitWords(text = "", maxWords = 85) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return normalizeText(text);

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function removeProviderMentions(text = "") {
  return normalizeText(text)
    .replace(/as an ai language model,?/gi, "")
    .replace(/as an ai,?/gi, "")
    .replace(/I am an AI,?/gi, "")
    .replace(/Gemini/gi, "JobMate")
    .replace(/OpenAI/gi, "JobMate")
    .replace(/ChatGPT/gi, "JobMate")
    .replace(/AI model/gi, "JobMate assistant")
    .replace(/language model/gi, "JobMate assistant")
    .replace(/provider/gi, "system");
}

function repairBrokenReplyPrefix(text = "") {
  return normalizeText(text)
    .replace(/^aste\b/i, "Namaste")
    .replace(/^i\s+kasto\s+kaam/i, "Tapai kasto kaam")
    .replace(/^quest\s+JobMate\s+rules/i, "Yo request JobMate rules");
}

function isQuestionLikelyUnrelated(userText = "") {
  const value = String(userText || "").toLowerCase();

  return TOO_UNRELATED_PATTERNS.some((pattern) => pattern.test(value));
}

function isUnsafeHiring(userText = "") {
  const value = String(userText || "").toLowerCase();

  return HARD_UNSAFE_PATTERNS.some((pattern) => pattern.test(value));
}

function hasUsefulNextStep(text = "") {
  return /kaam|job|staff|worker|team|location|area|document|profile|employer|company|support|reply|lekhnu|pathaunu/i.test(
    text
  );
}

function makeBoundaryReply(userText = "") {
  if (isUnsafeHiring(userText)) {
    return `Yo request JobMate rules anusar mil्दैन 🙏

JobMate le safe, legal ra fair hiring matra support गर्छ.

Ramro worker/staff khojna company name, location ra role pathaunu hola.`;
  }

  return `Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina.

Ma yaha job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.

Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?`;
}

export function polishAaratiReply({
  userText = "",
  reply = "",
  source = "unknown",
  maxWords = 85,
} = {}) {
  const cleanUserText = normalizeText(userText);
  let cleanReply = repairBrokenReplyPrefix(removeProviderMentions(reply));

  if (!cleanReply) return null;

  if (PROVIDER_WORDS.test(cleanReply)) {
    cleanReply = cleanReply.replace(PROVIDER_WORDS, "JobMate team");
  }

  if (isUnsafeHiring(cleanUserText)) {
    return {
      reply: makeBoundaryReply(cleanUserText),
      changed: true,
      reason: "unsafe_hiring_boundary",
      source,
    };
  }

  if (isQuestionLikelyUnrelated(cleanUserText)) {
    return {
      reply: makeBoundaryReply(cleanUserText),
      changed: true,
      reason: "unrelated_boundary",
      source,
    };
  }

  const sentences = splitSentences(cleanReply);
  let compactReply = repairBrokenReplyPrefix(sentences.slice(0, 5).join("\n"));

  compactReply = limitWords(compactReply, maxWords);

  if (!hasUsefulNextStep(compactReply)) {
    compactReply += `\n\nAba tapai kaam khojna ho bhane location ra kaam type pathaunu hola. Staff khojna ho bhane company/role pathaunu hola.`;
  }

  compactReply = compactReply
    .replace(/please/gi, "kripaya")
    .replace(/thank you/gi, "dhanyabad")
    .replace(/\bdear user\b/gi, "Hajur")
    .replace(/\buser\b/gi, "tapai")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!/^namaste|^mitra ji|^bujh/i.test(compactReply)) {
    compactReply = `Hajur, bujhe 🙏\n\n${compactReply}`;
  }

  return {
    reply: compactReply,
    changed: compactReply !== reply,
    reason: "human_whatsapp_polish",
    source,
  };
}

export function getUserTextForPolish(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}
