import assert from "node:assert/strict"
import { detectAaratiEmployerIntentRecovery } from "../src/services/aarati/aaratiEmployerIntentRecovery.service.js"

function conv(overrides = {}) {
  return {
    currentIntent: "unknown",
    currentState: "idle",
    metadata: {
      collectedData: {},
    },
    ...overrides,
  }
}

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

console.log("\\n── AARATI-20F employer intent recovery ──")

test("malai aauta manxe chayako theo => employer_lead", () => {
  const result = detectAaratiEmployerIntentRecovery({
    text: "malai aauta manxe chayako theo",
    conversation: conv(),
  })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.intent, "employer_lead")
  assert.equal(result.state, "ask_vacancy_role")
  assert.match(result.replyText, /Kasto role ko staff/)
})

test("staff kojna => employer_lead", () => {
  const result = detectAaratiEmployerIntentRecovery({
    text: "staff kojna",
    conversation: conv(),
  })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.statePatch.currentIntent, "employer_lead")
})

test("worker chahiyo => employer_lead", () => {
  const result = detectAaratiEmployerIntentRecovery({
    text: "worker chahiyo",
    conversation: conv(),
  })
  assert.equal(result.shouldHandle, true)
})

test("marketing alone should not trigger employer recovery", () => {
  const result = detectAaratiEmployerIntentRecovery({
    text: "marketing",
    conversation: conv(),
  })
  assert.equal(result.shouldHandle, false)
})

test("follow-up active should not be hijacked", () => {
  const result = detectAaratiEmployerIntentRecovery({
    text: "staff chahiyo",
    conversation: conv({
      metadata: {
        collectedData: {
          awaitingFollowupReply: true,
        },
      },
    }),
  })
  assert.equal(result.shouldHandle, false)
})

if (process.exitCode) {
  console.log("\\nAARATI-20F Tests failed")
  process.exit(process.exitCode)
}

console.log("\\nAARATI-20F Tests: all passed")
