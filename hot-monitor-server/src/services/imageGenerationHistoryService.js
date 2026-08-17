import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { generateImages } from "./imageGenerationService.js";

const MAX_TEXT = 4000;

function boundedText(value, max = MAX_TEXT) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) || null;
}

function referenceHash(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function decodeImageData(value) {
  if (typeof value !== "string" || !value) return null;
  const raw = value.startsWith("data:") ? value.slice(value.indexOf(",") + 1) : value;
  try {
    const bytes = Buffer.from(raw, "base64");
    return bytes.length ? bytes : null;
  } catch {
    return null;
  }
}

function imageMimeType(image) {
  if (typeof image?.url === "string") {
    const match = image.url.match(/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i);
    if (match) return `image/${match[1].toLowerCase().replace("jpg", "jpeg")}`;
  }
  return "image/png";
}

function providerUrl(value) {
  if (typeof value !== "string" || value.length > 4000) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function downloadProviderImage(url) {
  if (!url || !env.imageBaseUrl) return null;
  try {
    const configured = new URL(env.imageBaseUrl);
    const parsed = new URL(url);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.host !== configured.host) return null;
    const response = await fetch(parsed, {
      headers: { authorization: `Bearer ${env.imageApiKey}` },
      signal: AbortSignal.timeout(env.imageTimeoutMs)
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") || "image/png").split(";", 1)[0].trim();
    if (!/^image\/[a-z0-9.+-]+$/i.test(contentType)) return null;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 25 * 1024 * 1024) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    // Avoid turning a malformed provider response into an unbounded DB write.
    if (!bytes.length || bytes.length > 25 * 1024 * 1024) return null;
    return { data: bytes, mimeType: contentType };
  } catch (error) {
    console.warn("Could not download provider image for durable history", { message: error?.message });
    return null;
  }
}

export async function createPendingHistory(userId, input, requestId = crypto.randomUUID()) {
  return prisma.imageGenerationHistory.create({
    data: {
      userId,
      requestId,
      prompt: boundedText(input.prompt, 1000) || "",
      negativePrompt: boundedText(input.negativePrompt, 1000),
      model: boundedText(input.model, 200) || "unknown",
      provider: "image-provider",
      size: boundedText(input.size, 32) || "unknown",
      count: Number(input.n || input.count || 1),
      quality: boundedText(input.quality, 32),
      style: boundedText(input.style, 32),
      referenceHash: referenceHash(input.referenceImage)
    }
  });
}

export async function completeHistory(historyId, result) {
  const images = Array.isArray(result?.images) ? result.images : [];
  const revisedPrompt = boundedText(images.find((item) => item?.revisedPrompt)?.revisedPrompt, 4000);
  const durableImages = await Promise.all(images.map(async (image) => {
    const data = decodeImageData(image?.b64Json);
    if (data) return { data, mimeType: imageMimeType(image) };
    return downloadProviderImage(providerUrl(image?.url));
  }));
  await prisma.$transaction(async (tx) => {
    await tx.imageGenerationHistory.update({
      where: { id: historyId },
      data: {
        status: "succeeded",
        provider: boundedText(result.provider, 200) || "image-provider",
        model: boundedText(result.model, 200) || "unknown",
        revisedPrompt,
        completedAt: new Date()
      }
    });
    if (images.length) {
      await tx.imageGenerationImage.createMany({
        data: images.map((image, index) => {
          const durable = durableImages[index];
          return {
            historyId,
            ordinal: index,
            providerUrl: providerUrl(image?.url),
            mimeType: durable?.mimeType || imageMimeType(image),
            data: durable?.data || null,
            revisedPrompt: boundedText(image?.revisedPrompt, 4000)
          };
        })
      });
    }
  });
}

export async function failHistory(historyId, error) {
  const errorCode = boundedText(error?.errorCode, 100) || "IMAGE_PROVIDER_ERROR";
  const errorMessage = boundedText(error?.message, 500) || "Image generation failed";
  try {
    await prisma.imageGenerationHistory.update({
      where: { id: historyId },
      data: { status: "failed", errorCode, errorMessage, completedAt: new Date() }
    });
  } catch (persistError) {
    console.error("Failed to persist image generation error", persistError);
  }
}

export async function generateAndPersistImages(userId, input) {
  const requestId = crypto.randomUUID();
  const history = await createPendingHistory(userId, input, requestId);
  try {
    const result = await generateImages({ ...input, requestId });
    await completeHistory(history.id, result);
    return { ...result, requestId, historyId: history.id };
  } catch (error) {
    await failHistory(history.id, error);
    throw error;
  }
}

export function historyImageUrl(imageId) {
  return `/api/image-generations/images/${encodeURIComponent(imageId)}`;
}

export function serializeHistory(history) {
  return {
    id: history.id,
    prompt: history.prompt,
    negativePrompt: history.negativePrompt,
    model: history.model,
    size: history.size,
    count: history.count,
    status: history.status,
    images: (history.images || []).map((image) => ({
      id: image.id,
      url: historyImageUrl(image.id),
      revisedPrompt: image.revisedPrompt
    })),
    createdAt: history.createdAt?.toISOString?.() || history.createdAt,
    completedAt: history.completedAt?.toISOString?.() || history.completedAt,
    errorCode: history.errorCode
  };
}
