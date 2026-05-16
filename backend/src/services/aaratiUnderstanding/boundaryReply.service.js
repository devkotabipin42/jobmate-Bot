export function buildOutOfScopeReply() {
  return "Hajur 🙏 Yo kura JobMate ko main service bhitra direct pardaina. JobMate le job khojne worker ra staff khojne employer lai connect garna help garcha.\n\nTapai job khojna chahanu huncha ki staff khojna?";
}

export function buildRiskyReply(reason = "") {
  if (reason === "risky_underage_worker") {
    return "Maaf garnu hola 🙏 JobMate le underage worker match garna support gardaina. Legal age, safe kaam ra fair salary bhayeko hiring matra support garcha.";
  }

  if (reason === "risky_fake_documents") {
    return "Maaf garnu hola 🙏 Fake document banaune ya use garne kura JobMate ma mildaina. Verification ko lagi genuine document matra accept huncha.";
  }

  if (reason === "risky_illegal_work") {
    return "Maaf garnu hola 🙏 JobMate le illegal/unsafe kaam support gardaina. JobMate le legal, safe ra fair hiring matra support garcha.\n\nTapai lai kun help chahiyo?\n1. Job khojna\n2. Staff khojna";
  }

  return "Maaf garnu hola 🙏 Bina salary/free labor worker match garna mildaina. JobMate le legal ra fair salary bhayeko hiring matra support garcha.";
}

export function buildClarificationReply() {
  return "Maaf garnu hola 🙏 Maile clear bujhina. Tapai job khojna chahanu huncha ki staff hire garna chahanu huncha?\n\n1. Job khojna\n2. Staff khojna";
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
