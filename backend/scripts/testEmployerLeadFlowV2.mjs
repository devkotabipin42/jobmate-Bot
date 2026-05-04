import { handleEmployerLeadFlowV2 } from "../src/services/automation/employer/employerLeadFlow.v2.service.js";


function makeConversation(step = 0, state = "idle", metadata = {}) {
  return {
    currentState: state,
    metadata: {
      qualificationStep: step,
      ...metadata,
    },
  };
}

function makeMessage(text) {
  return {
    message: {
      text,
      normalizedText: text.toLowerCase(),
    },
  };
}

const contact = {
  _id: "000000000000000000000001",
  phone: "test-phone",
  displayName: "",
};

const tests = [
  {
    name: "step 0 asks company",
    args: {
      contact,
      conversation: makeConversation(0, "idle"),
      normalizedMessage: makeMessage("malai staff chaiyo"),
      aaratiBrain: {},
      dryRun: true,
    },
    expect: {
      nextStep: 1,
      currentState: "ask_business_name",
    },
  },
  {
    name: "step 2 multi-role asks location",
    args: {
      contact,
      conversation: makeConversation(2, "ask_vacancy"),
      normalizedMessage: makeMessage("1 jana marketing 2 jana driver 3 jana waiter"),
      aaratiBrain: {},
      dryRun: true,
    },
    expect: {
      nextStep: 3,
      currentState: "ask_location",
    },
  },
];

let failed = 0;

for (const test of tests) {
  try {
    const result = await handleEmployerLeadFlowV2(test.args);

    const pass =
      result.nextStep === test.expect.nextStep &&
      result.currentState === test.expect.currentState;

    console.log(`\n${pass ? "✅" : "❌"} ${test.name}`);

    if (!pass) {
      failed += 1;
      console.log("Expected:", test.expect);
      console.log("Actual:", {
        nextStep: result.nextStep,
        currentState: result.currentState,
        messageToSend: result.messageToSend,
      });
    }
  } catch (error) {
    failed += 1;
    console.log(`\n❌ ${test.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} V2 tests failed`);
  process.exit(1);
}

console.log("\n✅ EmployerLeadFlow V2 tests passed");
