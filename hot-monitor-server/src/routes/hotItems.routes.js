// 热点查询接口，所有接口都要求用户先完成认证。
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { getHotItemById, listHotItems } from "../services/hotItemService.js";

export const hotItemsRouter = Router();

hotItemsRouter.use(requireAuth);

hotItemsRouter.get("/", async (req, res, next) => {
  try {
    const result = await listHotItems(req.query);
    res.json(success(result));
  } catch (error) {
    next(error);
  }
});

hotItemsRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await getHotItemById(req.params.id);
    res.json(success(item));
  } catch (error) {
    next(error);
  }
});
