# Sealos 部署说明

本文档说明如何把当前 MVP 部署到 Sealos。

## 1. 部署形态

推荐部署为两个应用：

- `hot-monitor-server`：Node.js `>=22.0.0` 后端服务。
- `hot-monitor-web`：前端静态站点。

数据库：

- PostgreSQL，使用 Sealos 数据库服务或应用市场 PostgreSQL。

## 2. 后端部署

### 环境变量

在 Sealos 后端应用中配置：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://用户名:密码@主机:端口/数据库名?schema=public
SESSION_SECRET=请换成长随机字符串
SESSION_COOKIE_NAME=hm.sid
CORS_ORIGIN=https://你的前端域名
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-5.3-codex
OPENAI_REASONING_EFFORT=low
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_RETRIES=2
COLLECTOR_INTERVAL_MINUTES=5
```

注意：

- `SESSION_SECRET` 不能使用示例值。
- `CORS_ORIGIN` 必须填写真实前端访问地址。
- `OPENAI_API_KEY` 必填，否则后端会启动失败。

### 构建 / 启动命令

安装命令：

```bash
npm install
```

启动前命令：

```bash
npm run prisma:generate && npm run prisma:deploy
```

启动命令：

```bash
npm start
```

暴露端口：

```text
3000
```

### 后端健康检查

部署后访问：

```text
https://你的后端域名/api/health
```

如果返回服务状态，说明后端基础服务已启动。

## 3. 前端部署

### 环境变量

在 Sealos 前端应用中配置：

```env
VITE_API_BASE_URL=https://你的后端域名/api
VITE_SOCKET_URL=https://你的后端域名
VITE_USE_MOCKS=false
```

说明：

- `VITE_USE_MOCKS=false` 表示使用真实后端。
- 如果只是演示页面，可以临时设置为 `true`。

### 构建命令

```bash
npm install
npm run build
```

静态产物目录：

```text
dist
```

## 4. 数据库迁移

后端部署时必须执行：

```bash
npm run prisma:deploy
```

该命令会执行：

```text
prisma/migrations/20260811150000_init/migration.sql
```

作用：

- 创建用户表。
- 创建数据源表。
- 创建热点表。
- 创建 AI 分析表。
- 创建采集记录表。

## 5. 部署后验证顺序

1. 打开后端健康检查。
2. 打开前端页面。
3. 注册一个账号。
4. 登录进入仪表盘。
5. 等待采集任务运行。
6. 检查热点列表是否出现真实数据。
7. 检查前端是否能收到实时推送。

## 6. 常见部署问题

### 后端启动失败

优先检查：

- `OPENAI_API_KEY` 是否配置。
- `DATABASE_URL` 是否正确。
- PostgreSQL 是否允许后端连接。
- `prisma:deploy` 是否执行成功。

### 前端接口 401

说明用户未登录或 Cookie 没有正确保存。

检查：

- 前端是否走真实后端。
- 后端 Cookie 配置是否适合当前域名。
- `CORS_ORIGIN` 是否为前端真实域名。

### 前端无热点数据

检查：

- 后端采集任务是否运行。
- 后端日志中是否有 OpenAI Responses API 或 Codex 报错。
- 数据库中 `hot_items` 是否有记录。
- Bing / B站 外部接口是否暂时不可访问。
