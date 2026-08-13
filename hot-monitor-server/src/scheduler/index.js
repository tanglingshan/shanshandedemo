import { env } from "../config/env.js";
import { runAllCollectors } from "../services/collectorService.js";

// timer 用于避免重复注册定时器，running 用于防止采集任务重叠执行。
let timer = null;
let running = false;

export function startCollectorScheduler() {
  if (timer) {
    return timer;
  }

  const intervalMs = env.collectorIntervalMinutes * 60 * 1000;

  async function tick() {
    // 如果上一轮还未结束，本轮直接跳过，避免重复写入和资源竞争。
    if (running) {
      return;
    }

    running = true;
    try {
      await runAllCollectors();
    } finally {
      running = false;
    }
  }

  // 定时执行后续采集；额外延迟 2 秒执行一次，保证服务启动后尽快有数据。
  timer = setInterval(tick, intervalMs);
  setTimeout(tick, 2000);
  return timer;
}

export function stopCollectorScheduler() {
  if (timer) {
    // 关闭服务时清除定时器，避免 Node 进程被后台任务继续持有。
    clearInterval(timer);
    timer = null;
  }
}
