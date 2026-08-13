// B 站全区排行榜接口，rid=0 表示不限定具体分区。
const rankingUrl = "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all";

// 为 B 站请求设置超时，防止第三方接口异常拖慢采集任务。
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// B 站采集器：获取排行榜视频，并转换成系统统一的热点对象。
export async function collectBilibili() {
  try {
    const response = await fetchWithTimeout(rankingUrl, {
      headers: {
        // 携带基础请求头，降低接口对非浏览器请求的拦截概率。
        "user-agent": "Mozilla/5.0 hot-monitor/0.1",
        referer: "https://www.bilibili.com/"
      }
    });

    // 接口返回非成功状态时跳过本轮，不抛出影响全局的异常。
    if (!response.ok) return [];

    const payload = await response.json();
    const list = payload?.data?.list || [];

    // 将播放量、发布时间等 B 站字段映射为系统字段。
    return list.slice(0, 10).map((item) => ({
      sourceCode: "bilibili",
      sourceItemId: String(item.aid || item.bvid || item.title),
      title: item.title,
      url: item.short_link_v2 || item.short_link || `https://www.bilibili.com/video/${item.bvid}`,
      summary: item.desc || item.owner?.name || null,
      hotScore: Number(item.stat?.view || item.stat?.like || 0),
      publishedAt: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : null,
      rawPayload: item
    })).filter((item) => item.title);
  } catch {
    // 网络错误或响应结构异常时返回空数组，保证其他来源仍可采集。
    return [];
  }
}
