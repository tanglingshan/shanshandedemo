// AI 生图 HTTP 层：认证、输入约束和短窗口限流，供应商细节由 service 隔离。
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { env } from "../config/env.js";
import { generateAndPersistImages, serializeHistory } from "../services/imageGenerationHistoryService.js";
import { polishPrompt } from "../services/promptPolishService.js";
import { prisma } from "../lib/prisma.js";

export const imageGenerationRouter = Router();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestBuckets = new Map();
const polishBuckets = new Map();
// baseUrl is accepted for compatibility with image-studio clients, but is
// deliberately ignored by the service: the server-side IMAGE_BASE_URL wins.
const allowedFields = new Set([
  "prompt",
  "negativePrompt",
  "model",
  "baseUrl",
  "size",
  "n",
  "count",
  "quality",
  "style",
  "referenceImage"
]);

function enforceRateLimit(req) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    throw new ApiError(429, "Too many image generation requests", "IMAGE_RATE_LIMITED");
  }
}

function enforcePolishRateLimit(req) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = polishBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    polishBuckets.set(key, { startedAt: now, count: 1 });
    return;
  }
  bucket.count += 1;
  if (bucket.count > 20) throw new ApiError(429, "Too many prompt polish requests", "POLISH_RATE_LIMITED");
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object");
  }
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) throw validationError(`Unsupported image generation field: ${key}`);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 1000) throw validationError("prompt is required and must be 1-1000 characters");

  // image-studio calls this field count while the existing web client calls
  // it n. Prefer n when both are supplied and normalize to one provider n.
  const n = body.n === undefined
    ? (body.count === undefined ? 1 : Number(body.count))
    : Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > env.imageMaxN) {
    throw validationError(`n must be an integer between 1 and ${env.imageMaxN}`);
  }

  const size = body.size === undefined ? env.imageAllowedSizes[0] : body.size;
  if (typeof size !== "string" || !env.imageAllowedSizes.includes(size)) {
    throw validationError(`size must be one of: ${env.imageAllowedSizes.join(", ")}`);
  }

  const negativePrompt = body.negativePrompt === undefined ? undefined : String(body.negativePrompt).trim();
  if (negativePrompt && negativePrompt.length > 1000) throw validationError("negativePrompt must be at most 1000 characters");

  const quality = body.quality === undefined ? undefined : String(body.quality).trim().toLowerCase();
  if (quality && !["auto", "high", "medium", "low", "hd", "standard"].includes(quality)) {
    throw validationError("quality must be auto, high, medium, low, hd, or standard");
  }
  const style = body.style === undefined ? undefined : String(body.style);
  if (style && !["vivid", "natural"].includes(style)) throw validationError("style must be vivid or natural");

  // Model overrides are intentionally constrained to the configured image model;
  // callers cannot switch providers or arbitrary models through the request.
  if (body.model !== undefined && (!env.imageModel || body.model !== env.imageModel)) {
    throw validationError("model override is not allowed");
  }

  const rawReferenceImage = body.referenceImage === undefined ? "" : String(body.referenceImage).trim();
  const referenceImage = rawReferenceImage || undefined;
  if (referenceImage !== undefined) {
    if (!referenceImage.startsWith("data:")) {
      throw validationError("referenceImage must be an image data URL");
    }
    // Keep the route bounded even when the global JSON parser limit is raised
    // for image uploads in a deployment.
    if (referenceImage.length > 12_000_000) {
      throw validationError("referenceImage is too large");
    }
  }

  return {
    prompt,
    negativePrompt,
    // A model may only be selected through the server's IMAGE_MODEL config.
    model: body.model === undefined ? env.imageModel : body.model,
    size,
    n,
    quality,
    style,
    referenceImage
  };
}

imageGenerationRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    enforceRateLimit(req);
    const input = validateBody(req.body);
    res.json(success(await generateAndPersistImages(req.auth.userId, input)));
  } catch (error) {
    next(error);
  }
});

imageGenerationRouter.post("/polish", requireAuth, async (req, res, next) => {
  try {
    enforcePolishRateLimit(req);
    res.json(success(await polishPrompt(req.body)));
  } catch (error) {
    next(error);
  }
});

imageGenerationRouter.get("/history", requireAuth, async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const pageSize = Number(req.query.pageSize || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw validationError("page must be >= 1 and pageSize must be between 1 and 50");
    }
    const status = req.query.status === undefined ? undefined : String(req.query.status);
    if (status !== undefined && !["pending", "succeeded", "failed"].includes(status)) {
      throw validationError("status must be pending, succeeded, or failed");
    }
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    await prisma.imageGenerationHistory.updateMany({
      where: { userId: req.auth.userId, status: "pending", createdAt: { lt: staleBefore } },
      data: { status: "failed", errorCode: "IMAGE_GENERATION_STALE", errorMessage: "Generation did not complete", completedAt: new Date() }
    });
    const where = { userId: req.auth.userId, ...(status ? { status } : {}) };
    const [total, items] = await Promise.all([
      prisma.imageGenerationHistory.count({ where }),
      prisma.imageGenerationHistory.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { images: { orderBy: { ordinal: "asc" } } }
      })
    ]);
    res.json(success({
      items: items.map(serializeHistory),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }));
  } catch (error) {
    next(error);
  }
});

imageGenerationRouter.get("/images/:id", requireAuth, async (req, res, next) => {
  try {
    const image = await prisma.imageGenerationImage.findFirst({
      where: { id: String(req.params.id), history: { userId: req.auth.userId } }
    });
    if (!image) throw notFound("Image does not exist");
    if (image.data) {
      res.type(image.mimeType || "image/png").send(image.data);
      return;
    }
    // Provider URLs are temporary. Fetch only URLs belonging to the configured
    // provider and never proxy arbitrary user-controlled destinations.
    if (!image.providerUrl || !env.imageBaseUrl) throw new ApiError(410, "Image resource expired", "IMAGE_RESOURCE_EXPIRED");
    const providerHost = new URL(env.imageBaseUrl).host;
    const imageUrl = new URL(image.providerUrl);
    if (imageUrl.host !== providerHost) throw new ApiError(410, "Image resource expired", "IMAGE_RESOURCE_EXPIRED");
    const response = await fetch(imageUrl, {
      headers: { authorization: `Bearer ${env.imageApiKey}` },
      signal: AbortSignal.timeout(env.imageTimeoutMs)
    });
    if (!response.ok) throw new ApiError(410, "Image resource expired", "IMAGE_RESOURCE_EXPIRED");
    const contentType = (image.mimeType || response.headers.get("content-type") || "image/png").split(";", 1)[0];
    res.type(contentType);
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    next(error);
  }
});
