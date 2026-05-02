import locationMap from "../../data/locations/lumbini.locations.json" with { type: "json" };

export function resolveLumbiniLocation(input = "") {
  const text = normalize(input);
  if (!text) return null;

  const candidates = [];

  for (const location of locationMap) {
    for (const alias of location.aliases || []) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias) continue;

      if (containsLocationPhrase(text, normalizedAlias)) {
        candidates.push({
          ...location,
          matchedAlias: alias,
          matchedAliasNormalized: normalizedAlias,
          matchLength: normalizedAlias.length,
        });
      }
    }
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.matchLength !== a.matchLength) {
      return b.matchLength - a.matchLength;
    }

    const priority = { local: 3, district: 2, province: 1 };
    return (priority[b.scope] || 0) - (priority[a.scope] || 0);
  });

  const best = candidates[0];

  return {
    scope: best.scope,
    type: best.type,
    canonical: best.canonical,
    district: best.district || "",
    province: best.province || "Lumbini",
    aliases: best.aliases || [],
    allowedCanonicalLocations: best.allowedCanonicalLocations || [],
    matchedAlias: best.matchedAlias,
  };
}

export function getLocationSearchTerms(input = "") {
  const resolved = resolveLumbiniLocation(input);

  if (!resolved) {
    return [];
  }

  if (resolved.scope === "province") {
    return ["lumbini"];
  }

  const terms = [];

  for (const canonical of resolved.allowedCanonicalLocations || []) {
    const location = locationMap.find((item) => item.canonical === canonical);
    if (!location) continue;

    terms.push(location.canonical);
    terms.push(...(location.aliases || []));
  }

  if (resolved.scope === "district") {
    terms.push(resolved.canonical);
    terms.push(resolved.district);
    terms.push(...(resolved.aliases || []));
  }

  return unique(
    terms
      .filter(Boolean)
      .map(normalize)
      .filter(Boolean)
  );
}

export function isKnownLumbiniLocation(input = "") {
  return Boolean(resolveLumbiniLocation(input));
}

export function getAllLumbiniLocations() {
  return locationMap;
}

export function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[|/_,.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsLocationPhrase(text, phrase) {
  if (!text || !phrase) return false;

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const romanPattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");

  if (romanPattern.test(text)) return true;

  return text.includes(phrase);
}

function unique(items = []) {
  return [...new Set(items)];
}
