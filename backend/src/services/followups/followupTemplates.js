// Follow-up templates for Aarati.
// Keep these short and professional.

export const FOLLOWUP_TEMPLATES = {
  worker_profile_thank_you: ({ name = "hajur", role = "kaam", location = "tapai ko area" } = {}) =>
    `Namaste ${name} 🙏

Tapai ko JobMate profile save bhayeko chha.

Kaam: ${role}
Location: ${location}

Suitable kaam aayepachhi JobMate team le sampark garchha.
Phone on rakhnu hola. 📞`,

  employer_lead_thank_you: ({ businessName = "tapai ko business" } = {}) =>
    `Namaste 🙏

${businessName} ko hiring request JobMate team le receive gareko chha.

Hamro HR team le details verify garna chhittai sampark garchha.
Phone on rakhnu hola. 📞`,

  job_application_followup: ({ jobTitle = "job", companyName = "company" } = {}) =>
    `Namaste 🙏

Tapai le ${jobTitle} @ ${companyName} ma interest submit garnubhako chha.

JobMate team le next step ko lagi sampark garchha.
Phone on rakhnu hola. 📞`,

  stale_profile_check: ({ name = "hajur" } = {}) =>
    `Namaste ${name} 🙏

Tapai ahile pani kaam khojdai hunuhunchha?

Yedi khojdai hunuhunchha bhane "ho" lekhnu hola.
Yedi kaam paaisaknu bhayo bhane "paaye" lekhnu hola.`,
};

export function buildFollowupMessage(templateName, templateData = {}) {
  const template = FOLLOWUP_TEMPLATES[templateName];

  if (!template) {
    return "";
  }

  return template(templateData);
}
