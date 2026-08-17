// AI 生图供应商适配层。此处隔离 IMAGE_* 配置，路由层只接收归一化结果。
import crypto from "node:crypto";
import OpenAI from "openai";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";

let imageClient;

function getImageClient() {
  if (!env.imageGenerationEnabled) {
    throw new ApiError(503, "Image generation is disabled", "IMAGE_GENERATION_DISABLED");
  }
  if (!imageClient) {
    imageClient = new OpenAI({
      apiKey: env.imageApiKey,
      baseURL: env.imageBaseUrl,
      timeout: env.imageTimeoutMs,
      maxRetries: env.imageMaxRetries
    });
  }
  return imageClient;
}

function providerName() {
  try {
    return new URL(env.imageBaseUrl).hostname || "image-provider";
  } catch {
    return "image-provider";
  }
}

function normalizeImage(item) {
  if (!item || typeof item !== "object") return null;
  const url = item.url || item.image_url || item.imageUrl || null;
  const b64Json = item.b64_json || item.b64Json || item.base64 || null;
  const revisedPrompt = item.revised_prompt || item.revisedPrompt || null;
  if (!url && !b64Json) return null;
  return { url: url ? String(url) : null, b64Json: b64Json ? String(b64Json) : null, revisedPrompt };
}

function normalizeResponse(response) {
  const candidates = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.images)
      ? response.images
      : Array.isArray(response?.output)
        ? response.output
        : response?.output
          ? [response.output]
          : [];
  return candidates.map(normalizeImage).filter(Boolean);
}

function mapProviderError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const name = String(error?.name || "").toLowerCase();
  if (name.includes("timeout") || name.includes("abort") || status === 408 || status === 504) {
    return new ApiError(504, "Image generation provider timed out", "IMAGE_TIMEOUT");
  }
  if (status === 400 || status === 422) {
    return new ApiError(502, "Image generation provider rejected the request", "IMAGE_PROVIDER_ERROR");
  }
  return new ApiError(502, "Image generation provider request failed", "IMAGE_PROVIDER_ERROR");
}

/**
 * Generate one or more images through an OpenAI Images-compatible endpoint.
 * Provider-specific fields are translated here and never exposed to callers.
 */
export async function generateImages(input) {
  const client = getImageClient();
  const model = input.model || env.imageModel;
  const payload = {
    model,
    prompt: input.prompt,
    n: input.n,
    size: input.size,
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.negativePrompt ? { negative_prompt: input.negativePrompt } : {})
  };

  let response;
  try {
    response = await client.images.generate(payload);
  } catch (error) {
    throw mapProviderError(error);
  }

  const images = normalizeResponse(response);
  if (!images.length) {
    throw new ApiError(502, "Image generation provider returned no images", "IMAGE_INVALID_RESPONSE");
  }

  return {
    requestId: crypto.randomUUID(),
    provider: providerName(),
    model,
    images,
    createdAt: new Date().toISOString()
  };
}

