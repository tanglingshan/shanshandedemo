// 成功响应的统一格式，保证前端可以用同一方式读取所有 API 结果。
export function success(data = null, message = "OK") {
  return {
    success: true,
    data,
    message,
    errorCode: null
  };
}

// 失败响应的统一格式，通常由错误处理中间件调用。
export function failure(message = "服务器内部错误", errorCode = "INTERNAL_ERROR") {
  return {
    success: false,
    data: null,
    message,
    errorCode
  };
}
