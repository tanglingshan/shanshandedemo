# 后端使用说明

本文档说明 `hot-monitor-server` 后端项目如何配置、运行和检查。

## 1. 项目位置

```text
C:/Users/cmd/Desktop/ag/hot-monitor-server
```

## 2. 技术栈

- Express 5
- JavaScript ESM
- Prisma
- PostgreSQL
- express-session
- connect-pg-simple
- Socket.io
- Node.js `>=22.0.0`
- OpenAI 官方 Responses API + Codex

## 3. 安装依赖

```bash
cd C:/Users/cmd/Desktop/ag/hot-monitor-server
npm install
```

## 4. 配置环境变量

复制环境变量示例：

```bash
copy .env.example .env
```

核心配置说明：

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hot_monitor?schema=public
SESSION_SECRET=replace-with-a-long-random-session-secret
SESSION_COOKIE_NAME=hm.sid
CORS_ORIGIN=http://localhost:5173
OPENAI_API_KEY=replace-with-openai-api-key
OPENAI_MODEL=gpt-5.3-codex
OPENAI_REASONING_EFFORT=low
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_RETRIES=2
COLLECTOR_INTERVAL_MINUTES=5
```

字段注释：

- `DATABASE_URL`：PostgreSQL 连接地址。
- `SESSION_SECRET`：Session 加密密钥，生产环境必须换成长随机字符串。
- `CORS_ORIGIN`：允许访问后端的前端地址。
- `OPENAI_API_KEY`：OpenAI API Key，当前项目必填。
- `OPENAI_MODEL`：通过 OpenAI Responses API 调用的 Codex 模型，默认使用 `gpt-5.3-codex`。
- `OPENAI_REASONING_EFFORT`：Codex 推理强度，默认使用 `low`。
- `OPENAI_TIMEOUT_MS`：OpenAI 请求超时时间，默认 `30000` 毫秒。
- `OPENAI_MAX_RETRIES`：OpenAI 请求失败后的最大重试次数，默认 `2`。
- `COLLECTOR_INTERVAL_MINUTES`：采集间隔，当前需求为 5 分钟。

## 5. 初始化数据库

生成 Prisma Client：

```bash
npm run prisma:generate
```

开发环境迁移：

```bash
npm run prisma:migrate
```

生产环境迁移：

```bash
npm run prisma:deploy
```

说明：

- `prisma/migrations/20260811150000_init/migration.sql` 是初始化建表文件。
- 新 PostgreSQL 实例需要先执行迁移，否则后端无法正常访问数据表。

## 6. 启动后端

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

默认服务地址：

```text
http://localhost:3000
```

健康检查：

```text
GET http://localhost:3000/api/health
```

## 7. 主要接口

认证接口：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

热点接口：

- `GET /api/hot-items`
- `GET /api/hot-items/:id`

统计接口：

- `GET /api/stats/overview`

数据源接口：

- `GET /api/sources`

## 8. Socket 事件

客户端发送：

- `dashboard:join`
- `dashboard:leave`
- `hot-items:subscribe`
- `hot-items:unsubscribe`

服务端推送：

- `hot-item:new`
- `hot-item:update`
- `hot-item:batch`
- `stats:update`
- `collector:run-status`
- `server:error`

## 9. 采集器说明

当前采集源：

- HackerNews：使用 Algolia HackerNews API。
- Bing：使用 Bing News RSS。
- B站：使用公开排行榜接口。

采集流程：

1. 定时任务读取启用的数据源。
2. 调用对应采集器。
3. 入库并去重。
4. 调用 OpenAI 官方 Responses API，由 Codex 完成 AI 分析。
5. 通过 Socket.io 推送新热点。

## 10. 检查命令

Smoke 检查：

```bash
npm run smoke
```

Prisma schema 校验：

```bash
npx prisma validate
```

Prisma Client 生成：

```bash
npm run prisma:generate
```

## 11. 常见问题

### 后端启动时报缺少环境变量

项目会故意 fail-fast。

必须配置：

- `DATABASE_URL`
- `SESSION_SECRET`
- `OPENAI_API_KEY`

### 数据库连接失败

检查：

- PostgreSQL 是否启动。
- 数据库名是否存在。
- `DATABASE_URL` 用户名、密码、端口是否正确。

### 前端登录失败

检查：

- 后端是否启动在 `3000`。
- 前端是否设置 `VITE_USE_MOCKS=false`。
- `CORS_ORIGIN` 是否等于前端地址。
- Cookie 是否被浏览器拦截。
