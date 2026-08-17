// Image provider adapter.  Image generation intentionally uses its own
// IMAGE_* credentials and endpoint; the text-model client is not involved.
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";

function providerName() {
  try {
    return new URL(env.imageBaseUrl).hostname || "image-provider";
  } catch {
    return "image-provider";
  }
}

function endpoint(path) {
  // The endpoint is configured server-side.  Never use a URL supplied by a
  // browser request: accepting it would turn this route into an SSRF proxy.
  let base;
  try {
    base = new URL(env.imageBaseUrl);
  } catch {
    throw new ApiError(503, "Image generation provider is not configured", "IMAGE_PROVIDER_NOT_CONFIGURED");
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new ApiError(503, "Image generation provider is not configured", "IMAGE_PROVIDER_NOT_CONFIGURED");
  }
  return new URL(path.replace(/^\//, ""), `${base.toString().replace(/\/$/, "")}/`).toString();
}

function normalizeImage(item) {
  if (!item || typeof item !== "object") return null;
  const url = item.url || item.image_url || item.imageUrl || null;
  const b64Json = item.b64_json || item.b64Json || item.base64 || null;
  const revisedPrompt = item.revised_prompt || item.revisedPrompt || null;
  if (!url && !b64Json) return null;
  return {
    url: url ? String(url) : null,
    b64Json: b64Json ? String(b64Json) : null,
    revisedPrompt: revisedPrompt ? String(revisedPrompt) : null
  };
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

function providerError(status, detail) {
  if (status === 408 || status === 504) {
    return new ApiError(504, "Image generation provider timed out", "IMAGE_TIMEOUT");
  }
  if (status === 400 || status === 401 || status === 403 || status === 422) {
    return new ApiError(502, "Image generation provider rejected the request", "IMAGE_PROVIDER_ERROR");
  }
  // Do not expose upstream response bodies (which may contain credentials or
  // internal URLs) to the browser.  Keep the detail only in the server log.
  if (detail) console.error("Image generation provider error", { status, detail });
  return new ApiError(502, "Image generation provider request failed", "IMAGE_PROVIDER_ERROR");
}

function isRetryable(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function requestProvider(url, options) {
  const attempts = Math.max(1, env.imageMaxRetries + 1);
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(env.imageTimeoutMs)
      });
      const raw = await response.text();
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = { error: raw };
      }
      if (!response.ok && isRetryable(response.status) && attempt + 1 < attempts) continue;
      return { response, body };
    } catch (error) {
      lastError = error;
      // Network and timeout failures are safe to retry.  AbortError can be
      // produced by a caller signal, but this service owns its timeout signal.
      if (attempt + 1 >= attempts) break;
    }
  }

  const errorName = String(lastError?.name || "").toLowerCase();
  const errorMessage = String(lastError?.message || "").toLowerCase();
  const timedOut = errorName.includes("timeout")
    || errorName.includes("abort")
    || errorMessage.includes("timeout")
    || errorMessage.includes("timed out");
  if (timedOut) throw new ApiError(504, "Image generation provider timed out", "IMAGE_TIMEOUT");
  throw providerError(0, lastError?.message);
}

function imageDataUrl(value) {
  if (typeof value !== "string" || !value.startsWith("data:")) return null;
  const comma = value.indexOf(",");
  if (comma < 0) throw new ApiError(422, "referenceImage must be a valid data URL", "VALIDATION_ERROR");
  const header = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  const mime = header.split(";")[0] || "image/png";
  if (!/^image\/[a-z0-9.+-]+$/i.test(mime) || !payload) {
    throw new ApiError(422, "referenceImage must be a valid image data URL", "VALIDATION_ERROR");
  }
  const base64 = header.toLowerCase().includes(";base64");
  let bytes;
  try {
    bytes = base64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  } catch {
    throw new ApiError(422, "referenceImage must be a valid image data URL", "VALIDATION_ERROR");
  }
  if (!bytes.length) throw new ApiError(422, "referenceImage must not be empty", "VALIDATION_ERROR");
  const extension = mime.split("/")[1].split("+")[0].replace(/[^a-z0-9]/gi, "") || "png";
  return { bytes, mime, filename: `reference.${extension}` };
}

function commonPayload(input) {
  const n = input.n === undefined ? (input.count === undefined ? 1 : input.count) : input.n;
  const payload = {
    model: input.model || env.imageModel,
    prompt: input.prompt,
    size: input.size,
    n
  };
  // The provider rejects quality=auto; all other supported values are passed
  // through exactly as supplied by the route validator.
  if (input.quality && input.quality !== "auto") payload.quality = input.quality;
  return payload;
}

/** Generate images via the provider's /images/generations or /images/edits API. */
export async function generateImages(input) {
  if (!env.imageGenerationEnabled) {
    throw new ApiError(503, "Image generation is disabled", "IMAGE_GENERATION_DISABLED");
  }
  if (!env.imageApiKey || !env.imageModel || !env.imageBaseUrl) {
    throw new ApiError(503, "Image generation provider is not configured", "IMAGE_PROVIDER_NOT_CONFIGURED");
  }

  const common = commonPayload(input);
  const reference = imageDataUrl(input.referenceImage);
  const url = endpoint(reference ? "/images/edits" : "/images/generations");
  const headers = { authorization: `Bearer ${env.imageApiKey}` };
  let options;

  if (reference) {
    const form = new FormData();
    form.append("image", new Blob([reference.bytes], { type: reference.mime }), reference.filename);
    for (const [key, value] of Object.entries(common)) form.append(key, String(value));
    options = { method: "POST", headers, body: form };
  } else {
    options = {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(common)
    };
  }

  let result;
  try {
    result = await requestProvider(url, options);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw providerError(0, error?.message);
  }

  if (!result.response.ok) {
    const detail = result.body?.error?.message || result.body?.error || result.body?.message;
    throw providerError(result.response.status, detail);
  }
  const images = normalizeResponse(result.body);
  if (!images.length) {
    throw new ApiError(502, "Image generation provider returned no images", "IMAGE_INVALID_RESPONSE");
  }

  return {
    requestId: crypto.randomUUID(),
    provider: providerName(),
    model: common.model,
    images,
    createdAt: new Date().toISOString()
  };
}
