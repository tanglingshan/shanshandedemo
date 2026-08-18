import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { success } from "../utils/apiResponse.js";
import { validationError } from "../utils/errors.js";
import {
  getHotItemAiSetting,
  updateHotItemAiSetting
} from "../services/hotItemAiSettingService.js";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/hot-item-ai", async (_req, res, next) => {
  try {
    res.json(success(await getHotItemAiSetting()));
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/hot-item-ai", async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      throw validationError("Request body must be { enabled: boolean }");
    }
    const keys = Object.keys(req.body);
    if (keys.length !== 1 || keys[0] !== "enabled") {
      throw validationError("Request body must contain only enabled");
    }
    if (typeof req.body.enabled !== "boolean") {
      throw validationError("enabled must be a boolean");
    }

    res.json(success(await updateHotItemAiSetting(req.body.enabled)));
  } catch (error) {
    next(error);
  }
});
