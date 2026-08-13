// AI 分析服务：调用 OpenAI Responses API，并将结构化结果写回数据库。
import OpenAI from "openai";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

const promptVersion = "mvp-v1";
const openai = new OpenAI({
  apiKey: env.openaiApiKey,
  baseURL: env.openaiBaseUrl,
  timeout: env.openaiTimeoutMs,
  maxRetries: env.openaiMaxRetries
});

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" }
    },
    relevanceScore: { type: ["number", "null"] },
    factualityScore: { type: ["number", "null"] },
    importanceLevel: {
      type: "string",
      enum: ["low", "normal", "high", "critical"]
    }
  },
  required: ["summary", "tags", "relevanceScore", "factualityScore", "importanceLevel"]
};

function normalizeScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
}

function normalizeImportance(value) {
  const allowed = new Set(["low", "normal", "high", "critical"]);
  return allowed.has(value) ? value : "normal";
}

export async function analyzeHotItem(hotItem) {
  // 使用严格 JSON Schema，避免模型返回无法安全入库的自由文本。
  const response = await openai.responses.create({
    model: env.openaiModel,
    reasoning: { effort: env.openaiReasoningEffort },
    store: false,
    input: [
      {
        role: "system",
        content:
          "你是一名热点信息分析助手。请仅根据输入的热点信息进行分析，不得编造、补充或推断输入内容之外的事实。请返回紧凑、结构化的分析结果，并严格遵循系统提供的 JSON Schema。"
      },
      {
        role: "user",
        content: JSON.stringify({
          title: hotItem.title,
          url: hotItem.canonicalUrl,
          sourceCode: hotItem.sourceCode,
          existingSummary: hotItem.summary
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "hot_item_analysis",
        strict: true,
        schema: analysisSchema
      }
    }
  });

  if (!response.output_text) {
    throw new Error("OpenAI 响应未包含结构化输出");
  }

  let parsed;
  try {
    parsed = JSON.parse(response.output_text);
  } catch (err) {
    console.error(err);
    throw new Error("模型返回的数据格式无效", { cause: err });
  }

  // 对模型输出进行兜底、截断和范围约束，避免异常结果污染数据库。
  const summary = String(parsed.summary || hotItem.summary || hotItem.title).slice(0, 500);
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [];
  const relevanceScore = normalizeScore(parsed.relevanceScore);
  const factualityScore = normalizeScore(parsed.factualityScore);
  const importanceLevel = normalizeImportance(parsed.importanceLevel);
  const safePayload = {
    summary,
    tags,
    relevanceScore,
    factualityScore,
    importanceLevel
  };

  const analysis = await prisma.aiAnalysis.upsert({
    where: { hotItemId: hotItem.id },
    update: {
      provider: "openai",
      model: env.openaiModel,
      promptVersion,
      factualityScore,
      relevanceScore,
      importanceLevel,
      summary,
      tags,
      analysisPayload: safePayload
    },
    create: {
      hotItemId: hotItem.id,
      provider: "openai",
      model: env.openaiModel,
      promptVersion,
      factualityScore,
      relevanceScore,
      importanceLevel,
      summary,
      tags,
      analysisPayload: safePayload
    }
  });

  // 同时更新热点主表，方便列表接口直接读取摘要、标签和评分。
  await prisma.hotItem.update({
    where: { id: hotItem.id },
    data: {
      summary,
      tags,
      relevanceScore,
      importanceLevel,
      analysisStatus: "completed"
    }
  });

  return analysis;
}
