import {
  parseHiringNeeds,
  formatHiringNeedsSummary,
} from "../src/services/rag/hiringNeedParser.service.js";

const cases = [
  {
    name: "marketing + cooking + driver + seller",
    text: "malai 5 jana ma 1 jana marketing 2 jana cooking helpers ani 1 jna driver 1 jana selling garne",
    expected: [
      ["marketing_staff", 1],
      ["kitchen_staff", 2],
      ["driver", 1],
      ["shopkeeper", 1],
    ],
  },
  {
    name: "driver helper frontend",
    text: "malsi 1 jana driver 2 jana helper 3 jana frontend developer",
    expected: [
      ["driver", 1],
      ["helper_staff", 2],
      ["frontend_developer", 3],
    ],
  },
  {
    name: "driver waiter marketing",
    text: "malai 1 jana marketing 2 jana waiter 3 jana drivers",
    expected: [
      ["marketing_staff", 1],
      ["waiter", 2],
      ["driver", 3],
    ],
  },
  {
    name: "cooking + marketing",
    text: "malai aauta chai marketing ani arko chai cooking chaiyako ho",
    expected: [
      ["marketing_staff", 1],
      ["kitchen_staff", 1],
    ],
  },
  {
    name: "single shopkeeper",
    text: "malai aauta dokan ma saman bechni manxe chaiya ko ho",
    expected: [
      ["shopkeeper", 1],
    ],
  },
  {
    name: "security guard",
    text: "2 jana security guard chahiyo",
    expected: [
      ["security_guard", 2],
    ],
  },
  {
    name: "field promoter",
    text: "print sticker haru aru lai didai hindxa gau gau ma jane manxe",
    expected: [
      ["field_promoter", 1],
    ],
  },
  {
    name: "street food vendor",
    text: "chaumin momo bechna sakos market market ma",
    expected: [
      ["street_food_vendor", 1],
    ],
  },
];

function sameNeeds(actual, expected) {
  const normalize = (items) =>
    items
      .map(([role, quantity]) => `${role}:${Number(quantity)}`)
      .sort()
      .join("|");

  const actualPairs = actual.map((item) => [item.role, item.quantity]);

  return normalize(actualPairs) === normalize(expected);
}

let failed = 0;

for (const testCase of cases) {
  const actual = parseHiringNeeds(testCase.text);
  const pass = sameNeeds(actual, testCase.expected);

  console.log(`\n${pass ? "✅" : "❌"} ${testCase.name}`);
  console.log("TEXT:", testCase.text);
  console.log("SUMMARY:\n" + formatHiringNeedsSummary(actual));

  if (!pass) {
    failed += 1;
    console.log("EXPECTED:", testCase.expected);
    console.log("ACTUAL:", actual.map((item) => [item.role, item.quantity]));
  }
}

console.log(`\nResult: ${cases.length - failed}/${cases.length} passed`);

if (failed > 0) {
  process.exit(1);
}
