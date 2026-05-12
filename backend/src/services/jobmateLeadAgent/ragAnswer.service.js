import { findJobMateKnowledgeAnswer } from "../rag/jobmateKnowledgeAnswer.service.js";
import { formatReply } from "./replyFormatter.service.js";

export function getJobMateLeadAgentRagAnswer({ normalizedMessage } = {}) {
  const normalized = normalizeForRag(normalizedMessage);
  const answer = findJobMateKnowledgeAnswer({ normalized });

  if (!answer) return null;

  const reply =
    answer.topic === "what_is_jobmate"
      ? "JobMate Nepal Lumbini-focused local hiring support service ho. Hami job khojne worker ra staff chahine employer lai connect garna help garchhau. Worker registration free ho. Suitable demand aaye pachi JobMate team le follow-up garcha."
      : answer.answer;

  return {
    topic: answer.topic,
    source: "jobmate_rag",
    reply: formatReply(reply),
  };
}

function normalizeForRag(normalizedMessage = {}) {
  const message = normalizedMessage?.message || normalizedMessage || {};
  const text = String(message.text || message.normalizedText || "").trim();

  return {
    message: {
      text,
      normalizedText: String(message.normalizedText || text).toLowerCase(),
    },
  };
}
