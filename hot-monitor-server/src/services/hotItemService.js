import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../utils/errors.js";

const pageSizeMax = 100;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildWhere(query) {
  const where = {};

  if (query.source && query.source !== "all") {
    where.sourceCode = query.source;
  }

  if (query.importanceLevel) {
    where.importanceLevel = query.importanceLevel;
  }

  if (query.keyword) {
    const keyword = String(query.keyword).trim();
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { summary: { contains: keyword, mode: "insensitive" } }
    ];
  }

  if (query.from || query.to) {
    where.publishedAt = {};
    if (query.from) where.publishedAt.gte = new Date(query.from);
    if (query.to) where.publishedAt.lte = new Date(query.to);
  }

  return where;
}

function buildOrderBy(sort) {
  if (sort === "hot" || sort === "score") return [{ hotScore: "desc" }, { collectedAt: "desc" }];
  if (sort === "ai") return [{ relevanceScore: "desc" }, { hotScore: "desc" }];
  return [{ collectedAt: "desc" }];
}

export async function listHotItems(query = {}) {
  const page = toPositiveInt(query.page, 1);
  const pageSize = Math.min(toPositiveInt(query.pageSize, 20), pageSizeMax);
  const where = buildWhere(query);

  const [total, items] = await Promise.all([
    prisma.hotItem.count({ where }),
    prisma.hotItem.findMany({
      where,
      include: { aiAnalysis: true },
      orderBy: buildOrderBy(query.sort),
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

export async function getHotItemById(id) {
  const item = await prisma.hotItem.findUnique({
    where: { id },
    include: { aiAnalysis: true, sources: true }
  });

  if (!item) {
    throw notFound("Hot item not found");
  }

  return item;
}

export function contentHash(value) {
  return crypto.createHash("sha256").update(value || "").digest("hex");
}

const trackingQueryParams = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "twclid",
  "ttclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_ga",
  "_gl",
  "spm",
  "mkt_tok"
]);

export function normalizeCanonicalUrl(value) {
  if (value === undefined || value === null) return null;

  const input = String(value).trim();
  if (!input) return null;

  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  url.hash = "";
  for (const [key] of url.searchParams) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith("utm_") || trackingQueryParams.has(normalizedKey)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  }

  return url.toString();
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002";
}

function sourceKeyWhere(sourceCode, sourceItemId) {
  return {
    sourceCode_sourceItemId: {
      sourceCode,
      sourceItemId
    }
  };
}

async function findExistingHotItem({ sourceCode, sourceItemId, canonicalUrl }) {
  const bySource = await prisma.hotItem.findUnique({
    where: sourceKeyWhere(sourceCode, sourceItemId)
  });
  if (bySource) return bySource;
  if (!canonicalUrl) return null;

  return prisma.hotItem.findUnique({ where: { canonicalUrl } });
}

function buildSafeHotItemUpdate(existing, data) {
  const contentChanged = existing.rawContentHash !== data.rawContentHash;
  const update = {
    title: data.title,
    publishedAt: data.publishedAt,
    collectedAt: data.collectedAt,
    rawContentHash: data.rawContentHash,
    hotScore: data.hotScore,
    ...(contentChanged
      ? {
          // Reset derived fields when the source content changes so stale AI
          // output cannot be shown for the new article version.
          summary: data.summary || null,
          tags: data.tags || [],
          relevanceScore: null,
          importanceLevel: "normal",
          analysisStatus: "pending",
          aiAnalysis: { delete: true }
        }
      : {})
  };

  if (!existing.canonicalUrl && data.canonicalUrl) {
    update.canonicalUrl = data.canonicalUrl;
  }

  return update;
}

async function updateExistingHotItem(existing, data) {
  const contentChanged = existing.rawContentHash !== data.rawContentHash;
  try {
    return {
      item: await prisma.hotItem.update({
        where: { id: existing.id },
        data: buildSafeHotItemUpdate(existing, data)
      }),
      changed: contentChanged
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const winner = await prisma.hotItem.findUnique({
      where: { canonicalUrl: data.canonicalUrl }
    });
    if (!winner) throw error;
    return { item: winner, changed: contentChanged };
  }
}

async function updateOrCreateHotItem({ sourceCode, sourceItemId, canonicalUrl, data }) {
  const existing = await findExistingHotItem({ sourceCode, sourceItemId, canonicalUrl });
  if (existing) {
    const result = await updateExistingHotItem(existing, data);
    return { ...result, created: false };
  }

  try {
    return {
      item: await prisma.hotItem.create({ data }),
      created: true,
      changed: true
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const winner = await findExistingHotItem({ sourceCode, sourceItemId, canonicalUrl });
    if (!winner) throw error;

    const result = await updateExistingHotItem(winner, data);
    return { ...result, created: false };
  }
}

export async function upsertCollectedItem(rawItem) {
  const sourceCode = rawItem.sourceCode;
  const sourceItemId = String(rawItem.sourceItemId || rawItem.url || rawItem.title);
  const canonicalUrl = normalizeCanonicalUrl(rawItem.url);
  const now = new Date();
  const data = {
    title: rawItem.title,
    canonicalUrl,
    sourceCode,
    sourceItemId,
    publishedAt: rawItem.publishedAt ? new Date(rawItem.publishedAt) : null,
    collectedAt: now,
    rawContentHash: contentHash(`${rawItem.title}\n${rawItem.content || rawItem.summary || ""}`),
    summary: rawItem.summary || null,
    tags: rawItem.tags || [],
    hotScore: Number(rawItem.hotScore || 0),
    analysisStatus: "pending"
  };

  const { item, created, changed } = await updateOrCreateHotItem({
    sourceCode,
    sourceItemId,
    canonicalUrl,
    data
  });

  await prisma.hotItemSource.upsert({
    where: sourceKeyWhere(sourceCode, sourceItemId),
    update: {
      hotItemId: item.id,
      sourceUrl: rawItem.url || null,
      rawTitle: rawItem.title,
      rawSummary: rawItem.summary || null,
      rawPayload: rawItem.rawPayload || rawItem,
      collectedAt: now
    },
    create: {
      hotItemId: item.id,
      sourceCode,
      sourceItemId,
      sourceUrl: rawItem.url || null,
      rawTitle: rawItem.title,
      rawSummary: rawItem.summary || null,
      rawPayload: rawItem.rawPayload || rawItem,
      collectedAt: now
    }
  });

  return { item, created, changed };
}
