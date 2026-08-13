# hot-monitor-web

AI 热点监控工具的 React 19 前端 MVP，使用 Vite、JavaScript 和普通 CSS。

## Run

```bash
npm install
copy .env.example .env
npm run dev
```

默认使用 mock service，打开后即可体验注册、登录、仪表盘筛选和实时热点推送。

## Production build

```bash
npm run build
npm run preview
```

将 `.env` 中的 `VITE_USE_MOCKS` 改为 `false` 后，客户端会请求架构文档定义的后端 API：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/hot-items`
- `GET /api/stats/overview`
- `GET /api/hot-items/:id`

Socket 客户端预留了 `dashboard:join`、`hot-item:new`、`hot-item:update`、`hot-item:batch`、`stats:update` 等事件。
