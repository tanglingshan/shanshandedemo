// 仪表盘统计接口。
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { getOverviewStats } from "../services/statsService.js";

export const statsRouter = Router();

statsRouter.use(requireAuth);

statsRouter.get("/overview", async (req, res, next) => {
  try {
    res.json(success(await getOverviewStats()));
  } catch (error) {
    next(error);
  }
});
