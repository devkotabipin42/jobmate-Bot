import {
  handleJobMateLeadAgentMessage,
} from "../src/services/jobmateLeadAgent/jobmateLeadAgent.service.js";
import {
  findReplyPolicyIssues,
} from "../src/services/jobmateLeadAgent/replyFormatter.service.js";
import {
  leadDraftRequiresHumanApproval,
} from "../src/services/jobmateLeadAgent/leadDraft.service.js";

let failed = 0;
const replies = [];
const leadDrafts = [];
const taskDrafts = [];

const contact = {
  _id: "000000000000000000000001",
  phone: "9779800000000",
  displayName: "Mitra",
};

function assert(name, condition, details = "") {
  console.log(`\n${condition ? "PASS" : "FAIL"} ${name}`);

  if (!condition) {
    failed += 1;
    if (details) console.log(details);
  }
}

function makeConversation(state = null) {
  return {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: state
      ? {
          jobmateLeadAgent: state,
        }
      : {},
  };
}

function applyResult(conversation, result) {
  replies.push(result.reply || "");
  if (result.leadDraft) leadDrafts.push(result.leadDraft);
  if (result.taskDraft) taskDrafts.push(result.taskDraft);

  return {
    ...conversation,
    currentIntent: result.conversationIntent || "unknown",
    currentState: result.currentState || "idle",
    metadata: {
      ...(conversation.metadata || {}),
      jobmateLeadAgent: result.state,
      lastQuestion: result.reply,
    },
  };
}

async function turn(conversation, text) {
  const result = await handleJobMateLeadAgentMessage({
    contact,
    conversation,
    normalizedMessage: {
      message: {
        text,
        normalizedText: text.toLowerCase(),
        type: "text",
      },
    },
  });

  return {
    result,
    conversation: result.handled ? applyResult(conversation, result) : conversation,
  };
}

// 1. "job chahiyo" starts worker flow and asks details.
let conversation = makeConversation();
let out = await turn(conversation, "job chahiyo");
conversation = out.conversation;
assert(
  '1. "job chahiyo" starts worker flow and asks details',
  out.result.handled &&
    out.result.state.flow === "worker" &&
    /kun kaam|experience|available/i.test(out.result.reply),
  out.result.reply
);

// 2. Worker gives all details -> creates worker lead draft and task draft.
out = await turn(
  conversation,
  "mero naam Ram, phone 9840000000, age 24, waiter job Butwal ma, 2 years experience, immediate ready, expected salary 18000, documents cha, travel garna milcha"
);
conversation = out.conversation;
assert(
  "2. Worker details create worker lead draft and task draft",
  out.result.leadDraft?.type === "worker_lead" &&
    out.result.taskDraft?.type === "worker_lead_review" &&
    out.result.leadDraft?.approvalStatus === "pending_human_approval",
  JSON.stringify(out.result, null, 2)
);

// 3. "kaam khojdai chu" starts worker flow.
out = await turn(makeConversation(), "kaam khojdai chu");
assert(
  '3. "kaam khojdai chu" starts worker flow',
  out.result.handled && out.result.state.flow === "worker",
  out.result.reply
);

// 4. "staff chahiyo" starts employer flow and asks business details.
conversation = makeConversation();
out = await turn(conversation, "staff chahiyo");
conversation = out.conversation;
assert(
  '4. "staff chahiyo" starts employer flow and asks business details',
  out.result.handled &&
    out.result.state.flow === "employer" &&
    /business name|staff role|salary range/i.test(out.result.reply),
  out.result.reply
);

// 5. Employer gives all details -> creates employer lead draft and task draft.
out = await turn(
  conversation,
  "business name Lumbini Hotel, contact person Sita Sharma, phone 9850000000, 2 jana waiter staff, Butwal, salary 18000-22000, timing 10am-8pm, food cha accommodation chaina, urgent, 1 year experience, gender any, fee worker join bhayepachi"
);
conversation = out.conversation;
assert(
  "5. Employer details create employer lead draft and task draft",
  out.result.leadDraft?.type === "employer_lead" &&
    out.result.taskDraft?.type === "employer_requirement_review" &&
    out.result.leadDraft?.approvalStatus === "pending_human_approval",
  JSON.stringify(out.result, null, 2)
);

// 6. "malai waiter chahiyo" starts employer flow.
out = await turn(makeConversation(), "malai waiter chahiyo");
assert(
  '6. "malai waiter chahiyo" starts employer flow',
  out.result.handled && out.result.state.flow === "employer",
  out.result.reply
);

// 7. Sahakari partnership gives 30-day pilot language, not franchise-first.
conversation = makeConversation();
out = await turn(conversation, "sahakari partnership garna cha");
conversation = out.conversation;
assert(
  "7. Sahakari partnership gives 30-day pilot language",
  /30-day pilot/i.test(out.result.reply) && !/franchise-first/i.test(out.result.reply),
  out.result.reply
);

// 8. Sahakari details complete -> creates sahakari lead draft.
out = await turn(
  conversation,
  "sahakari name Lumbini Bachat Sahakari, area Butwal, contact person Sita Sharma, phone 9842222222, 800 members, business owner members chan, meeting Sunday 2 baje, pilot worker data collection"
);
conversation = out.conversation;
assert(
  "8. Sahakari details complete create sahakari lead draft",
  out.result.leadDraft?.type === "sahakari_lead" &&
    out.result.leadDraft?.approvalStatus === "pending_human_approval" &&
    out.result.leadDraft?.data?.pilotLengthDays === 30,
  JSON.stringify(out.result, null, 2)
);

// 9. During worker flow, "paisa lagcha?" answers free and returns to current step.
conversation = makeConversation();
out = await turn(conversation, "job chahiyo");
conversation = out.conversation;
const stepBefore = conversation.metadata.jobmateLeadAgent.step;
out = await turn(conversation, "paisa lagcha?");
conversation = out.conversation;
assert(
  '9. Worker flow "paisa lagcha?" answers free and returns to current step',
  /free/i.test(out.result.reply) &&
    /kun kaam|experience|available/i.test(out.result.reply) &&
    out.result.state.flow === "worker" &&
    out.result.state.step === stepBefore,
  out.result.reply
);

// 10. "job guarantee huncha?" says no guarantee.
out = await turn(makeConversation(), "job guarantee huncha?");
assert(
  '10. "job guarantee huncha?" says no guarantee',
  /job guarantee hudaina/i.test(out.result.reply),
  out.result.reply
);

// 11. "staff ready cha?" says verified profiles only after requirement confirmation.
out = await turn(makeConversation(), "staff ready cha?");
assert(
  '11. "staff ready cha?" requires confirmed requirement before verified profiles',
  /requirement confirm/i.test(out.result.reply) && /verified profiles/i.test(out.result.reply),
  out.result.reply
);

// 12. "JobMate ke ho?" uses RAG/knowledge answer.
out = await turn(makeConversation(), "JobMate ke ho?");
assert(
  '12. "JobMate ke ho?" uses RAG/knowledge answer',
  out.result.source === "jobmate_rag" &&
    /Lumbini-focused local hiring support service/i.test(out.result.reply),
  JSON.stringify(out.result, null, 2)
);

// 13. "start" resets flow.
conversation = makeConversation();
out = await turn(conversation, "staff chahiyo");
conversation = out.conversation;
out = await turn(conversation, "start");
conversation = out.conversation;
assert(
  '13. "start" resets flow',
  out.result.intent === "reset" &&
    out.result.state.flow === null &&
    conversation.currentState === "idle",
  JSON.stringify(out.result, null, 2)
);

// 14. No AI/provider/model/Gemini words in replies.
const techIssues = replies
  .map((reply, index) => ({ index, reply, issues: findReplyPolicyIssues(reply) }))
  .filter((item) => item.issues.includes("tech_word"));
assert(
  "14. No AI/provider/model/Gemini words in replies",
  techIssues.length === 0,
  JSON.stringify(techIssues, null, 2)
);

// 15. No Hindi words in replies.
const hindiIssues = replies
  .map((reply, index) => ({ index, reply, issues: findReplyPolicyIssues(reply) }))
  .filter((item) => item.issues.includes("hindi_word"));
assert(
  "15. No Hindi words in replies",
  hindiIssues.length === 0,
  JSON.stringify(hindiIssues, null, 2)
);

// 16. All lead drafts require human approval.
assert(
  "16. All lead drafts require human approval",
  leadDrafts.length >= 3 && leadDrafts.every(leadDraftRequiresHumanApproval),
  JSON.stringify(leadDrafts, null, 2)
);

// 17. Payment/settlement not finalized by bot.
const allDrafts = [...leadDrafts, ...taskDrafts];
assert(
  "17. Payment/settlement not finalized by bot",
  allDrafts.length >= 5 &&
    allDrafts.every((draft) => draft.paymentSettlement?.finalizedByBot === false),
  JSON.stringify(allDrafts, null, 2)
);

console.log(`\nResult: ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`}`);

if (failed > 0) process.exit(1);
