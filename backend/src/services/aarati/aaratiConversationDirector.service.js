/**
 * AARATI-16A — Human Conversation Director
 *
 * Pure functions only. No DB calls, no async.
 * Provides: mode detection, human reply builder, repetition guard, context patch.
 */

import {
  normalizeAaratiText,
  isAaratiFrustrationText,
  isAaratiUnsafeIllegalText,
  isAaratiPersonalMoneyText,
  isAaratiWeatherText,
  isAaratiMathHomeworkText,
  isAaratiEmployerRequestText,
  isAaratiJobSeekerRequestText,
} from "./aaratiTextNormalizer.service.js";

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const KNOWN_LOCATIONS = [
  "butwal", "bardaghat", "bhardaghat", "bhairahawa", "parasi", "nawalparasi",
  "rupandehi", "kapilvastu", "palpa", "dang", "banke", "pokhara", "kathmandu",
  "chitwan", "hetauda", "birgunj", "biratnagar", "dhangadhi",
];

const KNOWN_ROLES = [
  "driver", "hotel", "security", "sales", "helper", "restaurant", "shop",
  "factory", "cleaner", "cook", "waiter", "guard", "construction", "labor",
  "it", "computer", "frontend", "backend", "marketing",
];

const UNSAFE_REPLY_PATTERNS = [
  /gemini/i, /openai/i, /chatgpt/i, /\bgpt\b/i,
  /100%\s*guarantee/i, /guaranteed job/i,
  /job guarantee dinch/i, /salary guarantee dinch/i,
  /verified job cha/i, /system prompt/i, /language model/i,
];

const GENERIC_MENU_PATTERNS = [
  /kaam khojdai hunuhunchha ki staff khojdai/i,
  /kaam khojna ho ki staff khojna/i,
  /tapai jobseeker ho ki employer/i,
];

function fmt(opener, body, next) {
  return `${opener}\n\n${body}\n\n${next}`.trim();
}

function isGenericMenuReply(text = "") {
  return GENERIC_MENU_PATTERNS.some((re) => re.test(String(text || "")));
}

function extractLocation(text = "") {
  const v = String(text || "").toLowerCase();
  return KNOWN_LOCATIONS.find((loc) => v.includes(loc)) || "";
}

function extractRole(text = "") {
  const v = String(text || "").toLowerCase();
  return KNOWN_ROLES.find((role) => v.includes(role)) || "";
}

// ---------------------------------------------------------------------------
// detectHumanConversationMode
// Returns one of: jobseeker_question | employer_question | identity_question |
//   trust_question | document_question | pricing_question | support_request |
//   frustration | small_talk | unsafe_request | out_of_scope | unclear
// ---------------------------------------------------------------------------

export function detectHumanConversationMode({ text = "", conversation = {} } = {}) {
  const v = normalizeAaratiText(text);

  // Hard safety first
  if (isAaratiUnsafeIllegalText(v)) return "unsafe_request";
  // Catch "bechni"/"bechne" verb variants not covered by base normalizer
  if (/bechni\b|bechne\b|bechxan\b|manxe.*bech|manche.*bech/i.test(v)) return "unsafe_request";
  if (
    isAaratiFrustrationText(v) ||
    /\bbitch\b|\bfuck\b|\bmc\b|\bbc\b|\bsaala\b|\bghanta\b|\bkutta\b/i.test(v)
  ) return "frustration";
  if (isAaratiPersonalMoneyText(v)) return "out_of_scope";
  if (isAaratiWeatherText(v) || isAaratiMathHomeworkText(v)) return "out_of_scope";

  // Specific topic questions
  if (
    /document.*leak|cv.*leak|citizenship.*leak|data.*leak|photo.*safe|document.*privacy|document.*chori/i.test(v)
  ) return "document_question";

  if (
    /trust|vishwas|believe|genuine|legit|scam|cheat|bharosa|why.*trust|kyun.*trust|real.*company|company.*real/i.test(v)
  ) return "trust_question";

  if (
    /timi ko ho|timi ko hau|tapai ko ho|who are you|what are you|aarati.*k.*ho|are you real|bot ho\b|human ho/i.test(v)
  ) return "identity_question";

  if (
    /price|pricing|fee|cost|monthly|plan|free.*ho|kati.*lagcha|lagcha.*kati|paisa.*lagcha/i.test(v)
  ) return "pricing_question";

  if (
    /support.*team|team.*contact|contact.*jobmate|help.*kina.*garena|human.*chahiyo.*help/i.test(v)
  ) return "support_request";

  // Employer vs jobseeker (dedicated patterns first)
  if (isAaratiEmployerRequestText(v)) return "employer_question";
  if (isAaratiJobSeekerRequestText(v)) return "jobseeker_question";

  // Broader jobseeker signals
  if (
    /parttime|part.?time|student.*job|job.*student|intern\b|internship|pahilo.*job|first.*job/i.test(v)
  ) return "jobseeker_question";

  // Small talk
  if (
    /khana khanu|khana khayo|k cha|khabar|sanchai|hello|hi\b|namaste|good morning|good evening|how are you|k gardai/i.test(v)
  ) return "small_talk";

  // Out of scope
  if (
    /politics|election|religion|dharm|alcohol|drug|medicine|doctor|hospital|website.*bana|website.*ban|app.*bana|mobile app.*bana|web app.*bana|can you.*website|make.*website|create.*website|develop.*website/i.test(v)
  ) return "out_of_scope";

  return "unclear";
}

// ---------------------------------------------------------------------------
// buildHumanClarificationReply
// Always: acknowledgement + direct answer/boundary + one clear next step
// ---------------------------------------------------------------------------

export function buildHumanClarificationReply({ mode = "unclear", text = "", conversation = {} } = {}) {
  const lastMode = conversation?.metadata?.lastAaratiMode || "";
  const lastLocation = conversation?.metadata?.lastUsefulLocation || "";

  switch (mode) {
    case "trust_question":
      return fmt(
        "Tapai ko chinta thik ho 🙏",
        "JobMate Nepal ma registered ra verified service ho. Tapai ko data safe rakhcha, fake job use gardaina, ra registered employer sanga matra connect garcha.",
        "Kaam khojna ho bhane location ra job type pathaunu hola."
      );

    case "identity_question":
      return fmt(
        "Ma Aarati ho, JobMate Nepal ko WhatsApp sahayogi 🙏",
        "Ma tapai lai kaam khojna, staff khojna, profile save garna, document/verification ra support ma help garna sakchu.",
        "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?"
      );

    case "document_question":
      return fmt(
        "Hajur, bujhe 🙏",
        "Document compulsory haina. Document verification ra hiring ko lagi matra use huncha — bahar share gardaina. Tapai comfortable hunuhunna bhane document bina profile save garna milcha.",
        "Document bina profile save garna 2 lekhnu hola. Document chha bhane yahi WhatsApp ma photo/file pathauna saknuhunchha."
      );

    case "pricing_question":
      return fmt(
        "Hajur, bujhe 🙏",
        "Jobseeker ko basic profile/application support generally free ho. Employer ko pricing/service plan chai business need anusar confirm garna parcha.",
        lastMode === "employer_question"
          ? "Tapai ko business name ra location pathaunu hola, ma pricing bare connect garchu."
          : "Tapai jobseeker ho bhane kaam type ra location pathaunu hola."
      );

    case "support_request":
      return fmt(
        "Hajur, bujhe 🙏",
        "JobMate support ko lagi ma yahi WhatsApp ma basic help garna sakchu. Complex case bhaye team lai forward garna milcha.",
        "Tapai ko issue short ma pathaunu hola, ma sidha try garchu."
      );

    case "employer_question":
      return fmt(
        "Hajur, malum paro 🙏",
        "Staff khojna JobMate bata garna milcha. Company name, location, kasto role chahiyo, kati jana, ra salary range short ma pathaunu hola.",
        "Yesari pathaunu hola: 'Mero company [naam] ho, [location] ma [role] ko lagi [X] jana chahiyo.'"
      );

    case "jobseeker_question":
      return fmt(
        "Hajur, malum paro 🙏",
        "Kaam khojna JobMate bata garna milcha. Tapai ko location ra kasto kaam chahiyo short ma pathaunu hola.",
        lastLocation
          ? `${lastLocation.charAt(0).toUpperCase() + lastLocation.slice(1)} area ma kasto kaam khojdai hunuhunchha?`
          : "Kasto kaam, kun district ma? Short ma pathaunu hola."
      );

    case "small_talk":
      return fmt(
        "Hajur, thik cha 🙏",
        "Ma Aarati, JobMate Nepal team bata. Small kura garna milcha — tara mero main kaam tapai lai job ra hiring support dinu ho.",
        "Kaam khojna ho bhane location ra kaam type pathaunu hola. Staff khojna ho bhane company name ra role pathaunu hola."
      );

    case "frustration":
      return fmt(
        "Maaf garnu hola 🙏",
        "Aghi ko kura ramro bhayena jasto lagyo. Ma JobMate team bata kaam khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.",
        "Tapai ko main problem short ma pathaunu hola, ma sidha answer dinchhu."
      );

    case "unsafe_request":
      return fmt(
        "Yo request JobMate rules anusar mildaina 🙏",
        "JobMate le legal, safe ra voluntary employment/hiring process matra support garcha.",
        "Legal business ko lagi staff chahiyeko ho bhane company name, location, role ra salary pathaunu hola."
      );

    case "out_of_scope":
      return fmt(
        "Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina.",
        "Ma job khojna, staff khojna, document/verification, pricing ra support ko kura ma matra help garna sakchu.",
        "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?"
      );

    case "unclear":
    default:
      return fmt(
        "Hajur, bujhe 🙏",
        "Yo kura ma ma exact answer confirm garna sakdina, tara JobMate bhitra ma job khojna, staff khojna, document/verification, pricing ra support ko kura ma help garna sakchu.",
        "Tapai ko question JobMate/job/hiring sanga related ho bhane ekchoti short ma detail pathaunu hola."
      );
  }
}

// ---------------------------------------------------------------------------
// reduceMenuRepetition
// If last outbound and current reply are both generic menus, use alternate.
// ---------------------------------------------------------------------------

export function reduceMenuRepetition({ reply = "", conversation = {} } = {}) {
  if (!isGenericMenuReply(reply)) return reply;

  const lastQuestion = conversation?.metadata?.lastQuestion || "";
  const lastSignature = conversation?.metadata?.lastAaratiReplySignature || "";
  const lastWasAlsoMenu =
    isGenericMenuReply(lastQuestion) || isGenericMenuReply(lastSignature);

  if (!lastWasAlsoMenu) return reply;

  // Two consecutive generic menus — use human alternate
  return "Hajur 🙏 Tapai job khojna chahanu huncha ki staff/worker khojna?\n\nJob khojna ho bhane location ra kaam type pathaunu hola.\nStaff khojna ho bhane company name ra role pathaunu hola.";
}

// ---------------------------------------------------------------------------
// rememberLastContextPatch
// Returns a metadata patch object — caller saves it to conversation.metadata.
// ---------------------------------------------------------------------------

export function rememberLastContextPatch({ text = "", reply = "", route = "", conversation = {} } = {}) {
  const mode = detectHumanConversationMode({ text, conversation });
  const location = extractLocation(text);
  const role = extractRole(text);

  const patch = {
    lastAaratiMode: mode,
    lastAaratiReplySignature: String(reply || "").slice(0, 100),
  };

  if (location) patch.lastUsefulLocation = location;
  if (role) patch.lastUsefulRole = role;
  if (text) patch.lastUserTopic = String(text).slice(0, 60);

  return patch;
}

// ---------------------------------------------------------------------------
// isSafeDirectorReply — safety check for any reply going through director
// ---------------------------------------------------------------------------

export function isSafeDirectorReply(reply = "") {
  return !UNSAFE_REPLY_PATTERNS.some((re) => re.test(String(reply || "")));
}
