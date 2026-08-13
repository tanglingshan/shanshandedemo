// API 路由总入口，所有模块最终挂载到 /api 下。
import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { hotItemsRouter } from "./hotItems.routes.js";
import { sourcesRouter } from "./sources.routes.js";
import { statsRouter } from "./stats.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/health", healthRouter);
router.use("/hot-items", hotItemsRouter);
router.use("/sources", sourcesRouter);
router.use("/stats", statsRouter);
