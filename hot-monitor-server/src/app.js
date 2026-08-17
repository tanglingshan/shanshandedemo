// Express 应用工厂：集中注册安全中间件、请求解析、Session、路由和错误处理。
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export function createApp(sessionMiddleware) {
  const app = express();

  app.set("trust proxy", 1);
  // 基础安全响应头。
  app.use(helmet());
  // 允许前端携带 Session Cookie 调用后端接口。
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  // 解析 JSON 请求体，并限制单次请求大小。
  // Reference images arrive as base64 data URLs and may be several MB. Keep
  // this larger parser scoped to image generation; all other APIs retain the
  // smaller default request limit.
  app.use("/api/image-generations", express.json({ limit: "12mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  // Session 必须在业务路由之前挂载，认证中间件才能读取 req.session。
  app.use(sessionMiddleware);
  app.use("/api", router);
  // 未匹配的路由和业务异常统一由这里处理。
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
