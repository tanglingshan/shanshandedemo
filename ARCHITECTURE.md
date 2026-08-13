# Architecture Outline

## 1. Goal
Build a deployable MVP for real-time AI hotspot monitoring with login, collection, AI analysis, and live dashboard delivery.

## 2. System Split
- `hot-monitor-web`: React dashboard app
- `hot-monitor-server`: Express API, collector, AI analysis, Socket.io, Prisma

## 3. Runtime Shape
- Browser loads the web app
- Web app authenticates through session cookies
- Web app fetches hotspot data from the server API
- Server runs 5-minute collectors for HackerNews, Bing, and B站
- Server sends new hotspots through Socket.io
- Server runs on Node.js `>=22.0.0`
- Server uses the OpenAI official Responses API with Codex (`gpt-5.3-codex`) for analysis before publishing items

## 4. Core Modules
- Auth and session management
- Source collectors
- Normalization and deduplication
- AI analysis and scoring
- Hot item list and stats API
- Real-time push channel
- Dashboard UI

## 5. Non-goals for MVP
- Team workspaces
- Paid plans
- Third-party login
- Manual content moderation console
- Skill packaging

## 6. Delivery Rule
Architecture first, then backend and frontend in parallel, then test/review, then merge.
