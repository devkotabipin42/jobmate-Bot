export const JOBMATE_MAIN_MENU_CONTEXT = "jobmate_main_menu";

export function buildJobMateMainMenuReply() {
  return [
    "Namaskar 🙏\nMa Aarati, JobMate Nepal team bata.",
    "1. Job khojna",
    "2. Staff khojna",
  ].join("\n");
}

export function buildUnavailableMainMenuSelectionReply() {
  return "Namaskar 🙏\nMa Aarati, JobMate Nepal team bata.\n\nTapai job khojna chahanu huncha ki staff/worker khojna?\n\n1. Job khojna\n2. Staff khojna\n\nTapai 1 ya 2 pathaunu hola.";
}

export function normalizeStartRestartMenuText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[।.!?,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isStartRestartMenuCommand(text = "") {
  const value = normalizeStartRestartMenuText(text);

  return new Set([
    "start",
    "restart",
    "menu",
    "hello",
    "hi",
    "hey",
    "namaste",
  ]).has(value);
}

export function getMainMenuSelection(text = "") {
  const value = normalizeStartRestartMenuText(text);
  return ["1", "2", "3"].includes(value) ? value : null;
}

export function hasMainMenuContext(conversation = {}) {
  return conversation?.metadata?.menuContext?.type === JOBMATE_MAIN_MENU_CONTEXT &&
    conversation?.metadata?.menuContext?.active === true;
}

export function hasNoActiveConversationState(conversation = {}) {
  const currentIntent = String(conversation?.currentIntent || "unknown");
  const currentState = String(conversation?.currentState || "idle");
  const metadata = conversation?.metadata || {};
  const collectedData = metadata.collectedData || {};

  return (
    ["", "unknown"].includes(currentIntent) &&
    ["", "idle"].includes(currentState) &&
    !metadata.lastAskedField &&
    !metadata.activeFlow &&
    !Object.keys(collectedData).length
  );
}

export function shouldHandleMainMenuSelection({ text = "", conversation = {} } = {}) {
  const selection = getMainMenuSelection(text);
  if (!selection) return false;

  return hasMainMenuContext(conversation) || hasNoActiveConversationState(conversation);
}

export function resolveMainMenuSelection(text = "") {
  const selection = getMainMenuSelection(text);

  if (selection === "1") {
    return {
      selection,
      intent: "worker_registration",
      flow: "worker",
      reason: "main_menu_worker_selection",
    };
  }

  if (selection === "2") {
    return {
      selection,
      intent: "employer_lead",
      flow: "employer",
      reason: "main_menu_employer_selection",
    };
  }

  if (selection === "3") {
    return {
      selection,
      intent: "unknown",
      flow: "unavailable",
      reason: "main_menu_unavailable_selection",
    };
  }

  return null;
}
