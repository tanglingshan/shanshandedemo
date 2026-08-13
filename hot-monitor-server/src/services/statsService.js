// 统计服务：聚合仪表盘需要的热点数量和最新采集时间。
import { prisma } from "../lib/prisma.js";

export async function getOverviewStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 多个统计查询并行执行，减少仪表盘接口耗时。
  const [todayCount, sourceCount, analyzedCount, highImportanceCount, latestItem] = await Promise.all([
    prisma.hotItem.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.source.count({ where: { enabled: true } }),
    prisma.hotItem.count({ where: { analysisStatus: "completed" } }),
    prisma.hotItem.count({ where: { importanceLevel: { in: ["high", "critical"] } } }),
    prisma.hotItem.findFirst({ orderBy: { collectedAt: "desc" }, select: { collectedAt: true } })
  ]);

  return {
    todayCount,
    sourceCount,
    analyzedCount,
    highImportanceCount,
    latestCollectTime: latestItem?.collectedAt || null
  };
}
