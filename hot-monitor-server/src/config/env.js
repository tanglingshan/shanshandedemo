// 配置中心：加载 .env，并在服务启动时校验关键环境变量。
import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "SESSION_SECRET", "OPENAI_API_KEY"];
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

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
  corsOrigin: corsOrigin.includes(",") ? corsOrigin.split(",").map((item) => item.trim()).filter(Boolean) : corsOrigin,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://llmapi.xfcxb.com/v1",
  openaiModel: process.env.OPENAI_MODEL || "gpt-5.5",
  openaiReasoningEffort: process.env.OPENAI_REASONING_EFFORT || "low",
  openaiTimeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 30000),
  openaiMaxRetries: Number(process.env.OPENAI_MAX_RETRIES || 2),
  collectorIntervalMinutes: Number(process.env.COLLECTOR_INTERVAL_MINUTES || 5),
  isProduction: process.env.NODE_ENV === "production"
};
