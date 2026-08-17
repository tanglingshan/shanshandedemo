# AI 生图模块架构设计

## 1. 设计结论

建议将 AI 生图设计为独立的“AI 生图”工作区菜单，而不是塞进现有“AI 推荐”筛选项或热点评详情抽屉。

原因：

- 现有“AI 推荐”是热点评分/筛选能力；生图是主动创作能力，用户目标和交互流程不同。
- 生图通常包含提示词、尺寸、数量、风格、结果预览和历史记录，独立页面更容易扩展。
- 生图调用的供应商、鉴权方式和模型与当前文本分析 API 不同，服务边界和配置边界应明确隔离。

菜单建议放在侧边栏“创作工具”分组下：

```text
工作台
  总览
  HackerNews
  Bing
  B站
  AI 推荐
  高热度

创作工具
  AI 生图
```

MVP 页面可采用单页工作区：左侧为提示词和参数表单，右侧为生成结果网格；后续再增加“我的作品/历史”子页。

## 2. 服务端分层与文件边界

生图模块按现有 Express 分层新增以下边界（本阶段只定义，不实现业务代码）：

```text
hot-monitor-server/src/config/env.js
  读取并校验独立生图 API 配置

hot-monitor-server/src/services/imageGenerationService.js
  封装供应商 SDK/HTTP 调用、请求转换、响应归一化、超时和重试

hot-monitor-server/src/routes/imageGeneration.routes.js
  认证、参数校验、限流入口、统一响应包装

hot-monitor-server/src/routes/index.js
  挂载 /image-generations
```

路由只负责 HTTP 层，供应商细节不得泄漏到前端或路由文件。文本分析继续使用 `aiAnalyzer.js` 及其现有 `OPENAI_*` 配置，生图使用独立 service/client。

## 3. API 设计（MVP）

基础路径：`/api/image-generations`，所有接口要求现有 Session 登录。

### POST `/api/image-generations`

提交一次同步生图请求。若供应商响应较慢或返回异步任务，服务层应在内部轮询/转换，避免把供应商任务结构直接暴露给前端；超过超时则返回可识别的错误码。

请求体：

```json
{
  "prompt": "一张具有未来感的科技城市夜景",
  "negativePrompt": "模糊、低质量",
  "model": "optional-model-override",
  "size": "1024x1024",
  "n": 1,
  "quality": "standard",
  "style": "vivid"
}
```

MVP 校验建议：`prompt` 必填且长度 1–4000；`n` 限制 1–4；`size` 只允许服务端白名单；不允许前端任意覆盖供应商 URL、API key 或请求头。`model` 仅在服务端白名单中存在时允许覆盖，否则使用环境默认值。

成功响应沿用项目统一结构：

```json
{
  "success": true,
  "data": {
    "requestId": "generated-request-id",
    "provider": "image-provider",
    "model": "image-model",
    "images": [
      {
        "url": "https://provider.example/image.png",
        "b64Json": null,
        "revisedPrompt": "可选的供应商修订提示词"
      }
    ],
    "createdAt": "2026-08-17T00:00:00.000Z"
  },
  "message": "",
  "errorCode": null
}
```

前端只消费 `images[]` 的归一化结构。供应商返回的字段（例如 `data`, `output`, `task_id`）必须在 service 层转换。

### GET `/api/image-generations/history`（建议第二阶段）

如果需要作品历史，再增加分页查询；MVP 可以先不开放，生成结果仅在当前页面展示。不要为了单次生成引入数据库迁移。

## 4. 环境变量与密钥隔离

必须新建一组生图专用字段，不能复用现有 `OPENAI_*`：

```dotenv
# AI 生图供应商（服务端专用，禁止提交真实值）
IMAGE_GENERATION_ENABLED=true
IMAGE_API_KEY=replace-with-image-provider-key
IMAGE_BASE_URL=https://image-provider.example/v1
IMAGE_MODEL=image-model-name
IMAGE_TIMEOUT_MS=60000
IMAGE_MAX_RETRIES=1
IMAGE_MAX_N=4
IMAGE_ALLOWED_SIZES=1024x1024,1536x1024,1024x1536
```

命名约定：`IMAGE_API_KEY` 只在 Node 服务端读取，不进入 `hot-monitor-web` 的 `VITE_*` 环境变量；`IMAGE_BASE_URL` 与文本分析的 `OPENAI_BASE_URL` 完全独立；`IMAGE_TIMEOUT_MS`、`IMAGE_MAX_RETRIES` 使用独立的超时和重试策略；`IMAGE_MAX_N`、`IMAGE_ALLOWED_SIZES` 是服务端成本和资源保护白名单。

`src/config/env.js` 的校验策略建议：生产环境要求 `IMAGE_API_KEY`、`IMAGE_BASE_URL`、`IMAGE_MODEL`；开发环境若暂时不启用生图，可通过 `IMAGE_GENERATION_ENABLED=false` 关闭模块并允许缺少密钥。禁用时路由返回 `503` 和 `IMAGE_GENERATION_DISABLED`，而不是启动后才出现未定义错误。

## 5. 数据库建议

MVP 不新增数据库表：生成结果可能是临时 URL 或 base64，先返回前端展示，避免把第三方 URL 当作永久资源保存。

当产品需要“历史作品、再次编辑、收藏、审计或用量统计”时，再新增 `image_generations` 表，最少包含 `id`、`user_id`、`prompt`、`negative_prompt`、`provider`、`model`、`size`、`count`、`status`（`pending/succeeded/failed`）、`result_urls`（JSON 数组）、`revised_prompt`、`error_code`、`error_message`、`created_at`、`completed_at`。该表应关联 `users.id`，按 `user_id + created_at` 建索引；长期保存图片应接对象存储并保存对象键，不应依赖供应商临时 URL。

## 6. 安全、成本与可靠性策略

- 所有生图路由使用 `requireAuth`，未登录返回 401。
- 服务端做 prompt 长度、参数枚举、数量和尺寸校验；拒绝未知字段或至少忽略供应商相关字段。
- 增加按用户/IP 的短窗口限流和单次 `n` 上限，避免 API key 被滥用。
- 不在日志、错误响应或前端 payload 中输出 `IMAGE_API_KEY`；日志中的 prompt 应截断或脱敏。
- 上游错误统一映射为 `IMAGE_PROVIDER_ERROR`、`IMAGE_TIMEOUT`、`IMAGE_INVALID_RESPONSE`、`IMAGE_GENERATION_DISABLED`，不要透传供应商堆栈。
- 对可重试的网络错误最多重试一次；参数错误、内容策略拒绝不重试。
- 供应商若返回 base64，服务端应限制响应体大小；生产环境优先使用 URL/对象存储。

## 7. 前后端交接清单

后端代理新增独立 `IMAGE_*` env 读取、`.env.example` 注释和启动校验；新增 image generation service、route，并挂载到 routes index；遵循现有 `success(data)` / 错误处理中间件，不修改文本分析配置。

前端代理在侧边栏新增“AI 生图”入口及独立页面状态；在 `services/api.js` 增加 `imageGenerate(body)`，只调用 `/image-generations`；表单至少包含 prompt、尺寸、数量，处理 loading/error/空态；`VITE_*` 只配置服务端 API 地址。

测试代理需覆盖缺少/错误 `IMAGE_*` 配置、未登录、参数越界、上游超时/错误、供应商响应归一化和重复提交，并验证文本分析仍读取 `OPENAI_*`。

## 8. 分阶段实施顺序

1. 确认生图供应商协议（OpenAI Images 兼容、异步任务还是自定义 JSON）及可用模型。
2. 落地独立环境变量和 service 适配层。
3. 提供同步 `POST /image-generations`，用 mock provider 或固定响应完成联调。
4. 前端新增“AI 生图”工作区和结果预览。
5. 再决定是否引入历史表、对象存储和异步任务队列。

