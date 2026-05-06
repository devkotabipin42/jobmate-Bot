import { JOBMATE_KNOWLEDGE_TOPICS } from "../../data/knowledge/jobmateKnowledgePack.js";

function getText(normalized = {}) {
  return String(
    normalized?.message?.text ||
      normalized?.message?.normalizedText ||
      ""
  ).trim();
}

function shouldAnswerFromKnowledge(text = "") {
  const value = String(text || "").toLowerCase();

  if (!value || value.length < 3) return false;

  return /job\s*mate|jobmate|price|pricing|paisa|plan|basic|premium|free|document|privacy|safe|verify|badge|field agent|support|contact|founder|owner|company|ke ho|k ho|about|kasari.*kaam|kasari.*kam|asle/i.test(value);
}

export function findJobMateKnowledgeAnswer({ normalized } = {}) {
  const text = getText(normalized);

  if (!shouldAnswerFromKnowledge(text)) return null;

  if (/malai.*paisa.*chah|malai.*paisa.*chai|paisa chayako|paisa chaiyo|loan|rin|ऋण|सापटी/i.test(text)) {
    return null;
  }

  // Fair labor — should be refused by hard safety/gate, never routed to pricing
  if (/free.*ma.*ka{1,2}m.*garne.*worker|free.*labor|bina.*paisa.*ka{1,2}m|bina.*salary.*ka{1,2}m|free.*worker.*chahiyo|free.*staff.*chahiyo|trial.*ko.*paisa.*nadi|overtime.*paisa.*nadi|paisa.*nadin\b|salary.*nadin\b/i.test(text)) {
    return null;
  }

  // CV privacy — "mero cv sabai company lai" should answer data policy, not generic knowledge topic
  if (/cv.*sabai.*company|cv.*company.*dekaunu|cv.*share.*sabai|resume.*sabai.*company|mero.*cv.*sabai|cv.*baher.*pathau|cv.*leak|resume.*leak/i.test(text)) {
    return null;
  }

  for (const topic of JOBMATE_KNOWLEDGE_TOPICS) {
    const matched = topic.patterns.some((pattern) => pattern.test(text));

    if (matched) {
      return {
        topic: topic.key,
        answer: formatKnowledgeAnswer(topic.answer),
        source: "jobmate_knowledge_pack",
      };
    }
  }

  return null;
}

function formatKnowledgeAnswer(answer = "") {
  return `${answer}

Aba next step:
- Kaam khojna "malai kaam chahiyo" lekhnu hola
- Staff khojna "malai staff chahiyo" lekhnu hola
- Team sanga kura garna "team" lekhnu hola`;
}
