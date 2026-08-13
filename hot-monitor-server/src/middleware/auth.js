// 认证中间件：只允许已经写入 Session userId 的用户继续访问受保护接口。
import { ApiError } from "../utils/errors.js";

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return next(new ApiError(401, "Unauthenticated", "UNAUTHENTICATED"));
  }

  return next();
}
