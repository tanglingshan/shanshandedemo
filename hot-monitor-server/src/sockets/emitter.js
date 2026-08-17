// Socket.io 实例由启动入口注入，其他服务只通过本文件发送业务事件。
let ioInstance = null;

export function setSocketServer(io) {
  ioInstance = io;
}

// 新热点入库并完成分析后发送给仪表盘房间。
export function emitHotItemNew(hotItem) {
  ioInstance?.to("dashboard").emit("hot-item:new", { hotItem });
}

// 已存在热点被更新时发送更新事件。
export function emitHotItemUpdate(hotItem) {
  ioInstance?.to("dashboard").emit("hot-item:update", { hotItem });
}

// 批量推送热点，适合初始化或批处理场景。
export function emitHotItemBatch(items) {
  ioInstance?.to("dashboard").emit("hot-item:batch", { items });
}

// 统计数据变化后通知前端刷新仪表盘概览。
export function emitStatsUpdate(overview) {
  ioInstance?.to("dashboard").emit("stats:update", { overview });
}

// 推送某个数据源本轮采集的运行状态。
export function emitCollectorRunStatus(payload) {
  ioInstance?.to("dashboard").emit("collector:run-status", payload);
}

// 将采集或服务异常以统一事件格式通知前端。
function normalizeServerErrorMessage(error) {
  const message = typeof error === "string" ? error : error?.message;
  const errorName = typeof error === "object" ? error?.name : undefined;
  const rawMessage = String(message ?? "");
  const isJsonParseError =
    error instanceof SyntaxError ||
    errorName === "SyntaxError" ||
    /json\s*(?:\.parse|parse)|unexpected\s+(?:end|token)|invalid\s+json|json\s+parse/i.test(
      rawMessage
    );

  return isJsonParseError
    ? "数据格式错误，请稍后重试"
    : "热点采集或分析失败，请稍后重试";
}

export function emitServerError(message, code = "SERVER_ERROR") {
  ioInstance?.to("dashboard").emit("server:error", {
    message: normalizeServerErrorMessage(message),
    code
  });
}
