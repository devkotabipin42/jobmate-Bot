/**
 * AARATI-18A — Human Boundary Reply Builder
 *
 * Pure functions only. No DB calls, no async.
 *
 * Converts a classified message category into a human-staff-style reply.
 * Returns null for flow categories (valid_job_search, valid_employer_hiring,
 * valid_worker_registration, unknown) — caller should continue normal flow.
 *
 * Exports:
 *   buildAaratiClassifiedReply({ category, text, conversation }) → string | null
 */

/**
 * Returns the appropriate human-staff-style reply for the given category,
 * or null if the flow should continue normally.
 */
export function buildAaratiClassifiedReply({
  category = "",
  text = "",
  conversation = {},
} = {}) {
  const rawLower = String(text || "").toLowerCase().trim();

  switch (category) {
    // ── Forbidden employer request ──────────────────────────────────────
    case "forbidden_employer_request":
      return [
        "Yo request JobMate rules anusar mildaina 🙏",
        "JobMate le legal, safe ra fair salary bhayeko kaam/hiring matra support garcha. Bina paisa, unpaid trial, ya underage worker match garna mildaina.",
        "Yedi tapai legal salary ra safe duty condition sanga staff khojna chahanu huncha bhane business name, location, role ra salary range pathaunu hola.",
      ].join("\n\n");

    // ── Out of scope service ────────────────────────────────────────────
    case "out_of_scope_service":
      if (/website|coding|code.*garna|web.*app/i.test(rawLower)) {
        return [
          "Website/coding ko kaam ma JobMate bata direct service dina mildaina 🙏",
          "Tara IT/developer job khojna ho bhane location ra role pathaunu hola.",
        ].join("\n\n");
      }
      return [
        "Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina.",
        "Ma JobMate team bata job khojna, staff khojna, CV/document guidance, pricing/support ra human team connect garne kura ma help garna sakchu.",
      ].join("\n\n");

    // ── CV privacy / support ────────────────────────────────────────────
    case "cv_privacy_support":
      return [
        "Dar lagnu normal ho 🙏",
        "JobMate ma tapai ko CV/document hiring purpose ko lagi matra use garincha. Pahila CV pathauna compulsory chaina.",
        "Tapai comfortable hunuhunchha bhane basic detail bata suru garna milcha:\n- Naam\n- Location\n- Kasto kaam khojdai hunuhunchha\n- Available kahile dekhi",
        "CV/document pachi matra share garda huncha.",
      ].join("\n\n");

    // ── Frustration or insult ───────────────────────────────────────────
    case "frustration_or_insult": {
      const frustrationCount = Number(conversation?.metadata?.frustrationCount || 0);
      if (frustrationCount >= 2) {
        return [
          "Maile ajhai clear help garna sakina jasto lagyo 🙏",
          "Chahanu bhaye ma human JobMate team lai connect garna request note garna sakchu. Team le tapai lai contact garcha.",
        ].join("\n\n");
      }
      return [
        "Maaf garnu hola 🙏 Aghi ko reply clear bhayena jasto lagyo.",
        "Ma JobMate team bata job khojna, staff khojna, CV/document, pricing/support ko kura ma help garna sakchu.",
        "Tapai ko main kura ek line ma pathaunu hola, ma sidha answer dinchhu.",
      ].join("\n\n");
    }

    // ── Identity / capability ───────────────────────────────────────────
    case "identity_capability":
      return [
        "Ma Aarati, JobMate team bata support garne staff ho 🙏",
        "Mero kaam:\n- Kaam khojne manche lai right job search/registration ma help garne\n- Employer lai staff requirement collect garne\n- CV/document/verification ko guidance dine\n- Pricing/support ko basic answer dine\n- Zaruri paryo bhane human team samma kura puryaune",
      ].join("\n\n");

    // ── Small talk boundary ────────────────────────────────────────────
    case "small_talk_boundary":
      if (/how old|timro.*age|timi.*umar|timro umar/i.test(rawLower)) {
        return [
          "Ma personal age share garne profile ma chaina 🙏",
          "Tara JobMate ko kaam, staff hiring, job search, CV/document support ma help garna sakchu.",
        ].join("\n\n");
      }
      if (/where.*live|timro.*ghar|ghar.*kata/i.test(rawLower)) {
        return [
          "Ma JobMate ko WhatsApp support system bata ho, ghar/address hune profile haina 🙏",
          "Job khojna, staff khojna, CV/document support ma help garna sakchu.",
        ].join("\n\n");
      }
      return [
        "Hajur 🙏 Ma JobMate team bata yahi help garna ready chu.",
        "Personal kura bhanda JobMate ko kaam ma focus garum hai — job khojna, staff khojna, CV/document, pricing/support ma help garna sakchu.",
      ].join("\n\n");

    // ── Respect / trust ───────────────────────────────────────────────
    case "respect_trust":
      return [
        "Hajur, ma tapai sanga samman sanga kura garchu 🙏",
        "Aghi ko reply rude/unclear jasto lagyo bhane sorry. Tapai ko kura short ma pathaunu hola, ma calm bhayera sidha help garchu.",
      ].join("\n\n");

    // ── Pricing / support ─────────────────────────────────────────────
    case "pricing_support":
      return [
        "Job khojne manche ko lagi basic registration/support free huncha 🙏",
        "Employer/staff khojne business ko lagi plan huncha:\n- Free: NPR 0\n- Basic: NPR 499/month\n- Premium: NPR 999/month",
        "Tapai job khojdai hunuhunchha ki business ko lagi staff khojdai hunuhunchha?",
      ].join("\n\n");

    // ── Out of region location ─────────────────────────────────────────
    case "out_of_region_location":
      return [
        "Ahile JobMate ko main focus Lumbini Province ho 🙏",
        "Kathmandu/Pokhara/Chitwan ko job aaile confirm garera dekhaina, wrong job dekhaunu mildaina.",
        "Tapai Lumbini area, jastai Butwal/Bhairahawa/Bardaghat/Parasi tira job khojna chahanu huncha?",
      ].join("\n\n");

    // ── Ambiguous location ─────────────────────────────────────────────
    case "ambiguous_location":
      return [
        "Kun area bata khojnu parcha? 🙏",
        "Location clear bhayo bhane wrong job dekhaudina.",
        "Example: Butwal, Bhairahawa, Bardaghat, Parasi, Sunwal, Devdaha.",
      ].join("\n\n");

    // ── Command (restart/menu) ─────────────────────────────────────────
    case "command":
      return [
        "Namaste 🙏 JobMate Nepal ma swagat cha.",
        "Tapai kaam khojdai hunuhunchha ki staff khojdai hunuhunchha?",
      ].join("\n\n");

    // ── Flow categories — caller continues normal flow ─────────────────
    case "valid_job_search":
    case "valid_employer_hiring":
    case "valid_worker_registration":
    case "unknown":
    default:
      return null;
  }
}
