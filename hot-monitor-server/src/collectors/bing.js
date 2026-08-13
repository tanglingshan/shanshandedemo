import { load } from "cheerio";

// 根据数据源名称生成 Bing News RSS 查询地址。
function buildSearchUrl(source) {
  const keyword = source?.name || "AI";
  return `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=rss&setlang=zh-CN`;
}

// 为外部请求增加超时，避免某个数据源长时间阻塞整轮采集。
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Bing 采集器：读取 RSS XML，解析新闻条目并转换为统一热点结构。
export async function collectBing(source) {
  try {
    const response = await fetchWithTimeout(buildSearchUrl(source));
    // Bing 暂时不可用时返回空数组，让其他数据源继续工作。
    if (!response.ok) return [];

    const xml = await response.text();
    // Cheerio 以 XML 模式解析 RSS，避免手动处理 XML 字符串。
    const $ = load(xml, { xmlMode: true });

    return $("item")
      .toArray()
      .slice(0, 10)
      .map((item) => {
        const node = $(item);
        // RSS 节点字段可能为空，因此逐项读取并清理空白。
        const title = node.find("title").text().trim();
        const link = node.find("link").text().trim();
        const description = node.find("description").text().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const pubDate = node.find("pubDate").text().trim();

        if (!title) return null;

        return {
          sourceCode: "bing",
          sourceItemId: link || title,
          title,
          url: link || null,
          summary: description || null,
          hotScore: 300,
          publishedAt: pubDate || null,
          rawPayload: {
            title,
            link,
            description,
            pubDate
          }
        };
      })
      .filter(Boolean);
  } catch {
    // 网络超时、RSS 解析失败等问题降级为空结果，不影响其他来源。
    return [];
  }
}
