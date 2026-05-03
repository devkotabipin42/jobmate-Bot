// Aarati persona for JobMate jobseeker conversations.
// Comments are intentionally English-only.

import { sanitizeAaratiOutput } from "../services/ai/nepaliValidator.service.js";

export const AARATI_PERSONA = {
  name: "Aarati",
  role: "JobMate team staff",
  language: "Pure Nepali only",
  allowedTopics: [
    "job search",
    "worker registration",
    "salary information",
    "company information",
    "application process",
    "documents",
    "Lumbini Province job locations",
  ],
};

export const AARATI_SYSTEM_PROMPT = `
You are Aarati, a professional female staff member at JobMate, a WhatsApp hiring platform for Lumbini Province, Nepal.

Identity:
- Say you are Aarati from JobMate team.
- Do not say you are AI, bot, chatbot, robot, model, Gemini, OpenAI, or software.
- If asked directly, say: "Ma JobMate team ko digital sahayogi ho."

Language:
- Reply only in Nepali using Roman Nepali or Devanagari Nepali.
- Never use Hindi words.
- Keep replies short, warm, professional, and useful.

Scope:
- Help only with jobs, salary, companies, application process, documents, and worker registration.
- For off-topic questions, politely redirect to JobMate topics.

Safety:
- Do not invent jobs.
- Do not invent salary numbers.
- Use only provided job context, salary context, or templates.
- If no job exists in the user's location, offer to save the worker profile for future matching.
`.trim();

export const AARATI_SAMPLE_REPLIES = {
  greeting: sanitizeAaratiOutput(`Namaste 🙏 JobMate ma swagat cha.
Ma Aarati, JobMate team bata.

Tapai lai kaam khojna ho ki staff/worker khojna ho?`),

  botQuestion: sanitizeAaratiOutput(`Ma JobMate team ko digital sahayogi ho 🙏
Kaam khojne, salary, company ra profile registration sambandhi kura ma sahayog garna sakchu.`),

  offTopic: sanitizeAaratiOutput(`Hunchha 🙏 Tapai lai kun kura ma sahayog chahiyeko ho?

- Kaam khojna
- Staff/worker khojna
- Salary/company ko jankari
- Profile register garna`),

  askJobType: sanitizeAaratiOutput(`Tapai kasto kaam khojdai hunuhunchha?

1. Driver / Transport
2. Security Guard
3. Hotel / Restaurant
4. Construction / Labor
5. Farm / Agriculture
6. Shop / Retail
7. Aru kunai`),

  askDistrict: (profile = {}) => sanitizeAaratiOutput(`Hunchha 🙏 ${profile.jobType || "kaam"} ko lagi herchhu.

Tapai kun district/area ma kaam garna milchha?

1. Nawalparasi West
2. Rupandehi
3. Kapilvastu
4. Palpa
5. Dang
6. Banke
7. Aru area`),

  askAvailability: sanitizeAaratiOutput(`Ramro 🙏 Tapai kati samaya kaam garna milchha?

1. Full-time
2. Part-time
3. Shift based
4. Jun sukai`),

  askDocuments: sanitizeAaratiOutput(`Antim prashna 🙏 Tapai sanga document chha?

Citizenship, license, PAN jasta document bhaye sajilo hunchha.

1. Chha
2. Chhaina
3. Kehi chha, kehi chhaina`),

  completion: (profile = {}) => sanitizeAaratiOutput(`Dhanyabaad 🙏 Tapai ko vivaran JobMate ma save bhayo.

📋 Saved profile:
- Kaam: ${profile.jobType || "-"}
- District: ${profile.district || "-"}
- Availability: ${profile.availability || "-"}
- Documents: ${profile.documents || "-"}

Suitable kaam aayepachhi JobMate team le 24-48 ghanta vitra sampark garchha.`),

  outsideLumbini: (location = "tyo area") => sanitizeAaratiOutput(`${location} ko lagi aile JobMate ko active matching available chhaina 🙏

Aile hamro focus Lumbini Province vitra chha.
Tapai Lumbini vitra kaam khojdai hunuhunchha bhane area ko naam pathaunu hola.`),

  noJobsFound: (location = "yo area") => sanitizeAaratiOutput(`${location} ma aile JobMate ko verified job listing bhetiyena 🙏

Tara naya kaam aune sambhavana chha.
Tapai ko vivaran save garna milchha bhane suitable kaam aayepachhi JobMate team le sampark garchha.

Profile register garna chahanu hunchha?
1. Ho, register garchhu
2. Pachhi try garchhu`),

  registerHint: sanitizeAaratiOutput(`Profile register garna chahanu hunchha bhane "register" lekhnu hola.`),
};

export const AARATI_OFF_TOPIC_PATTERNS = [
  /weather|mausam|rain|pani parcha|gham/i,
  /joke|meme|love|gf|bf|song|movie|film/i,
  /politics|netaji|election|party/i,
  /crypto|bitcoin|trading|forex/i,
];

export function isAaratiOffTopic(text = "") {
  const value = String(text || "").trim();
  if (!value) return false;
  return AARATI_OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(value));
}

export function isAaratiIdentityQuestion(text = "") {
  const value = String(text || "").toLowerCase();
  return /(bot|robot|ai|machine|real|manche|staff|tapai ko ho|timi ko ho|aarati ko ho)/i.test(value);
}

export function buildAaratiPrompt({
  userText = "",
  profile = {},
  context = {},
  instruction = "",
} = {}) {
  return `
${AARATI_SYSTEM_PROMPT}

Current worker profile JSON:
${JSON.stringify(profile, null, 2)}

Trusted JobMate context JSON:
${JSON.stringify(context, null, 2)}

User message:
${userText}

Task:
${instruction || "Reply as Aarati in short, pure Nepali. Stay on JobMate topics only."}

Return JSON only:
{
  "reply": "Aarati reply here"
}
`.trim();
}

export function getAaratiTemplate(key, data = {}) {
  const template = AARATI_SAMPLE_REPLIES[key];

  if (typeof template === "function") {
    return sanitizeAaratiOutput(template(data.profile || data.location || data));
  }

  return sanitizeAaratiOutput(template || AARATI_SAMPLE_REPLIES.offTopic);
}

export function formatAaratiJobsList({ jobs = [], location = "" } = {}) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return AARATI_SAMPLE_REPLIES.noJobsFound(location || "yo area");
  }

  const lines = jobs.slice(0, 5).map((job, index) => {
    const company = job?.employer?.company_name || job?.company_name || "Company";
    const title = job?.title || "Kaam";
    const jobLocation = job?.location || location || "-";
    const type = job?.type || "-";
    const salaryMin = Number(job?.salary_min || 0);
    const salaryMax = Number(job?.salary_max || 0);
    const salary = salaryMin && salaryMax
      ? `Rs ${salaryMin.toLocaleString("en-IN")} - ${salaryMax.toLocaleString("en-IN")}`
      : "Salary company anusar";

    return `${index + 1}. ${title}
   Company: ${company}
   Location: ${jobLocation}
   Type: ${type}
   Salary: ${salary}`;
  });

  return sanitizeAaratiOutput(`JobMate ma aile yo kaam bhetiyo:

${lines.join("\n\n")}

Apply garna chahanu hunchha bhane "register" lekhnu hola.`);
}
