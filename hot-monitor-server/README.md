# hot-monitor-server

AI 热点监控服务端 MVP。

## 技术栈

- Express 5 + JavaScript
- Prisma + PostgreSQL
- Session + Cookie 身份认证
- Socket.io 实时事件
- OpenAI Responses API AI 分析
- 每 5 分钟运行一次的数据采集调度器

## 运行环境要求

- Node.js `>=22.0.0`
- PostgreSQL
- 通过 `OPENAI_API_KEY` 访问 OpenAI 兼容代理

## 本地开发

1. 安装依赖（Node.js `>=22`）：

```bash
npm install
```

2. 准备本地配置和 PostgreSQL：

```powershell
.\\scripts\\setup-local.ps1
```

该脚本会将 `.env.example` 复制为被 Git 忽略的 `.env`，生成随机
`SESSION_SECRET`，检查 `localhost:5432`，生成 Prisma Client，并应用已提交的
migration。如果尚未安装 PostgreSQL，可通过 `-InstallPostgres` 参数运行（Windows
安装程序可能需要管理员权限）：

```powershell
.\\scripts\\setup-local.ps1 -InstallPostgres
```

默认本地连接地址为
`postgresql://postgres:postgres@localhost:5432/hot_monitor?schema=public`。
如果 PostgreSQL 安装程序没有创建数据库，请手动创建一次：

```bash
psql -U postgres -c "CREATE DATABASE hot_monitor;"
```

也可以手动根据 `.env.example` 创建 `.env`：

```bash
cp .env.example .env
```

`DATABASE_URL`、`SESSION_SECRET` 和 `OPENAI_API_KEY` 为必填项。未配置 OpenAI
兼容代理时，服务会主动快速失败。

3. （仅手动配置时）生成 Prisma Client 并运行 migration：

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. 启动 API：

```bash
npm run dev
```

## 生产环境 / Sealos

请使用带 PostgreSQL 的 Node.js 服务，并在 Sealos 中配置以下环境变量：

- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL`
- `SESSION_SECRET`
- `SESSION_COOKIE_NAME`
- `CORS_ORIGIN`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL=https://llmapi.xfcxb.com/v1`
- `OPENAI_MODEL=gpt-5.5`
- `OPENAI_REASONING_EFFORT=low`
- `OPENAI_TIMEOUT_MS=30000`
- `OPENAI_MAX_RETRIES=2`
- `COLLECTOR_INTERVAL_MINUTES=5`

`OPENAI_BASE_URL` 指向已配置的 OpenAI 兼容代理端点。当前代理提供
`gpt-5.5` 并支持 Responses API；其模型列表可能与官方 OpenAI 或 Codex 的模型名称不同。

部署命令：

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm start
```

## API

所有 API 响应均使用以下格式：

```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "errorCode": null
}
```

路由：

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/hot-items`
- `GET /api/hot-items/:id`
- `GET /api/stats/overview`
- `GET /api/sources`

## Socket 事件

服务端事件：

- `server:ready`
- `hot-item:new`
- `hot-item:update`
- `hot-item:batch`
- `stats:update`
- `collector:run-status`
- `server:error`

客户端事件：

- `dashboard:join`
- `dashboard:leave`
- `hot-items:subscribe`
- `hot-items:unsubscribe`

## Smoke 检查

```bash
npm run smoke
```
