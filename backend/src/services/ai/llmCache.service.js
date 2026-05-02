// Lightweight in-memory cache for LLM responses.
// This cache is per Node.js process and resets on deployment/restart.

import crypto from "crypto";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ITEMS = 1000;

const store = new Map();

let hits = 0;
let misses = 0;
let writes = 0;

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function normalizeInput(input) {
  if (typeof input === "string") {
    return input.trim().replace(/\s+/g, " ").toLowerCase();
  }

  return stableStringify(input);
}

export function makeLLMCacheKey(input, namespace = "aarati") {
  const normalized = normalizeInput({ namespace, input });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function getLLMCache(key) {
  const record = store.get(key);

  if (!record) {
    misses += 1;
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    store.delete(key);
    misses += 1;
    return null;
  }

  hits += 1;
  return record.value;
}

export function setLLMCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  pruneExpired();

  if (store.size >= DEFAULT_MAX_ITEMS) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }

  store.set(key, {
    value,
    createdAt: Date.now(),
    expiresAt: Date.now() + Number(ttlMs || DEFAULT_TTL_MS),
  });

  writes += 1;
  return value;
}

export async function getOrSetLLMCache({
  input,
  namespace = "aarati",
  ttlMs = DEFAULT_TTL_MS,
  factory,
} = {}) {
  const key = makeLLMCacheKey(input, namespace);
  const cached = getLLMCache(key);

  if (cached !== null && cached !== undefined) {
    return { value: cached, cacheHit: true, key };
  }

  const value = typeof factory === "function" ? await factory() : null;

  if (value !== null && value !== undefined && value !== "") {
    setLLMCache(key, value, ttlMs);
  }

  return { value, cacheHit: false, key };
}

export function clearLLMCache() {
  store.clear();
  hits = 0;
  misses = 0;
  writes = 0;
}

export function getLLMCacheStats() {
  const total = hits + misses;
  return {
    size: store.size,
    hits,
    misses,
    writes,
    hitRate: total ? Number((hits / total).toFixed(4)) : 0,
  };
}

function pruneExpired() {
  const now = Date.now();

  for (const [key, record] of store.entries()) {
    if (record.expiresAt <= now) {
      store.delete(key);
    }
  }
}
