# hot-monitor MVP 工作区

本工作区包含 AI 热点监控 MVP 的架构交付物。

## 中文使用文档

以下文档用于快速了解、运行和部署当前 MVP：

- [项目使用总览](docs/zh-project-usage.md)
- [前端使用说明](docs/zh-frontend-usage.md)
- [后端使用说明](docs/zh-backend-usage.md)
- [Sealos 部署说明](docs/zh-sealos-deploy.md)

## 已确定的技术决策

- 前端仓库：`hot-monitor-web`
- 后端仓库：`hot-monitor-server`
- 前端技术栈：React 19 + Vite + JavaScript + 普通 CSS
- 后端技术栈：Express 5 + JavaScript
- 运行环境：Node.js `>=22.0.0`
- 数据库：PostgreSQL + Prisma
- 认证方式：Session + Cookie
- 注册方式：邮箱/密码，开放注册
- 数据源：HackerNews、Bing、B 站
- 采集间隔：5 分钟
- AI 服务：OpenAI 官方 Responses API（必须使用 Codex）
- AI 配置：`OPENAI_API_KEY`、`OPENAI_MODEL=gpt-5.3-codex`、`OPENAI_REASONING_EFFORT=low`、`OPENAI_TIMEOUT_MS=30000`、`OPENAI_MAX_RETRIES=2`
- 实时通信：Socket.io
- 部署平台：Sealos

工作区中的文档定义了仓库拆分、数据模型、API 约定、Socket 事件、界面范围以及后续开发阶段的执行顺序。
