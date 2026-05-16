function compact(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

const MENU_LIKE = /tapai lai kaam khojna ho ki staff|malai kaam chahiyo|malai staff chahiyo|kaam khojna ho ki staff/i;

export function reduceRepeatedAaratiReply({
  reply = "",
  conversation = {},
} = {}) {
  const lastReply =
    conversation?.metadata?.lastAaratiReply ||
    conversation?.metadata?.lastOutboundText ||
    "";

  if (!reply) return reply;

  const same = compact(reply) === compact(lastReply);
  const menuLike = MENU_LIKE.test(reply) && MENU_LIKE.test(lastReply);

  if (!same && !menuLike) return reply;

  return `Hajur 🙏 Ma repeat nagari sidha help garchu.

Tapai jobseeker ho bhane location ra kaam type pathaunu hola.
Employer ho bhane business name, location ra kasto staff chahiyo pathaunu hola.

Team sanga kura garna "team" lekhna saknuhunchha.`;
}
