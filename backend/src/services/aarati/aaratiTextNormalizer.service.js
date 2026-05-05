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
    .replace(/\btarkar\b/g, "taskar")
    .replace(/\btaskar\b/g, "taskar")
    .replace(/\bmanav\b/g, "manav")
    .trim();

  return value;
}

export function getAaratiNormalizedText(normalized = {}) {
  return normalizeAaratiText(getAaratiRawText(normalized));
}

export function isAaratiSmallTalkText(text = "") {
  const value = normalizeAaratiText(text);

  return /khana khanu bhayo|khana khayau|khana bhayo|k cha|khabar|sanchai|hello|hi|namaste|good morning|good evening|how are you|k gardai/i.test(
    value
  );
}

export function isAaratiFrustrationText(text = "") {
  const value = normalizeAaratiText(text);

  return /are you mad|pagal|risayau|risako|kina bujhena|bujhdainau|wrong|galat|bakwas|stupid|idiot|bitch|fuck|gali|mad ho|kasto bot|kasto reply|ghus|ghus khanchau|bribe|rishwat|रिसवत|घुस/i.test(
    value
  );
}

export function isAaratiUnsafeIllegalText(text = "") {
  const value = normalizeAaratiText(text);

  return /manav.*taskar|human.*traffick|traffick|bechna|बेच्न|fake document|fake license|child worker|underage|passport rakh|salary nadine|illegal worker/i.test(
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

  return /timi ko hau|tapai ko ho|timro naam|who are you|what are you|aarati ko ho|jobmate k ho|jobmate ke ho|jobmate k h/i.test(
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

  return (
    /[0-9]+\s*[\+\-\*\/x]\s*[0-9]+/.test(value) ||
    /math|homework|assignment|essay|solve/i.test(value)
  );
}

export function isAaratiDirectMenuReply(text = "") {
  return /^[1-9]$/.test(String(text || "").trim());
}
