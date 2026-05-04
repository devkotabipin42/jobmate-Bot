// Worker profile summary formatter for Aarati.
// Presentation only: no DB writes, no AI calls.

function formatJobPreference(jobType = "") {
  const value = String(jobType || "").trim();

  const labels = {
    "IT/Tech": "IT / Web",
    "Driver/Transport": "Driver / Transport",
    Security: "Security Guard",
    Hospitality: "Hotel / Restaurant",
    "Construction/Labor": "Construction / Labor",
    "Farm/Agriculture": "Farm / Agriculture",
    "Shop/Retail": "Shop / Retail",
    Other: "Aru / Other",
  };

  return labels[value] || value || "-";
}

function formatAvailability(value = "") {
  const raw = String(value || "").toLowerCase().trim();

  const labels = {
    "full-time": "Full-time",
    "part-time": "Part-time",
    shift: "Shift based",
    any: "Jun sukai / Flexible",
    immediate: "Immediate",
    within_1_week: "Within 1 week",
    within_2_weeks: "Within 2 weeks",
    within_1_month: "Within 1 month",
    not_decided: "Not decided",
    unknown: "-",
  };

  return labels[raw] || value || "-";
}

function formatDocuments(value = "") {
  const raw = String(value || "").toLowerCase().trim();

  const labels = {
    yes: "Chha",
    no: "Chhaina",
    partial: "Kehi chha",
    ready: "Ready",
    available_later: "Available later",
    not_available: "Not available",
    unknown: "-",
  };

  return labels[raw] || value || "-";
}

function formatLocation(profile = {}) {
  const area = profile.location || profile.area || "";
  const district = profile.district || "";

  if (area && district) return `${area}, ${district}`;
  if (area) return area;
  if (district) return district;

  return "-";
}

export function buildWorkerProfileSummary(profile = {}) {
  const lines = [
    `- Kaam: ${formatJobPreference(profile.jobType)}`,
    `- Location: ${formatLocation(profile)}`,
    `- Availability: ${formatAvailability(profile.availability)}`,
    `- Documents: ${formatDocuments(profile.documents || profile.documentStatus)}`,
  ];

  if (profile.isApplyingToSelectedJob && profile.selectedJobTitle) {
    lines.push(
      `- Selected Job: ${profile.selectedJobTitle}${
        profile.selectedCompanyName ? ` @ ${profile.selectedCompanyName}` : ""
      }`
    );
  }

  return lines.join("\n");
}

export function buildWorkerCompletionMessage(profile = {}) {
  const hasSelectedJob = Boolean(profile.isApplyingToSelectedJob && profile.selectedJobTitle);

  if (hasSelectedJob) {
    return `Dhanyabaad 🙏 Tapai ko job interest submit bhayo.

📋 Tapai ko profile:
${buildWorkerProfileSummary(profile)}

JobMate team le yo job ko next step ko lagi 24-48 ghanta vitra sampark garchha.
Phone on rakhnu hola. 📞`;
  }

  return `Dhanyabaad 🙏 Tapai ko profile JobMate ma save bhayo.

📋 Tapai ko profile:
${buildWorkerProfileSummary(profile)}

Suitable kaam aayepachhi JobMate team le 24-48 ghanta vitra sampark garchha.
Phone on rakhnu hola. 📞`;
}
