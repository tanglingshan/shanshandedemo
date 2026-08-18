# API 约定

## Hot-item AI settings

### GET `/settings/hot-item-ai`

Requires an authenticated session. The response includes `requestedEnabled`,
`allowedByEnvironment`, `providerConfigured`, `effectiveEnabled`,
`analysisMode` (`future_only`), and `updatedAt`.

### PATCH `/settings/hot-item-ai`

Requires an authenticated session. The request body must contain only
`{ "enabled": true|false }`. Disabling is always persisted. Enabling returns
`409 AI_ANALYSIS_NOT_ALLOWED` when `HOT_ITEM_AI_ALLOWED` is false, or
`503 AI_PROVIDER_NOT_CONFIGURED` when the provider key is unavailable.

基础路径：`/api`

## 认证

### POST `/auth/register`

请求参数：

- `email`
- `password`
- `confirmPassword`

响应：

- 用户摘要

### POST `/auth/login`

请求参数：

- `email`
- `password`

响应：

- 用户摘要
- 服务端设置的 Session Cookie

### POST `/auth/logout`

响应：

- Session 已清除

### GET `/auth/me`

响应：

- 当前用户摘要，未认证时返回 `401`

## 仪表盘

### GET `/hot-items`

查询参数：

- `page`
- `pageSize`
- `source`
- `sort`
- `keyword`
- `from`
- `to`
- `importanceLevel`

响应：

- 分页后的热点列表

### GET `/hot-items/:id`

响应：

- 热点详情
- AI 分析详情
- 来源追踪信息

### GET `/stats/overview`

响应：

- 今日热点数量
- 数据源数量
- 已分析数量
- 高重要性热点数量
- 最近采集时间

### GET `/sources`

响应：

- 已启用的数据源及其标签

### GET `/health`

响应：

- 服务健康状态和版本

## 响应结构

所有 JSON 响应统一包含以下字段：

- `success`
- `data`
- `message`
- `errorCode`

## 错误情况

- `401`：未认证
- `403`：无权限
- `404`：资源不存在
- `422`：参数校验错误
- `500`：内部错误
