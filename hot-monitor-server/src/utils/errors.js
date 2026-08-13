// 业务异常基类：同时携带 HTTP 状态码和前端可识别的错误编码。
export class ApiError extends Error {
  constructor(statusCode, message, errorCode = "API_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

// 创建资源不存在异常。
export function notFound(message = "资源不存在") {
  return new ApiError(404, message, "NOT_FOUND");
}

// 创建请求参数校验异常。
export function validationError(message = "参数校验失败") {
  return new ApiError(422, message, "VALIDATION_ERROR");
}
