import { Router } from "express";
import { success } from "../utils/apiResponse.js";

// 健康检查路由：用于部署平台、负载均衡器或人工确认服务是否存活。
export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  // 返回服务状态、版本和当前时间，便于快速判断实例是否正常响应。
  res.json(success({
    status: "ok",
    version: process.env.npm_package_version || "0.1.0",
    timestamp: new Date().toISOString()
  }));
});
