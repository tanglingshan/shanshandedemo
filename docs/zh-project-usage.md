# 项目使用总览

本文档用于说明当前 AI 热点监控 MVP 的整体用途、目录结构和运行顺序。

## 1. 项目是什么

这是一个 AI 热点监控工具的 MVP 版本。

核心能力：

- 用户可以注册、登录。
- 登录后进入浅色后台仪表盘。
- 仪表盘展示实时热点列表。
- 后端定时采集 HackerNews、Bing、B站 三个来源。
- 后端通过 OpenAI 官方 Responses API 调用 Codex，对热点做摘要、评分和标签。
- 新热点可通过 Socket.io 实时推送到前端。

## 2. 当前目录说明

```text
ag/
  hot-monitor-web/       # 前端项目，React + Vite
  hot-monitor-server/    # 后端项目，Express + Prisma
  docs/                  # 中文使用说明和架构补充文档
  ARCHITECTURE.md        # 架构设计
  API_CONTRACT.md        # 接口约定
  DATABASE.md            # 数据库设计
  SOCKET_EVENTS.md       # Socket 事件说明
```

## 3. 当前前端数据说明

前端默认使用演示数据。

对应配置：

```env
VITE_USE_MOCKS=true
```

演示数据文件：

```text
hot-monitor-web/src/data/mockData.js
```

如果要使用真实后端数据，需要把前端 `.env` 改成：

```env
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## 4. 推荐运行顺序

如果只是看前端效果：

```bash
cd hot-monitor-web
npm install
npm run dev
```

如果要跑真实完整链路：

1. 准备 PostgreSQL。
2. 配置后端 `.env`。
3. 启动后端。
4. 把前端切到 `VITE_USE_MOCKS=false`。
5. 启动前端。

## 5. 必要环境

- Node.js `>=22.0.0`。
- npm。
- PostgreSQL。
- OpenAI API Key（`OPENAI_API_KEY`）。
- Codex 配置：`OPENAI_MODEL=gpt-5.3-codex`、`OPENAI_REASONING_EFFORT=low`、`OPENAI_TIMEOUT_MS=30000`、`OPENAI_MAX_RETRIES=2`。

## 6. 当前完成状态

已完成：

- 前端登录页、注册页、仪表盘页。
- 后端认证接口。
- 后端热点列表接口。
- Prisma 数据库模型。
- 初始化 migration。
- Socket.io 服务端和客户端。
- HackerNews、Bing、B站 MVP 采集器。

仍建议后续加强：

- 增加真实端到端测试。
- 增加后台采集日志页面。
- 增加用户订阅关键词功能。
- 增强 Bing / B站 采集稳定性。
