import crypto from "node:crypto";
import OpenAI from "openai";
import { env } from "../config/env.js";
import { ApiError, validationError } from "../utils/errors.js";

const openai = new OpenAI({
  apiKey: env.openaiApiKey,
  baseURL: env.openaiBaseUrl,
  timeout: env.openaiTimeoutMs,
  maxRetries: env.openaiMaxRetries
});

const polishSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: { type: "string" },
    negativePrompt: { type: ["string", "null"] }
  },
  required: ["prompt", "negativePrompt"]
};

function clean(value, max) {
  if (value === null || value === undefined) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) || null;
}

function validateInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError("Request body must be an object");
  for (const key of Object.keys(body)) {
    if (!["prompt", "negativePrompt", "style", "language"].includes(key)) {
      throw validationError(`Unsupported prompt polish field: ${key}`);
    }
  }
  const prompt = clean(body.prompt, 1000);
  if (!prompt) throw validationError("prompt is required and must be 1-1000 characters");
  const negativePrompt = body.negativePrompt === undefined ? null : clean(body.negativePrompt, 200);
  const style = body.style === undefined ? null : clean(body.style, 200);
  const language = body.language === undefined ? "zh-CN" : clean(body.language, 20);
  return { prompt, negativePrompt, style, language };
}

export async function polishPrompt(body) {
  const input = validateInput(body);
  let response;
  try {
    response = await openai.responses.create({
      model: env.openaiModel,
      reasoning: { effort: env.openaiReasoningEffort },
      store: false,
      input: [
        {
          role: "system",
          content: "你是专业的 AI 生图提示词编辑。请在不捏造用户未提供的主体事实前提下，优化构图、主体、环境、光线、镜头和风格描述。严格输出 JSON，不要输出解释。"
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "image_prompt_polish",
          strict: true,
          schema: polishSchema
        }
      }
    });
  } catch (error) {
    console.error("Prompt polish provider error", error);
    throw new ApiError(502, "Prompt polish provider request failed", "POLISH_PROVIDER_ERROR");
  }

  if (!response?.output_text) throw new ApiError(502, "Prompt polish provider returned no result", "POLISH_INVALID_RESPONSE");
  let parsed;
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    throw new ApiError(502, "Prompt polish provider returned invalid result", "POLISH_INVALID_RESPONSE");
  }
  const polishedPrompt = clean(parsed.prompt, 2000);
  if (!polishedPrompt) throw new ApiError(502, "Prompt polish provider returned an empty prompt", "POLISH_INVALID_RESPONSE");
  return {
    prompt: polishedPrompt,
    negativePrompt: clean(parsed.negativePrompt, 1000),
    model: env.openaiModel,
    requestId: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
}
