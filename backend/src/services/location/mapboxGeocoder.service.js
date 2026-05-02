import axios from "axios";

const MAPBOX_BASE_URL = "https://api.mapbox.com/search/geocode/v6/forward";

export async function geocodeWithMapbox(query = "") {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  const q = String(query || "").trim();

  if (!q) return null;

  if (!token) {
    console.warn("⚠️ MAPBOX_ACCESS_TOKEN is missing. Skipping Mapbox geocoding.");
    return null;
  }

  // Important:
  // Do NOT force ", Lumbini, Nepal" here.
  // That caused false positives like "Pokhara" resolving inside Lumbini.
  const queryVariants = [
    q,
    `${q}, Nepal`,
  ];

  for (const searchText of queryVariants) {
    const result = await searchMapboxOnce({ q, searchText, token });
    if (result) return result;
  }

  return null;
}

async function searchMapboxOnce({ q, searchText, token }) {
  try {
    const response = await axios.get(MAPBOX_BASE_URL, {
      timeout: Number(process.env.LOCATION_TIMEOUT_MS || 3500),
      params: {
        q: searchText,
        access_token: token,
        country: "np",
        language: "en",
        limit: 5,
      },
    });

    const features = response.data?.features || [];
    if (!features.length) return null;

    const relevantFeatures = features
      .map((feature) => ({
        feature,
        relevanceScore: getFeatureRelevanceScore(q, feature),
      }))
      .filter((item) => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (!relevantFeatures.length) {
      console.warn("⚠️ Mapbox returned only irrelevant candidates:", {
        query: q,
        searchText,
        firstCandidate: features[0]?.properties?.name || features[0]?.properties?.full_address || "",
      });
      return null;
    }

    const best = relevantFeatures[0].feature;
    const coordinates = best.geometry?.coordinates || [];
    const props = best.properties || {};
    const context = props.context || {};

    const province =
      context.region?.name ||
      context.region?.region_code ||
      "";

    const district =
      context.district?.name ||
      context.place?.name ||
      "";

    return {
      provider: "mapbox",
      canonical: props.name || props.full_address || q,
      district,
      province,
      country: context.country?.name || "Nepal",
      longitude: coordinates[0],
      latitude: coordinates[1],
      confidence: getConfidence(props, relevantFeatures[0].relevanceScore),
      raw: best,
    };
  } catch (error) {
    console.warn("⚠️ Mapbox geocoding failed:", {
      query: q,
      searchText,
      message: error?.message,
      status: error?.response?.status,
    });

    return null;
  }
}

function getFeatureRelevanceScore(query = "", feature = {}) {
  const q = normalize(query);
  const props = feature.properties || {};

  const name = normalize(props.name || "");
  const fullAddress = normalize(props.full_address || "");
  const placeFormatted = normalize(props.place_formatted || "");
  const mapboxId = normalize(props.mapbox_id || "");

  if (!q) return 0;

  // Exact/near exact name match is best.
  if (name === q) return 100;

  // Good for spelling with spaces: "gopi ganj" vs "gopiganj".
  if (compact(name) === compact(q)) return 95;

  // Address contains exact query phrase.
  if (containsPhrase(fullAddress, q)) return 80;
  if (containsPhrase(placeFormatted, q)) return 70;

  // Query contains result name, but avoid accepting broad fallback like "Lumbini".
  if (name && q.includes(name) && name.length >= 5) return 50;

  // Avoid false positives like:
  // q = "gopigunj", result = "Lumbini"
  // q = "pokhara", result = "Lumbini"
  if (["lumbini", "nepal", "lumbini province"].includes(name)) return 0;

  // mapbox_id sometimes includes useful place tokens.
  if (mapboxId.includes(compact(q))) return 30;

  return 0;
}

function getConfidence(props = {}, relevanceScore = 0) {
  const confidence = props.match_code?.confidence;

  if (confidence === "exact") return 0.9;
  if (relevanceScore >= 90) return 0.85;
  if (relevanceScore >= 70) return 0.7;
  if (relevanceScore >= 50) return 0.6;

  return 0.5;
}

function containsPhrase(text = "", phrase = "") {
  if (!text || !phrase) return false;

  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i");

  return pattern.test(text);
}

function normalize(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[|/_,.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value = "") {
  return normalize(value).replace(/\s+/g, "");
}
