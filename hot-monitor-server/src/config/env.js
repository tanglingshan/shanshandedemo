// 配置中心：加载 .env，并在服务启动时校验关键环境变量。
import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "SESSION_SECRET", "OPENAI_API_KEY"];
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
const defaultImageAllowedSizes = "1024x1024,1536x1024,1024x1536";

function parseImageInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return Number.NaN;
  return Number(value);
}

for (const key of required) {
  if (!process.env[key]) {
    // 缺少关键配置时立即失败，避免服务启动后才出现隐蔽错误。
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "hm.sid",
  // Stateless access-token settings. Keep a deterministic development fallback
  // so existing local .env files continue to boot; production deployments
  // should always provide a dedicated AUTH_TOKEN_SECRET.
  authTokenSecret: process.env.AUTH_TOKEN_SECRET || `${process.env.SESSION_SECRET}:auth-token`,
  authTokenTtlSeconds: Number(process.env.AUTH_TOKEN_TTL_SECONDS || 3600),
  corsOrigin: corsOrigin.includes(",") ? corsOrigin.split(",").map((item) => item.trim()).filter(Boolean) : corsOrigin,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://llmapi.xfcxb.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
  openaiReasoningEffort: process.env.OPENAI_REASONING_EFFORT || "low",
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
  openaiMaxRetries: Number(process.env.OPENAI_MAX_RETRIES || 2),
  // Deployment-level guard for automatic hot-item analysis. Runtime users
  // cannot enable analysis unless this explicit server-side opt-in is true.
  hotItemAiAllowed: String(process.env.HOT_ITEM_AI_ALLOWED || "false").toLowerCase() === "true",
  // Image generation deliberately uses an independent provider/key/base URL.
  // It may be disabled in development without requiring image credentials.
  imageGenerationEnabled: String(process.env.IMAGE_GENERATION_ENABLED || "false").toLowerCase() === "true",
  imageApiKey: process.env.IMAGE_API_KEY || "",
  imageBaseUrl: process.env.IMAGE_BASE_URL || "",
  imageModel: process.env.IMAGE_MODEL || "",
  imageTimeoutMs: parseImageInteger("IMAGE_TIMEOUT_MS", 60000),
  imageMaxRetries: parseImageInteger("IMAGE_MAX_RETRIES", 1),
  imageMaxN: parseImageInteger("IMAGE_MAX_N", 4),
  imageAllowedSizes: (process.env.IMAGE_ALLOWED_SIZES === undefined ? defaultImageAllowedSizes : process.env.IMAGE_ALLOWED_SIZES)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  collectorIntervalMinutes: Number(process.env.COLLECTOR_INTERVAL_MINUTES || 5),
  isProduction: process.env.NODE_ENV === "production"
};

if (!env.authTokenSecret || (env.isProduction && env.authTokenSecret.length < 32)) {
  throw new Error("AUTH_TOKEN_SECRET must be configured (at least 32 characters in production)");
}
if (!Number.isInteger(env.authTokenTtlSeconds) || env.authTokenTtlSeconds <= 0) {
  throw new Error("AUTH_TOKEN_TTL_SECONDS must be a positive integer");
}

// Validate image resource limits at boot, before accepting requests. Defaults
// keep IMAGE_GENERATION_ENABLED=false development setups fully optional.
if (!Number.isInteger(env.imageTimeoutMs) || env.imageTimeoutMs <= 0) {
  throw new Error("IMAGE_TIMEOUT_MS must be a positive integer");
}
if (!Number.isInteger(env.imageMaxRetries) || env.imageMaxRetries < 0) {
  throw new Error("IMAGE_MAX_RETRIES must be a non-negative integer");
}
if (!Number.isInteger(env.imageMaxN) || env.imageMaxN < 1) {
  throw new Error("IMAGE_MAX_N must be a positive integer");
}
if (!env.imageAllowedSizes.length || env.imageAllowedSizes.some((size) => !/^\d+x\d+$/.test(size))) {
  throw new Error("IMAGE_ALLOWED_SIZES must be a non-empty comma-separated list of WIDTHxHEIGHT values");
}

if (env.imageGenerationEnabled || env.isProduction) {
  for (const key of ["imageApiKey", "imageBaseUrl", "imageModel"]) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key === "imageApiKey" ? "IMAGE_API_KEY" : key === "imageBaseUrl" ? "IMAGE_BASE_URL" : "IMAGE_MODEL"}`);
    }
  }
}
