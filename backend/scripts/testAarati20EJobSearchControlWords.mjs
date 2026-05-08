import assert from "node:assert/strict"
import { handleAaratiJobSearchControlGuard } from "../src/services/aarati/aaratiJobSearchControlGuard.service.js"

function conv(overrides = {}) {
  return {
    currentIntent: "job_search",
    currentState: "awaiting_job_search_query",
    metadata: {
      collectedData: {
        lastJobSearch: {
          query: {
            location: "Butwal",
            keyword: "marketing",
          },
        },
        pendingJobSearch: {
          location: "Butwal",
          jobType: "marketing",
        },
      },
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

console.log("\\n── AARATI-20E job-search control guard ──")

test("hus confirms using last search context", () => {
  const result = handleAaratiJobSearchControlGuard({ text: "hus", conversation: conv() })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.intent, "worker_registration")
  assert.equal(result.statePatch["metadata.collectedData.location"], "Butwal")
  assert.equal(result.statePatch["metadata.collectedData.jobType"], "marketing")
  assert.match(result.replyText, /Butwal marketing/)
})

test("ok hubxa confirms using last search context", () => {
  const result = handleAaratiJobSearchControlGuard({ text: "ok hubxa", conversation: conv() })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.intent, "worker_registration")
  assert.notEqual(result.statePatch["metadata.collectedData.area"], "ok hubxa")
})

test("job chaiyo confirms using last search context", () => {
  const result = handleAaratiJobSearchControlGuard({ text: "job chaiyo", conversation: conv() })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.intent, "worker_registration")
  assert.equal(result.statePatch["metadata.collectedData.area"], "Butwal")
})

test("start returns menu and does not continue job search", () => {
  const result = handleAaratiJobSearchControlGuard({ text: "start", conversation: conv() })
  assert.equal(result.shouldHandle, true)
  assert.equal(result.intent, "restart")
  assert.match(result.replyText, /JobMate ma swagat/)
})

test("driver is not control word", () => {
  const result = handleAaratiJobSearchControlGuard({ text: "driver", conversation: conv() })
  assert.equal(result.shouldHandle, false)
})

test("not job search state does not handle hus", () => {
  const result = handleAaratiJobSearchControlGuard({
    text: "hus",
    conversation: conv({ currentIntent: "unknown", currentState: "idle" }),
  })
  assert.equal(result.shouldHandle, false)
})

if (process.exitCode) {
  console.log("\\nAARATI-20E Tests failed")
  process.exit(process.exitCode)
}

console.log("\\nAARATI-20E Tests: all passed")
