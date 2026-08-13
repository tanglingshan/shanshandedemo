// 数据源服务：维护系统默认数据源，并提供前端可用的数据源列表。
import { prisma } from "../lib/prisma.js";

export const defaultSources = [
  {
    code: "hackernews",
    name: "HackerNews",
    type: "news",
    enabled: true,
    pollIntervalMinutes: 5,
    sourceUrl: "https://news.ycombinator.com"
  },
  {
    code: "bing",
    name: "Bing",
    type: "search",
    enabled: true,
    pollIntervalMinutes: 5,
    sourceUrl: "https://www.bing.com"
  },
  {
    code: "bilibili",
    name: "B站",
    type: "video",
    enabled: true,
    pollIntervalMinutes: 5,
    sourceUrl: "https://www.bilibili.com"
  }
];

export async function ensureDefaultSources() {
  // 使用 upsert 保证服务重复启动不会创建重复数据源。
  await Promise.all(
    defaultSources.map((source) =>
      prisma.source.upsert({
        where: { code: source.code },
        update: {
          name: source.name,
          type: source.type,
          enabled: source.enabled,
          pollIntervalMinutes: source.pollIntervalMinutes,
          sourceUrl: source.sourceUrl
        },
        create: source
      })
    )
  );
}

export async function listSources() {
  await ensureDefaultSources();

  return prisma.source.findMany({
    where: { enabled: true },
    orderBy: { code: "asc" }
  });
}
