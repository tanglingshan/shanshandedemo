// Hacker News 采集器：通过 Algolia 的公开接口获取最新 story。
export async function collectHackerNews() {
  const response = await fetch("https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=10");

  // 非 2xx 响应交给上层统一记录为本次数据源采集失败。
  if (!response.ok) {
    throw new Error(`HackerNews 数据采集失败: ${response.status}`);
  }

  const payload = await response.json();

  // 将第三方字段转换为系统内部统一的热点对象格式。
  return (payload.hits || [])
    .filter((item) => item.title && (item.url || item.objectID))
    .map((item) => ({
      sourceCode: "hackernews",
      sourceItemId: item.objectID,
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      summary: item.story_text || null,
      hotScore: item.points || 0,
      publishedAt: item.created_at,
      rawPayload: item
    }));
}
