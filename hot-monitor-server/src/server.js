// 后端启动入口：负责组装 HTTP 服务、Session、Socket.io、数据库初始化和定时采集任务。
import http from "node:http";
import session from "express-session";
import pg from "pg";
import connectPgSimple from "connect-pg-simple";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { setupSocket } from "./sockets/index.js";
import { startCollectorScheduler } from "./scheduler/index.js";
import { ensureDefaultSources } from "./services/sourceService.js";

const PgSession = connectPgSimple(session);
// 使用 PostgreSQL 保存 Session，避免服务重启后登录状态全部丢失。
const pgPool = new pg.Pool({ connectionString: env.databaseUrl });

// Session Cookie 只保存会话标识，真正的用户信息保存在 PostgreSQL 的 Session 表中。
export const sessionMiddleware = session({
  store: new PgSession({
    pool: pgPool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  name: env.sessionCookieName,
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
});

// Express 负责 HTTP API，Socket.io 复用同一个 HTTP Server。
const app = createApp(sessionMiddleware);
const server = http.createServer(app);
setupSocket(server, sessionMiddleware);

async function start() {
  // 服务启动前确保三个默认数据源已经存在。
  await ensureDefaultSources();

  server.listen(env.port, () => {
    console.log(`hot-monitor-server listening on port ${env.port}`);
    // HTTP 服务启动成功后，开始执行首次采集和后续定时采集。
    startCollectorScheduler();
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
  console.log("Shutting down hot-monitor-server");
  // 优雅关闭 HTTP、Prisma 和 PostgreSQL 连接池。
  server.close();
  await prisma.$disconnect();
  await pgPool.end();
  process.exit(0);
}

start().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  await pgPool.end();
  process.exit(1);
});
