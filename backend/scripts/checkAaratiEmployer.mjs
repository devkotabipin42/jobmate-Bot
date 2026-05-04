import { spawnSync } from "child_process";

const checks = [
  ["node", ["--check", "src/controllers/whatsapp.controller.js"]],
  ["node", ["--check", "src/routes/adminWorkerMatch.routes.js"]],
  ["node", ["--check", "src/controllers/adminWorkerMatch.controller.js"]],
  ["node", ["--check", "src/services/matching/workerMatching.service.js"]],
  ["node", ["--check", "src/routes/adminJobApplication.routes.js"]],
  ["node", ["--check", "src/controllers/adminJobApplication.controller.js"]],
  ["node", ["--check", "src/routes/adminEmployerLeadVerification.routes.js"]],
  ["node", ["--check", "src/controllers/adminEmployerLeadVerification.controller.js"]],
  ["node", ["--check", "src/services/automation/employerLead.service.js"]],
  ["node", ["--check", "src/services/automation/employer/employerLeadMessages.js"]],
  ["node", ["--check", "src/services/automation/employer/employerLeadSummary.service.js"]],
  ["node", ["--check", "src/services/automation/employer/employerLeadRepository.service.js"]],
  ["node", ["--check", "src/services/automation/employer/employerLeadMapper.service.js"]],
  ["node", ["--check", "src/services/automation/jobmateRoutingGuards.service.js"]],
  ["node", ["--check", "src/services/rag/hiringNeedParser.service.js"]],
  ["node", ["--check", "src/models/PendingKnowledge.model.js"]],
  ["node", ["scripts/testJobApplicationService.mjs"]],
  ["node", ["--check", "src/services/jobmate/jobApplication.service.js"]],
  ["node", ["--check", "src/models/JobApplication.model.js"]],
  ["node", ["--check", "src/services/rag/pendingKnowledge.service.js"]],
  ["node", ["--check", "src/services/rag/applyPendingKnowledge.service.js"]],
  ["node", ["--check", "src/services/rag/knowledgeLearning.service.js"]],
  ["node", ["--check", "src/services/rag/jobmateKnowledge.service.js"]],
  ["node", ["--check", "src/services/ai/aaratiBrain.service.js"]],
  ["node", ["--check", "src/services/ai/aaratiBrainGate.service.js"]],
  ["node", ["scripts/testAaratiEmployerCore.mjs"]],
  ["node", ["scripts/testHiringNeedParser.mjs"]],
  ["node", ["scripts/testJobseekerCore.mjs"]],
  ["node", ["scripts/testJobseekerSafety.mjs"]],
  ["node", ["scripts/testJobseekerApplicationFlow.mjs"]],
  ["node", ["scripts/testWorkerProfileMapper.mjs"]],
  ["node", ["--check", "src/services/jobmate/workerProfileMapper.service.js"]],
  ["node", ["scripts/testEmployerLeadFlowV2.mjs"]],
];

let failed = 0;

for (const [cmd, args] of checks) {
  const label = `${cmd} ${args.join(" ")}`;
  console.log(`\n▶ ${label}`);

  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    failed += 1;
    console.error(`❌ Failed: ${label}`);
    break;
  }

  console.log(`✅ Passed: ${label}`);
}

if (failed > 0) {
  console.error("\n❌ Aarati employer stability check failed.");
  process.exit(1);
}

console.log("\n✅ Aarati employer stability check passed.");
