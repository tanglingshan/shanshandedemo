// 统一错误处理中间件，保证所有接口返回相同的数据结构。
import { failure } from "../utils/apiResponse.js";

export function notFoundHandler(req, res, next) {
  res.status(404).json(failure("接口不存在", "NOT_FOUND"));
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || "INTERNAL_ERROR";
  const isJsonParseError = err instanceof SyntaxError;

  if (statusCode >= 500 || isJsonParseError) {
    console.error(err);
  }

  const message = isJsonParseError
    ? "请求数据格式错误，请检查 JSON 内容"
    : err.message || "服务器内部错误";
  res.status(statusCode).json(failure(message, errorCode));
}
