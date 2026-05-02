import axios from "axios";
import { env } from "../../config/env.js";

export async function sendTelegramAlert(text) {
  if (
    !env.TELEGRAM_BOT_TOKEN ||
    env.TELEGRAM_BOT_TOKEN === "replace_later" ||
    !env.TELEGRAM_ADMIN_CHAT_ID ||
    env.TELEGRAM_ADMIN_CHAT_ID === "replace_later"
  ) {
    console.log("⚠️ Telegram alert skipped: credentials not configured");
    console.log(text);

    return {
      skipped: true,
      reason: "TELEGRAM_CREDENTIALS_NOT_CONFIGURED",
    };
  }

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await axios.post(
    url,
    {
      chat_id: env.TELEGRAM_ADMIN_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
    {
      timeout: 10000,
    }
  );

  return {
    skipped: false,
    providerResponse: response.data,
  };
}

export function buildEmployerLeadAlert({ contact, employerLead, handoff }) {
  const need = employerLead?.hiringNeeds?.[0];

  return `🚨 <b>URGENT EMPLOYER LEAD</b>

🏢 Business: ${safe(employerLead?.businessName)}
👤 Contact: ${safe(employerLead?.contactPerson || contact?.displayName)}
📞 Phone: ${safe(employerLead?.phone || contact?.phone)}
📍 Area: ${safe(employerLead?.location?.area)}
🏷 District: ${safe(employerLead?.location?.district)}

👥 Need: ${safe(need?.quantity)} ${safe(need?.role)}
⚡ Urgency: ${safe(employerLead?.urgencyLevel)}
🔥 Status: ${safe(employerLead?.leadStatus)}
⭐ Score: ${safe(employerLead?.score)}/100

📌 Handoff: ${safe(handoff?.reason)}
☎️ Call Required: ${handoff?.callRequired ? "Yes" : "No"}

Action: Call this employer as soon as possible.`;
}

export function buildWorkerQualifiedAlert({ contact, worker, handoff }) {
  return `🎯 <b>QUALIFIED WORKER</b>

👤 Name: ${safe(worker?.fullName || contact?.displayName)}
📞 Phone: ${safe(worker?.phone || contact?.phone)}
📍 District: ${safe(worker?.location?.district)}
💼 Preference: ${safe(worker?.jobPreferences?.join(", "))}
⏰ Availability: ${safe(worker?.availability)}
📄 Document: ${safe(worker?.documentStatus)}
⭐ Score: ${safe(worker?.score)}/100

📌 Handoff: ${safe(handoff?.reason)}
☎️ Call Required: ${handoff?.callRequired ? "Yes" : "No"}

Action: Review and match with open employer leads.`;
}

function safe(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
