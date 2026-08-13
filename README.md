# hot-monitor MVP workspace

This workspace currently holds the architecture deliverables for the AI hotspot monitoring MVP.

## 中文使用文档

下面几份文档用于快速理解、运行和部署当前 MVP：

- [项目使用总览](C:/Users/cmd/Desktop/ag/docs/zh-project-usage.md)
- [前端使用说明](C:/Users/cmd/Desktop/ag/docs/zh-frontend-usage.md)
- [后端使用说明](C:/Users/cmd/Desktop/ag/docs/zh-backend-usage.md)
- [Sealos 部署说明](C:/Users/cmd/Desktop/ag/docs/zh-sealos-deploy.md)

Frozen decisions:

- Frontend repo: `hot-monitor-web`
- Backend repo: `hot-monitor-server`
- Frontend stack: React 19 + Vite + JavaScript + plain CSS
- Backend stack: Express 5 + JavaScript
- Runtime: Node.js `>=22.0.0`
- Database: PostgreSQL + Prisma
- Auth: Session + Cookie
- Registration: email/password, open registration
- Data sources: HackerNews, Bing, B站
- Collect interval: 5 minutes
- AI provider: OpenAI official Responses API with Codex required
- AI configuration: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.3-codex`, `OPENAI_REASONING_EFFORT=low`, `OPENAI_TIMEOUT_MS=30000`, `OPENAI_MAX_RETRIES=2`
- Realtime: Socket.io
- Deployment: Sealos

The docs in this workspace define the repo split, data model, API contract, socket events, UI surface, and execution order for the next agent wave.
