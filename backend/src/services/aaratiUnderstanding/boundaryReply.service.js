export function buildOutOfScopeReply() {
  return "Mitra ji, yo JobMate ko kaam bhanda bahira parcha 🙏 JobMate le job khojne worker ra staff khojne employer lai connect garne kaam garcha. Tapai job khojna ho ki staff khojna?";
}

export function buildRiskyReply(reason = "") {
  if (reason === "risky_underage_worker") {
    return "Mitra ji, underage worker match garna JobMate le support gardaina 🙏 Legal age, safe kaam ra fair salary bhayeko hiring matra support garchha.";
  }

  if (reason === "risky_fake_documents") {
    return "Mitra ji, fake document banaune ya use garne kura JobMate ma mildaina 🙏 Verification ko lagi genuine document matra accept huncha.";
  }

  if (reason === "risky_illegal_work") {
    return "Mitra ji, illegal ya unsafe kaam ko lagi JobMate le support gardaina 🙏 Legal, safe ra verified job/hiring kura ma matra help garna milcha.";
  }

  return "Mitra ji, bina salary/free labor worker match garna mildaina 🙏 JobMate le legal ra fair salary bhayeko hiring matra support garcha.";
}

export function buildClarificationReply() {
  return "Mitra ji, maile clear bujhina 🙏 Tapai job khojna chahanu huncha ki staff hire garna chahanu huncha? 1. Job khojna 2. Staff khojna";
}

export function buildJobGuaranteeReply() {
  return "JobMate le job guarantee dina sakdaina 🙏 Tara tapai ko profile, location ra kaam type ko adhar ma suitable employer sanga connect garna help garcha.";
}

export function buildWorkerFeeReply() {
  return "Worker registration ra job search JobMate ma free ho 🙏 Tapai bata registration fee linna.";
}

export function buildBoundaryReply({ scopeResult = {} } = {}) {
  if (scopeResult.scope === "risky_or_disallowed") {
    return buildRiskyReply(scopeResult.reason);
  }

  if (scopeResult.scope === "outside_jobmate") {
    return buildOutOfScopeReply();
  }

  return buildClarificationReply();
}
