// AI 生图 HTTP 层：认证、输入约束和短窗口限流，供应商细节由 service 隔离。
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { ApiError, validationError } from "../utils/errors.js";
import { env } from "../config/env.js";
import { generateImages } from "../services/imageGenerationService.js";

export const imageGenerationRouter = Router();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestBuckets = new Map();
const allowedFields = new Set(["prompt", "negativePrompt", "model", "size", "n", "quality", "style"]);

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

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("Request body must be an object");
  }
  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) throw validationError(`Unsupported image generation field: ${key}`);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 1000) throw validationError("prompt is required and must be 1-1000 characters");

  const n = body.n === undefined ? 1 : Number(body.n);
  if (!Number.isInteger(n) || n < 1 || n > env.imageMaxN) {
    throw validationError(`n must be an integer between 1 and ${env.imageMaxN}`);
  }

  const size = body.size === undefined ? env.imageAllowedSizes[0] : body.size;
  if (typeof size !== "string" || !env.imageAllowedSizes.includes(size)) {
    throw validationError(`size must be one of: ${env.imageAllowedSizes.join(", ")}`);
  }

  const negativePrompt = body.negativePrompt === undefined ? undefined : String(body.negativePrompt).trim();
  if (negativePrompt && negativePrompt.length > 1000) throw validationError("negativePrompt must be at most 1000 characters");

  const quality = body.quality === undefined ? undefined : String(body.quality);
  if (quality && !["standard", "hd"].includes(quality)) throw validationError("quality must be standard or hd");
  const style = body.style === undefined ? undefined : String(body.style);
  if (style && !["vivid", "natural"].includes(style)) throw validationError("style must be vivid or natural");

  // Model overrides are intentionally constrained to the configured image model;
  // callers cannot switch providers or arbitrary models through the request.
  if (body.model !== undefined && (!env.imageModel || body.model !== env.imageModel)) {
    throw validationError("model override is not allowed");
  }

  return { prompt, negativePrompt, model: body.model, size, n, quality, style };
}

imageGenerationRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    enforceRateLimit(req);
    const input = validateBody(req.body);
    res.json(success(await generateImages(input)));
  } catch (error) {
    next(error);
  }
});

