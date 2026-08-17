// 采集器注册表：用数据源 code 映射到具体采集函数，便于服务层统一调度。
import { collectBilibili } from "./bilibili.js";
import { collectBing } from "./bing.js";
import { collectHackerNews } from "./hackerNews.js";

export const collectors = {
  // 键必须与数据库 sources.code 保持一致。
  hackernews: collectHackerNews,
  bing: collectBing,
  bilibili: collectBilibili
};
