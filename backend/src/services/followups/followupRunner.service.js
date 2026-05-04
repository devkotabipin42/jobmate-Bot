import { env } from "../../config/env.js";
import { processDueFollowups } from "./followupProcessor.service.js";

let runnerTimer = null;
let isProcessing = false;

export function startFollowupRunner() {
  if (!env.FOLLOWUP_PROCESSOR_ENABLED) {
    console.log("⏸️ Follow-up processor disabled");
    return null;
  }

  if (runnerTimer) {
    return runnerTimer;
  }

  const intervalMs = Number(env.FOLLOWUP_PROCESSOR_INTERVAL_MS || 60000);

  console.log(`✅ Follow-up processor enabled. Interval: ${intervalMs}ms`);

  runnerTimer = setInterval(async () => {
    if (isProcessing) {
      console.log("⏳ Follow-up processor skipped: previous run still active");
      return;
    }

    isProcessing = true;

    try {
      const result = await processDueFollowups({
        limit: 25,
        dryRun: false,
      });

      if (result.scanned > 0 || result.failed > 0) {
        console.log("✅ Follow-up processor run:", result);
      }
    } catch (error) {
      console.error("❌ Follow-up processor run failed:", error.message);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);

  runnerTimer.unref?.();

  return runnerTimer;
}

export function stopFollowupRunner() {
  if (runnerTimer) {
    clearInterval(runnerTimer);
    runnerTimer = null;
  }

  isProcessing = false;
}
