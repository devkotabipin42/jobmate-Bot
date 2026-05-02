import mongoose from "mongoose";
import { ResolvedLocation } from "../../models/ResolvedLocation.model.js";
import { UnknownLocation } from "../../models/UnknownLocation.model.js";
import {
  resolveLumbiniLocation,
  normalize,
} from "../jobmate/lumbiniLocation.service.js";
import { geocodeWithMapbox } from "./mapboxGeocoder.service.js";

const LUMBINI_DISTRICTS = [
  "nawalparasi",
  "nawalparasi west",
  "rupandehi",
  "kapilvastu",
  "palpa",
  "arghakhanchi",
  "gulmi",
  "dang",
  "banke",
  "bardiya",
  "pyuthan",
  "rolpa",
  "rukum east",
];

export async function resolveJobMateLocationSmart(input = "") {
  const query = String(input || "").trim();
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return null;

  const localResolved = resolveLumbiniLocation(query);

  if (localResolved) {
    return {
      source: "local_map",
      isKnown: true,
      isInsideLumbini: true,
      canonical: localResolved.canonical,
      district: localResolved.district,
      province: localResolved.province,
      scope: localResolved.scope,
      type: localResolved.type,
      matchedAlias: localResolved.matchedAlias,
      confidence: 0.95,
      resolvedLocation: localResolved,
    };
  }

  const isMongoConnected = mongoose.connection.readyState === 1;

  if (isMongoConnected) {
    const cached = await ResolvedLocation.findOne({ normalizedQuery }).lean();

    if (cached) {
      await ResolvedLocation.updateOne(
        { normalizedQuery },
        { $set: { lastUsedAt: new Date() } }
      );

      return {
        source: "location_cache",
        isKnown: true,
        isInsideLumbini: Boolean(cached.isInsideLumbini),
        canonical: cached.canonical,
        district: cached.district,
        province: cached.province,
        latitude: cached.latitude,
        longitude: cached.longitude,
        confidence: cached.confidence,
        resolvedLocation: cached.isInsideLumbini
          ? {
              scope: "local",
              type: "local",
              canonical: cached.canonical,
              district: cached.district,
              province: "Lumbini",
              aliases: [query],
              allowedCanonicalLocations: [cached.canonical],
              matchedAlias: query,
            }
          : null,
      };
    }
  }

  const geo = await geocodeWithMapbox(query);

  if (!geo) {
    if (isMongoConnected) {
      await UnknownLocation.findOneAndUpdate(
        { normalizedQuery },
        {
          $setOnInsert: {
            query,
            normalizedQuery,
            guessedCountry: "Nepal",
            status: "pending_review",
          },
          $set: {
            lastSeenAt: new Date(),
          },
          $inc: {
            count: 1,
          },
        },
        { upsert: true, returnDocument: "after" }
      );
    }

    return {
      source: "mapbox_unknown",
      isKnown: false,
      isInsideLumbini: false,
      isPossiblyLocalNepal: true,
      canonical: query,
      district: "",
      province: "",
      confidence: 0.35,
      resolvedLocation: null,
    };
  }

  const isInsideLumbini = looksInsideLumbini(geo);
  const clearlyOutsideLumbini = !isInsideLumbini && isClearlyOutsideLumbini(geo);

  if (isMongoConnected) {
    await ResolvedLocation.findOneAndUpdate(
      { normalizedQuery },
      {
        $set: {
          query,
          normalizedQuery,
          provider: geo.provider,
          canonical: geo.canonical || query,
          district: geo.district || "",
          province: geo.province || "",
          country: geo.country || "Nepal",
          latitude: geo.latitude,
          longitude: geo.longitude,
          confidence: geo.confidence || 0.6,
          isInsideLumbini,
          raw: geo.raw || {},
          lastUsedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );
  }

  return {
    source: isInsideLumbini
      ? "mapbox"
      : clearlyOutsideLumbini
        ? "mapbox_outside_lumbini"
        : "mapbox_unknown",
    isKnown: true,
    isInsideLumbini,
    isClearlyOutsideLumbini: clearlyOutsideLumbini,
    isPossiblyLocalNepal: !isInsideLumbini && !clearlyOutsideLumbini,
    canonical: geo.canonical || query,
    district: geo.district || "",
    province: geo.province || "",
    latitude: geo.latitude,
    longitude: geo.longitude,
    confidence: geo.confidence || 0.6,
    resolvedLocation: isInsideLumbini
      ? {
          scope: "local",
          type: "local",
          canonical: geo.canonical || query,
          district: geo.district || "",
          province: "Lumbini",
          aliases: [query],
          allowedCanonicalLocations: [geo.canonical || query],
          matchedAlias: query,
        }
      : null,
  };
}

function looksInsideLumbini(geo = {}) {
  const text = normalize(
    [
      geo.canonical,
      geo.district,
      geo.province,
      geo.country,
      JSON.stringify(geo.raw?.properties?.context || {}),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!text.includes("nepal")) return false;
  if (text.includes("lumbini")) return true;

  return LUMBINI_DISTRICTS.some((district) => text.includes(district));
}


function isClearlyOutsideLumbini(geo = {}) {
  const text = normalize(
    [
      geo.canonical,
      geo.district,
      geo.province,
      geo.country,
      JSON.stringify(geo.raw?.properties?.context || {}),
    ]
      .filter(Boolean)
      .join(" ")
  );

  const confidence = Number(geo.confidence || 0);

  if (!text.includes("nepal")) return true;
  if (text.includes("lumbini")) return false;

  // Only treat as outside when Mapbox confidently found a known non-Lumbini province/district.
  const outsideSignals = [
    "gandaki",
    "bagmati",
    "koshi",
    "madhesh",
    "karnali",
    "sudurpaschim",
    "kaski",
    "kathmandu",
    "lalitpur",
    "bhaktapur",
    "chitwan",
    "morang",
    "sunsari",
  ];

  return confidence >= 0.7 && outsideSignals.some((word) => text.includes(word));
}
