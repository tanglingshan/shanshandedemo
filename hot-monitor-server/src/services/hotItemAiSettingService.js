import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/errors.js";

const SETTINGS_ID = "singleton";

function serialize(setting) {
  const requestedEnabled = setting?.hotItemAiEnabled === true;
  const providerConfigured = isProviderConfigured();
  return {
    requestedEnabled,
    allowedByEnvironment: env.hotItemAiAllowed,
    providerConfigured,
    effectiveEnabled: env.hotItemAiAllowed && providerConfigured && requestedEnabled,
    analysisMode: "future_only",
    updatedAt: setting?.updatedAt || null
  };
}

function isPlaceholder(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized.startsWith("replace-with");
}

function isProviderConfigured() {
  // Provider readiness is controlled by the API key only. Base URL/model have
  // usable server defaults and must not make the runtime toggle report false.
  return Boolean(!isPlaceholder(env.openaiApiKey));
}

export async function getHotItemAiSetting() {
  const setting = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID }
  });

  return serialize(setting);
}

export async function isHotItemAiEnabled() {
  if (!env.hotItemAiAllowed || !isProviderConfigured()) return false;
  const setting = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: { hotItemAiEnabled: true }
  });
  return setting?.hotItemAiEnabled === true;
}

export async function updateHotItemAiSetting(enabled) {
  // Disabling is always allowed so users can persist the opt-out even when
  // the deployment-level feature gate is off. Only enabling is gated.
  if (enabled === true && env.hotItemAiAllowed === false) {
    throw new ApiError(
      409,
      "Hot-item AI analysis is not allowed by server configuration",
      "AI_ANALYSIS_NOT_ALLOWED"
    );
  }

  if (enabled === true && !isProviderConfigured()) {
    throw new ApiError(
      503,
      "OpenAI provider is not configured",
      "AI_PROVIDER_NOT_CONFIGURED"
    );
  }

  const setting = await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { hotItemAiEnabled: enabled },
    create: { id: SETTINGS_ID, hotItemAiEnabled: enabled }
  });

  return serialize(setting);
}
