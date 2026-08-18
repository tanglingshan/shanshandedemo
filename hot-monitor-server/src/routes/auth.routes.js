// 用户认证接口：注册、登录、退出登录和获取当前用户。
import { Router } from "express";
import { success } from "../utils/apiResponse.js";
import { login, register, toUserSummary } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { createAccessToken } from "../services/accessTokenService.js";
import { env } from "../config/env.js";

export const authRouter = Router();

function authResponse(user) {
  return {
    ...toUserSummary(user),
    accessToken: createAccessToken(user),
    tokenType: "Bearer",
    expiresIn: env.authTokenTtlSeconds
  };
}

function regenerateSession(req) {
  // 登录成功后重新生成 Session，降低会话固定攻击风险。
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req) {
  // 退出登录时销毁服务端 Session。
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const user = await register(req.body);
    // 注册成功后自动建立登录态，用户无需再次登录。
    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    res.status(201).json(success(authResponse(user), "Registered"));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const user = await login(req.body);
    // 登录成功后只把 userId 写入 Session，不把敏感信息写入 Cookie。
    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);
    res.json(success(authResponse(user), "Logged in"));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    await destroySession(req);
    res.clearCookie(process.env.SESSION_COOKIE_NAME || "hm.sid");
    res.json(success(null, "Logged out"));
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    res.json(success(toUserSummary(user)));
  } catch (error) {
    next(error);
  }
});
