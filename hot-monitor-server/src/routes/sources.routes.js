// 数据源查询接口，用于前端展示当前启用的数据源。
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { listSources } from "../services/sourceService.js";

export const sourcesRouter = Router();

sourcesRouter.use(requireAuth);

sourcesRouter.get("/", async (req, res, next) => {
  try {
    res.json(success(await listSources()));
  } catch (error) {
    next(error);
  }
});
