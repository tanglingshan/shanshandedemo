import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Smoke Check 只验证项目骨架、配置导入和 Prisma schema，不访问真实外部服务。
const root = process.cwd();
const requiredFiles = [
  "package.json",
  ".env.example",
  "README.md",
  "prisma/schema.prisma",
  "prisma/migrations/20260811150000_init/migration.sql",
  "src/server.js",
  "src/app.js",
  "src/routes/auth.routes.js",
  "src/routes/hotItems.routes.js",
  "src/routes/stats.routes.js",
  "src/sockets/index.js",
  "src/scheduler/index.js"
];

// 先检查部署和启动所需的关键文件是否齐全。
const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error(`Smoke check failed. Missing files: ${missing.join(", ")}`);
  process.exit(1);
}

// 再确认 package.json 中保留了开发、启动和 Prisma 相关命令。
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const script of ["dev", "start", "prisma:generate", "prisma:deploy"]) {
  if (!pkg.scripts?.[script]) {
    console.error(`Smoke check failed. Missing npm script: ${script}`);
    process.exit(1);
  }
}

// 为测试环境补充安全的临时默认值，避免 smoke 检查依赖本地真实密钥。
process.env.DATABASE_URL ||= "postgresql://user:password@localhost:5432/hot_monitor?schema=public";
process.env.SESSION_SECRET ||= "smoke-test-session-secret";
process.env.OPENAI_API_KEY ||= "smoke-test-openai-key";

// Prisma validate 只校验 schema 和配置结构，不会执行数据库写入。
const prismaValidate = spawnSync("npx prisma validate", {
  cwd: root,
  encoding: "utf8",
  env: process.env,
  shell: true
});

if (prismaValidate.status !== 0) {
  if (prismaValidate.error) console.error(prismaValidate.error);
  console.error(prismaValidate.stdout);
  console.error(prismaValidate.stderr);
  process.exit(prismaValidate.status || 1);
}

// 用空 Session 中间件创建 Express 应用，验证核心模块可以正常导入和组装。
const noopSession = (_req, _res, next) => next();
const [{ createApp }, { router }, { env }] = await Promise.all([
  import("../src/app.js"),
  import("../src/routes/index.js"),
  import("../src/config/env.js")
]);

if (typeof createApp !== "function" || typeof router !== "function" || !env.openaiApiKey) {
  console.error("Smoke check failed. App, router, or env import is invalid.");
  process.exit(1);
}

createApp(noopSession);

console.log("Smoke check passed.");
