# AI 生图增强架构：预览、提示词润色与历史

本文是下一阶段实现的接口和数据约定。现有 `POST /api/image-generations` 保持兼容；新增能力均挂在同一资源下。

## 1. 数据模型（Prisma/PostgreSQL）

历史必须按登录用户隔离。生图调用是外部副作用，不能包在数据库事务里等待；采用“先写 pending、调用供应商、原子更新结果”的状态机。这样进程崩溃后仍能发现悬挂任务，且成功结果不会因只写内存而丢失。

建议在 `User` 增加反向关系，并新增两个模型（单次请求一个 history，多张图片一对多）：

```prisma
model User {
  // existing fields ...
  imageGenerationHistories ImageGenerationHistory[]
}

model ImageGenerationHistory {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  requestId       String   @unique @map("request_id") // server request id/idempotency key
  prompt          String
  negativePrompt  String?  @map("negative_prompt")
  model           String
  provider        String
  size            String
  count           Int      @default(1)
  quality         String?
  style           String?
  referenceHash   String?  @map("reference_hash") // never persist the input data URL
  status          String   @default("pending") // pending|succeeded|failed
  revisedPrompt   String?  @map("revised_prompt")
  errorCode       String?  @map("error_code")
  errorMessage    String?  @map("error_message") // sanitized, bounded text
  createdAt       DateTime @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  images          ImageGenerationImage[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, status, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Asc)]) // stale pending reconciliation
  @@map("image_generation_histories")
}

model ImageGenerationImage {
  id            String                 @id @default(cuid())
  historyId     String                 @map("history_id")
  history       ImageGenerationHistory @relation(fields: [historyId], references: [id], onDelete: Cascade)
  ordinal       Int
  providerUrl   String?                @map("provider_url")
  storageKey    String?                @map("storage_key") // durable object-storage key
  mimeType      String?                @map("mime_type")
  data          Bytes?                 @db.ByteA // optional provider b64 decoded bytes
  revisedPrompt String?                @map("revised_prompt")
  createdAt     DateTime               @default(now()) @map("created_at")

  @@unique([historyId, ordinal])
  @@index([historyId, ordinal])
  @@map("image_generation_images")
}
```

`data` 与 `storageKey` 二选一即可：若供应商返回 `b64_json`，解码后写 `data`；若返回 URL，先写 `providerUrl`，生产环境应由资源存储适配器上传并写 `storageKey`，历史预览接口只返回受控的 `/api/image-generations/images/:id` URL。API key、完整 reference data URL、上游原始响应都不得入库。若项目决定只保存元数据，可暂时省略 `data/storageKey`，但必须接受供应商 URL 过期后历史无法预览的产品限制。

### 保存/失败策略

1. 生成入口先校验并 `create` 一条 `pending` history（请求参数只保留白名单；`referenceHash` 用 SHA-256）。
2. 调用 `IMAGE_*` 供应商；供应商成功后，在一个 `prisma.$transaction` 中更新 history 为 `succeeded`、写入 images、`completedAt`。
3. 供应商错误或超时，在一个原子更新中写 `failed`、规范化 `errorCode`（如 `IMAGE_TIMEOUT`）和截断后的 `errorMessage`，不写密钥或上游响应体，然后向前端返回原有错误码。
4. 进程在第 2 步前崩溃会留下 pending；定时任务或读取接口将超过 15 分钟的 pending 标记为 `failed`（`IMAGE_GENERATION_STALE`）。数据库写入失败时不要伪造成功历史，接口返回 503 并记录 requestId 供重试。

## 2. API 契约

### POST `/api/image-generations/polish`

复用文本分析的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，不读取也不转发 `IMAGE_API_KEY`。需要登录和独立的短窗口限流。

请求：

```json
{
  "prompt": "一个老人站在海边",
  "negativePrompt": "模糊、低质量",
  "style": "电影感",
  "language": "zh-CN"
}
```

`prompt` 必填 1–1000 字符；其余字段可选且各限 200 字符。服务端用 Responses API（`env.openai*`）要求严格 JSON 输出，不把用户输入拼接为系统指令。响应：

```json
{
  "success": true,
  "data": {
    "prompt": "经过扩写、主体/构图/光线明确的提示词",
    "negativePrompt": "整理后的反向提示词",
    "model": "gpt-5.5",
    "requestId": "uuid",
    "createdAt": "2026-08-17T00:00:00.000Z"
  },
  "message": "OK",
  "errorCode": null
}
```

润色失败只影响润色请求，不创建生图历史；前端保留原 prompt 并提示重试。润色结果只有在用户点击“生成”后才作为 generation history 的 `prompt` 保存。

### GET `/api/image-generations/history`

需要登录，只查询 `where: { userId: req.session.userId }`。查询参数：`page`（默认 1）、`pageSize`（默认 20，最大 50）、可选 `status`。排序 `createdAt desc, id desc`，避免同一毫秒分页漂移。响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cl...",
        "prompt": "...",
        "negativePrompt": null,
        "model": "gpt-image-2",
        "size": "1024x1024",
        "count": 1,
        "status": "succeeded",
        "images": [{ "id": "cl...", "url": "/api/image-generations/images/cl...", "revisedPrompt": null }],
        "createdAt": "2026-08-17T00:00:00.000Z",
        "completedAt": "2026-08-17T00:00:02.000Z",
        "errorCode": null
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  },
  "message": "OK",
  "errorCode": null
}
```

`GET /api/image-generations/images/:id` 同样需要登录，并通过图片记录的 history.userId 做归属校验后才流式返回二进制；不能把任意 `providerUrl` 直接做代理。

## 3. 前端边界

- 生成成功后立即使用 `images[].url`；`b64Json` 转成 `data:image/*;base64,...` 仅作为当前响应兜底，不写 `localStorage`。
- 点击图片打开遮罩预览（原图、关闭、下载）；历史页使用分页缩略图，加载失败显示“资源已过期/重新生成”。
- “AI 润色”只替换编辑框内容，提供“应用/撤销”；润色请求与生图请求分别显示 loading，禁止重复提交。
- 历史列表不展示 `referenceHash`、provider 内部 URL、错误详情；删除能力若后续开放必须按 `userId` 做级联删除。

## 4. 迁移与上线顺序

1. 更新 `schema.prisma` 与 Prisma Client：`npm run prisma:generate`。
2. 本地执行 `npx prisma migrate dev --name add_image_generation_history`，审查 SQL 后提交 migration；生产执行 `npm run prisma:deploy`。
3. 先部署兼容的读写服务（旧客户端仍可 POST）；再开放 polish/history 前端入口。回滚应用代码不回滚迁移，保留表以兼容已写入数据。
4. 配置图片资源存储后再启用 `storageKey` 写入；定期清理超过保留期的图片数据，但保留审计元数据。

## 5. 安全约束

- `IMAGE_*` 与 `OPENAI_*` 凭据严格隔离，均只在服务端读取；浏览器不得传 model/baseUrl/api key 覆盖服务端配置。
- history、图片二进制和下载接口全部要求 Session；任何 id 查询都必须同时约束 `userId`。
- prompt、错误消息、revisedPrompt 入库前截断并去除控制字符；日志只记录 requestId、耗时和状态。
- 生成和润色都做按用户/IP 限流；分页参数、status 枚举、图片 id 做严格校验。
