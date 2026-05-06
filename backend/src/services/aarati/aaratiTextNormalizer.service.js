export function getAaratiRawText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}

export function normalizeAaratiText(input = "") {
  let value = String(input || "").toLowerCase().trim();

  value = value
    .replace(/[।,!?]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\bkxa\b/g, "k cha")
    .replace(/\bk cha\b/g, "k cha")
    .replace(/\bkbr\b/g, "khabar")
    .replace(/\bkhabar\b/g, "khabar")
    .replace(/\bsanchai\b/g, "sanchai")
    .replace(/\bsanchei\b/g, "sanchai")
    .replace(/\bhunuhunxa\b/g, "hunuhuncha")
    .replace(/\bhunuhuncha\b/g, "hunuhuncha")
    .replace(/\bbhayo\b/g, "bhayo")
    .replace(/\bvayo\b/g, "bhayo")
    .replace(/\bbho\b/g, "bhayo")
    .replace(/\bkanu\b/g, "khanu")
    .replace(/\bkhanu\b/g, "khanu")
    .replace(/\bchayako\b/g, "chahiyeko")
    .replace(/\bchayeko\b/g, "chahiyeko")
    .replace(/\bchaiyo\b/g, "chahiyo")
    .replace(/\bchayo\b/g, "chahiyo")
    .replace(/\bchiyo\b/g, "chahiyo")
    .replace(/\bk h\b/g, "k ho")
    .replace(/\bk ho\b/g, "k ho")
    .replace(/\bke ho\b/g, "k ho")
    .replace(/\btgeo\b/g, "thiyo")
    .replace(/\btheo\b/g, "thiyo")
    .replace(/\bthyo\b/g, "thiyo")
    .replace(/\bghus\b/g, "ghus")
    .replace(/\bkanxau\b/g, "khanchau")
    .replace(/\barw\b/g, "are")
    .replace(/\barew\b/g, "are")
    .replace(/\btarkar\b/g, "taskar")
    .replace(/\btaskar\b/g, "taskar")
    .replace(/\btme\b/g, "timi")
    .replace(/\bkoho\b/g, "ko ho")
    .replace(/\bnadine\b/g, "nadine")
    .replace(/\bnadiney\b/g, "nadine")
    .replace(/\bmanav\b/g, "manav")
    // ── Joined location + domain-word tokenizer (NEW 19E) ─────────────────
    // Only known location aliases and common domain words are split.
    // Input is already lowercased at this point.
    .replace(/\bpokharma\b/g, "pokhara ma")
    .replace(/\bpokharama\b/g, "pokhara ma")
    .replace(/\bkathmanduma\b/g, "kathmandu ma")
    .replace(/\bktmma\b/g, "kathmandu ma")
    .replace(/\bbutwalma\b/g, "butwal ma")
    .replace(/\bbutwlma\b/g, "butwal ma")
    .replace(/\bbardaghatma\b/g, "bardaghat ma")
    .replace(/\bbhardaghatma\b/g, "bardaghat ma")
    .replace(/\bbhardghatma\b/g, "bardaghat ma")
    .replace(/\bbhargatma\b/g, "bardaghat ma")
    .replace(/\bbhairahawama\b/g, "bhairahawa ma")
    .replace(/\bsiddharthanagamma\b/g, "siddharthanagar ma")
    .replace(/\bparasima\b/g, "parasi ma")
    .replace(/\bsunwalma\b/g, "sunwal ma")
    .replace(/\bdevdahama\b/g, "devdaha ma")
    .replace(/\bosakama\b/g, "osaka ma")
    .replace(/\bjapanma\b/g, "japan ma")
    .replace(/\bindiyama\b/g, "india ma")
    .replace(/\bdubaima\b/g, "dubai ma")
    .replace(/\bschoolko\b/g, "school ko")
    .replace(/\bhotelko\b/g, "hotel ko")
    .replace(/\bcompanyko\b/g, "company ko")
    .replace(/\brestaurantko\b/g, "restaurant ko")
    .replace(/\bofficeко\b/g, "office ko")
    .trim();

  return value;
}

export function getAaratiNormalizedText(normalized = {}) {
  return normalizeAaratiText(getAaratiRawText(normalized));
}

export function isAaratiSmallTalkText(text = "") {
  const value = normalizeAaratiText(text);

  return /khana khanu bhayo|khana khayau|khana bhayo|\bk cha\b|khabar|sanchai|hello|\bhi\b|namaste|good morning|good evening|how are you|k gardai/i.test(
    value
  );
}

export function isAaratiFrustrationText(text = "") {
  const value = normalizeAaratiText(text);

  return /are you mad|pagal|risayau|risako|kina bujhena|bujhdainau|bujdainau|wrong|galat|bakwas|stupid|idiot|bitch|fuck|gali|mad ho|kasto bot|kasto reply|ghus|ghus khanchau|bribe|rishwat|रिसवत|घुस/i.test(
    value
  );
}

export function isAaratiFairLaborViolationText(text = "") {
  const value = normalizeAaratiText(text);

  return /free.*ma.*ka{1,2}m.*garne.*worker|free.*labor.*dinus|bina.*paisa.*ka{1,2}m.*garaunus|bina.*salary.*ka{1,2}m|salary.*nadi(ne|da|ney).*worker|paisa.*nadi(ne|da|ney).*worker|free.*ma.*ka{1,2}m.*garaunus|no.*pay.*worker|unpaid.*worker|free.*worker.*chahiyo|free.*staff.*chahiyo|bina.*paisa.*staff|trial.*ko.*paisa.*nadi(ne|da|ney)|overtime.*paisa.*nadi(ne|da|ney)|paisa.*nadin\b/i.test(
    value
  );
}

export function isAaratiCvPrivacyQuestion(text = "") {
  const value = normalizeAaratiText(text);

  return /cv.*sabai.*company|cv.*company.*dekaunu|cv.*share.*sabai|resume.*sabai.*company|resume.*company.*lai.*dinu|mero.*cv.*sabai|mero.*resume.*sabai|cv.*baher.*pathau|cv.*leak|resume.*leak|document.*share.*sabai/i.test(
    value
  );
}

export function isAaratiUnsafeIllegalText(text = "") {
  const value = normalizeAaratiText(text);

  return /manav.*taskar|human.*traffick|traffick|bechna|बेच्न|fake document|fake license|fake cv|nakali|child worker|child labour|child labor|underage|minor worker|baccha worker|bachha worker|bachha helper|bachha staff|bal shram|passport rakh|passport hold|salary nadine|salary na dine|free work|no salary|illegal worker|forced labor|forced labour|bonded labor|bonded labour|\bage\s*1[0-7]\b|1[0-7]\s*barsha.*worker|1[0-7]\s*sal.*worker|1[0-7]\s*ko.*helper|1[0-7]\s*yo.*staff|naabalik/i.test(
    value
  );
}

export function isAaratiPersonalMoneyText(text = "") {
  const value = normalizeAaratiText(text);

  return /malai.*paisa.*chah|paisa chahiyeko|paisa chahiyo|loan|rin|ऋण|सापटी/i.test(
    value
  );
}

export function isAaratiEmployerRequestText(text = "") {
  const value = normalizeAaratiText(text);

  return /staff chahiyo|worker chahiyo|manpower chahiyo|employee chahiyo|provide.*staff|provide.*worker|need.*staff|need.*worker|hire.*staff|hire.*worker|staff khojna|worker khojna|malai staff|malai worker|company lai staff|business lai staff/i.test(
    value
  );
}

export function isAaratiJobSeekerRequestText(text = "") {
  const value = normalizeAaratiText(text);

  return /job chahiyo|kaam chahiyo|kam chahiyo|malai job|malai kaam|malai kam|apply garna|profile save|kaam khojna|job khojna/i.test(
    value
  );
}

export function isAaratiIdentityQuestionText(text = "") {
  const value = normalizeAaratiText(text);

  return /timi ko hau|timi ko ho|tapai ko ho|timro naam|who are you|what are you|aarati ko ho|jobmate k ho|jobmate ke ho|jobmate k h/i.test(
    value
  );
}

export function isAaratiWeatherText(text = "") {
  const value = normalizeAaratiText(text);

  return /weather|mausam|मौसम|pani parcha|rain|garmi|chiso|aaja ko weather|aja ko weather/i.test(
    value
  );
}

export function isAaratiMathHomeworkText(text = "") {
  const value = normalizeAaratiText(text);

  const looksLikeSalaryRange = /\b\d{4,6}\s*-\s*\d{4,6}\b/.test(value);
  if (looksLikeSalaryRange) return false;

  return (
    /[0-9]+\s*[\+\*\/x]\s*[0-9]+/.test(value) ||
    /math|homework|assignment|essay|solve/i.test(value)
  );
}

export function isAaratiDirectMenuReply(text = "") {
  return /^[1-9]$/.test(String(text || "").trim());
}

export function isAaratiRestartCommandText(text = "") {
  const value = String(text || "").toLowerCase().trim();
  return /^(start|restart|suru|menu|surugaram|suru garam|नया|नयाँ|सुरु|reset|feri suru|feri start)$/.test(value);
}

// ---------------------------------------------------------------------------
// NEW 19E: extractNameFromIntro
// Extracts a human name from intro phrases. Uses the RAW (un-normalized) text
// so original casing is preserved for title-casing.
// Returns title-cased name string, or null.
// ---------------------------------------------------------------------------

const _NAME_NOISE = new Set([
  "test", "unknown", "user", "admin", "jobmate", "aarati", "bot",
  "hello", "hi", "yes", "no", "ok", "na", "ta", "n", "a", "yo", "ma",
]);
const _JOB_ROLE_NOISE = new Set([
  "driver", "waiter", "cook", "helper", "guard", "teacher", "nurse",
  "manager", "staff", "worker", "cleaner", "cashier", "receptionist",
  "security", "loader", "hotel", "fresher", "trainee", "labour", "labor",
  "helper", "sweeper", "operator",
]);
const _ARTICLE_STOPS = new Set(["a", "an", "the", "from", "at", "in", "going", "working", "here", "not", "just"]);

function _titleCase(str) {
  return String(str)
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function _isValidName(extracted) {
  if (!extracted || extracted.length < 2 || extracted.length > 40) return false;
  if (/\d{4,}/.test(extracted)) return false; // phone-like
  const words = extracted.toLowerCase().split(/\s+/);
  if (_NAME_NOISE.has(words[0])) return false;
  if (_ARTICLE_STOPS.has(words[0])) return false;
  // Single-word match must not be a job role
  if (words.length === 1 && _JOB_ROLE_NOISE.has(words[0])) return false;
  return true;
}

export function extractNameFromIntro(text = "") {
  const val = String(text || "").trim();

  // Pattern: "my name is X [Y]"
  let m = val.match(/\bmy name is ([a-zA-Z][a-zA-Z\s]{1,39})/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "mero naam X ho" / "naam X ho"
  m = val.match(/\bmero\s+naam\s+([a-zA-Z][a-zA-Z]{1,39}(?:\s+[a-zA-Z]{1,39})?)\s+ho\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "mero name X ho?" / "mero name X"
  m = val.match(/\bmero\s+name\s+(?:is\s+)?([a-zA-Z][a-zA-Z]{1,39}(?:\s+[a-zA-Z]{1,39})?)\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "naam X ho"
  m = val.match(/\bnaam\s+([a-zA-Z][a-zA-Z]{1,20})\s+ho\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "I am FirstName LastName" (multi-word to avoid "I am a driver")
  m = val.match(/\bi am ([a-zA-Z]{2,20}\s+[a-zA-Z]{2,20})\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "this is FirstName [LastName]"
  m = val.match(/\bthis is ([a-zA-Z][a-zA-Z]{1,20}(?:\s+[a-zA-Z]{1,20})?)\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  // Pattern: "ma FirstName LastName ho" (multi-word only — avoids "ma driver ho")
  m = val.match(/\bma ([a-zA-Z]{2,20}\s+[a-zA-Z]{2,20})\s+ho\b/i);
  if (m && _isValidName(m[1].trim())) return _titleCase(m[1].trim());

  return null;
}

// ---------------------------------------------------------------------------
// NEW 19E: isAaratiHesitationText
// Detects user refusal or hesitation to share details/documents.
// ---------------------------------------------------------------------------

export function isAaratiHesitationText(text = "") {
  const val = normalizeAaratiText(text);
  return /detail.*pathauna.*sakdina|detail.*dina.*man.*chaina|aile.*pathaudina|share.*garna.*man.*chaina|share.*sakdina|cv.*dina.*man.*chaina|document.*dina.*sakdina|info.*dina.*sakdina|private.*ho\b|pachi.*bhanxu|aile.*bhanna.*mildaina|aile.*bhannu.*pardaina|comfortable.*chaina|sochi.*bhanxu|ma.*sakdina\b(?!.*job)|pathaudina\b|\bdar lagcha\b/i.test(
    val
  );
}
