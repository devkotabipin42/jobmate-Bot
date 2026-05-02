import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

function clean(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}

const rawEnv = {
  NODE_ENV: clean(process.env.NODE_ENV) || "development",
  PORT: clean(process.env.PORT) || "5000",
  MONGODB_URI: clean(process.env.MONGODB_URI),
  FRONTEND_URL: clean(process.env.FRONTEND_URL) || "http://localhost:5173",
  META_VERIFY_TOKEN: clean(process.env.META_VERIFY_TOKEN),
  META_ACCESS_TOKEN: clean(process.env.META_ACCESS_TOKEN),
  META_PHONE_NUMBER_ID: clean(process.env.META_PHONE_NUMBER_ID),
  TELEGRAM_BOT_TOKEN: clean(process.env.TELEGRAM_BOT_TOKEN),
  TELEGRAM_ADMIN_CHAT_ID: clean(process.env.TELEGRAM_ADMIN_CHAT_ID),

  JOBMATE_API_BASE_URL: clean(process.env.JOBMATE_API_BASE_URL),

  GEMINI_API_KEY: clean(process.env.GEMINI_API_KEY),
  GEMINI_MODEL: clean(process.env.GEMINI_MODEL) || "gemini-1.5-flash",

  OPENAI_API_KEY: clean(process.env.OPENAI_API_KEY),
  OPENAI_MODEL: clean(process.env.OPENAI_MODEL) || "gpt-4o-mini",

  AI_PRIMARY_PROVIDER: clean(process.env.AI_PRIMARY_PROVIDER) || "gemini",
  AI_FALLBACK_PROVIDER: clean(process.env.AI_FALLBACK_PROVIDER) || "openai",
  AI_TIMEOUT_MS: clean(process.env.AI_TIMEOUT_MS) || "2500",
  AI_COOLDOWN_ON_429_MS: clean(process.env.AI_COOLDOWN_ON_429_MS) || "120000",

  ADMIN_PASSWORD: clean(process.env.ADMIN_PASSWORD) || "jobmate123",
  ADMIN_AUTH_TOKEN: clean(process.env.ADMIN_AUTH_TOKEN) || "jobmate-admin-token-2026",

  BOT_MODE: clean(process.env.BOT_MODE) || "jobmate_hiring",
};

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive(),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  META_VERIFY_TOKEN: z.string().min(1, "META_VERIFY_TOKEN is required"),
  META_ACCESS_TOKEN: z.string().min(1, "META_ACCESS_TOKEN is required"),
  META_PHONE_NUMBER_ID: z.string().min(1, "META_PHONE_NUMBER_ID is required"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),

  JOBMATE_API_BASE_URL: z.string().url().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),

  AI_PRIMARY_PROVIDER: z.string().optional(),
  AI_FALLBACK_PROVIDER: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive(),
  AI_COOLDOWN_ON_429_MS: z.coerce.number().int().positive(),

  ADMIN_PASSWORD: z.string().min(6),
  ADMIN_AUTH_TOKEN: z.string().min(10),

  BOT_MODE: z.enum(["jobmate_hiring", "business_receptionist"]),
});

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  console.error("Raw env values:", rawEnv);
  console.error("Environment validation failed:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
