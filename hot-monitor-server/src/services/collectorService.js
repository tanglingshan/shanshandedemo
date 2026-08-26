// 采集编排服务：串起数据源采集、热点入库、AI 分析、运行记录和实时推送。
import { collectors } from "../collectors/index.js";
import { prisma } from "../lib/prisma.js";
import { analyzeHotItem } from "./aiAnalyzer.js";
import { isHotItemAiEnabled } from "./hotItemAiSettingService.js";
import { getOverviewStats } from "./statsService.js";
import { upsertCollectedItem } from "./hotItemService.js";
import {
  emitCollectorRunStatus,
  emitHotItemNew,
  emitHotItemUpdate,
  emitServerError,
  emitStatsUpdate
} from "../sockets/emitter.js";

const LOG_VALUE_LIMIT = 500;

function sanitizeLogValue(value, limit = LOG_VALUE_LIMIT) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value)
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_ -]?key|authorization|bearer|database_url|password|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/(postgres(?:ql)?:\/\/[^\s"']+)/gi, "[REDACTED_DATABASE_URL]")
    .slice(0, limit);
}

function serializeError(error) {
  const cause = error?.cause;
  return {
    name: sanitizeLogValue(error?.name),
    status: sanitizeLogValue(error?.status ?? error?.statusCode),
    code: sanitizeLogValue(error?.code),
    type: sanitizeLogValue(error?.type),
    message: sanitizeLogValue(error?.message),
    causeMessage: sanitizeLogValue(cause?.message ?? cause, 300)
  };
}

function errorSummary(error) {
  const details = serializeError(error);
  return sanitizeLogValue(
    [details.name, details.code, details.message].filter(Boolean).join(": "),
    300
  );
}

export async function runCollectorForSource(source) {
  const startedAt = new Date();
  const run = await prisma.collectorRun.create({
    data: {
      sourceCode: source.code,
      status: "running",
      startedAt
    }
  });

  emitCollectorRunStatus({
    sourceCode: source.code,
    status: "running",
    startedAt
  });

  try {
    const collect = collectors[source.code];
    if (!collect) {
      throw new Error(`No collector registered for source: ${source.code}`);
    }

    const rawItems = await collect(source);
    const hotItemAiEnabled = await isHotItemAiEnabled();
    let itemsInserted = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;

    for (const rawItem of rawItems) {
      let stage = "upsert";
      let sourceItemId = null;
      let title = null;
      let hotItemId = null;
      try {
        // 先判断是否已有记录，后续用于区分新增事件和更新事件。
        sourceItemId = String(rawItem.sourceItemId || rawItem.url || rawItem.title);
        title = sanitizeLogValue(rawItem.title);
        stage = "upsert";
        const { item: hotItem, created, changed } = await upsertCollectedItem({
          ...rawItem,
          sourceCode: source.code,
          sourceItemId
        });
        hotItemId = hotItem.id;

        // AI is opt-in for new/changed items; failed analyses and unanalyzed items are retried.
        const needsAnalysis = created || changed || hotItem.analysisStatus === "failed"
          || hotItem.analysisStatus === "disabled" || hotItem.analysisStatus === "pending";
        if (hotItemAiEnabled && needsAnalysis) {
          stage = "analyze";
          await analyzeHotItem(hotItem);
        } else if (!hotItemAiEnabled && (created || changed)) {
          stage = "disable";
          await prisma.hotItem.update({
            where: { id: hotItem.id },
            data: { analysisStatus: "disabled" }
          });
        }
        stage = "refresh";
        const refreshed = await prisma.hotItem.findUnique({
          where: { id: hotItem.id },
          include: { aiAnalysis: true }
        });
        stage = null;

        if (created) {
          itemsInserted += 1;
          emitHotItemNew(refreshed);
        } else {
          itemsUpdated += 1;
          emitHotItemUpdate(refreshed);
        }
      } catch (error) {
        if (stage === "analyze" && hotItemId) {
          try {
            await prisma.hotItem.update({
              where: { id: hotItemId },
              data: { analysisStatus: "failed" }
            });
          } catch (statusError) {
            console.error("Failed to persist AI analysis failure status", {
              sourceCode: sanitizeLogValue(source.code),
              sourceItemId: sanitizeLogValue(sourceItemId),
              error: serializeError(statusError)
            });
          }
        }
        // 单条热点失败不影响同一数据源的其他热点继续处理。
        itemsSkipped += 1;
        console.error("Collector item failed", {
          sourceCode: sanitizeLogValue(source.code),
          sourceItemId: sanitizeLogValue(sourceItemId),
          title,
          stage,
          error: serializeError(error)
        });
        emitServerError(error.message, "COLLECTOR_ITEM_ERROR");
      }
    }

    const finishedAt = new Date();
    await prisma.collectorRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt,
        itemsFetched: rawItems.length,
        itemsInserted,
        itemsUpdated,
        itemsSkipped
      }
    });

    emitCollectorRunStatus({
      sourceCode: source.code,
      status: "success",
      startedAt,
      finishedAt
    });

    emitStatsUpdate(await getOverviewStats());
  } catch (error) {
    const finishedAt = new Date();
    const summary = errorSummary(error);
    await prisma.collectorRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt,
        errorMessage: summary
      }
    });

    emitCollectorRunStatus({
      sourceCode: source.code,
      status: "failed",
      startedAt,
      finishedAt
    });
    console.error("Collector run failed", {
      sourceCode: sanitizeLogValue(source.code),
      summary
    });
    emitServerError(error.message, "COLLECTOR_ERROR");
  }
}

export async function runAllCollectors() {
  const sources = await prisma.source.findMany({
    where: { enabled: true },
    orderBy: { code: "asc" }
  });

  for (const source of sources) {
    await runCollectorForSource(source);
  }
}
