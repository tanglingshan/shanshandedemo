# hot-monitor-server

Backend MVP for the AI hotspot monitor.

## Stack

- Express 5 + JavaScript
- Prisma + PostgreSQL
- Session + Cookie auth
- Socket.io realtime events
- OpenAI Responses API AI analysis
- 5-minute collector scheduler

## Runtime Requirements

- Node.js `>=22.0.0`
- PostgreSQL
- OpenAI-compatible proxy access through `OPENAI_API_KEY`

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill required values:

```bash
cp .env.example .env
```

`DATABASE_URL`, `SESSION_SECRET`, and `OPENAI_API_KEY` are required. The service intentionally fails fast when the OpenAI-compatible proxy is not configured.

3. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Start the API:

```bash
npm run dev
```

## Production / Sealos

Use a Node.js service with PostgreSQL. Configure these environment variables in Sealos:

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

`OPENAI_BASE_URL` points to the configured OpenAI-compatible proxy endpoint. The current proxy exposes `gpt-5.5` and supports the Responses API. Its model list may differ from official OpenAI or Codex model names.

Deploy command:

```bash
npm install
npm run prisma:generate
npm run prisma:deploy
npm start
```

## API

All API responses use:

```json
{
  "success": true,
  "data": {},
  "message": "OK",
  "errorCode": null
}
```

Routes:

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/hot-items`
- `GET /api/hot-items/:id`
- `GET /api/stats/overview`
- `GET /api/sources`

## Socket Events

Server events:

- `server:ready`
- `hot-item:new`
- `hot-item:update`
- `hot-item:batch`
- `stats:update`
- `collector:run-status`
- `server:error`

Client events:

- `dashboard:join`
- `dashboard:leave`
- `hot-items:subscribe`
- `hot-items:unsubscribe`

## Smoke Check

```bash
npm run smoke
```
