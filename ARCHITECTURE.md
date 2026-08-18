# 架构概要

## Hot-item AI feature gate

Hot-item AI is controlled by the persisted singleton `AppSetting` and the
deployment environment variable `HOT_ITEM_AI_ALLOWED`. The persisted value is
the user's requested state; the effective state additionally requires a
configured provider key. Collection remains available with AI disabled. Only
new or content-changed items are analyzed while enabled, and failed analyses
are retried; items collected while disabled are marked `disabled`.

## 1. 目标

构建可部署的实时 AI 热点监控 MVP，支持登录、热点采集、AI 分析以及仪表盘实时推送。

## 2. 系统拆分

- `hot-monitor-web`：React 仪表盘应用
- `hot-monitor-server`：Express API、采集器、AI 分析、Socket.io 和 Prisma 服务

## 3. 运行形态

- 浏览器加载 Web 应用。
- Web 应用通过 Session Cookie 完成认证。
- Web 应用从服务端 API 获取热点数据。
- 服务端每 5 分钟运行一次 HackerNews、Bing 和 B 站采集器。
- 服务端通过 Socket.io 推送新热点。
- 服务端运行环境为 Node.js `>=22.0.0`。
- 服务端在发布热点前，使用带 Codex（`gpt-5.3-codex`）的 OpenAI 官方 Responses API 进行分析。

## 4. 核心模块

- 用户认证与 Session 管理
- 数据源采集器
- 数据归一化与去重
- AI 分析与评分
- 热点列表和统计 API
- 实时推送通道
- 仪表盘界面

## 5. MVP 不包含的范围

- 团队工作区
- 付费套餐
- 第三方登录
- 人工内容审核控制台
- Skill 打包

## 6. 交付规则

先完成架构设计，再并行开发后端和前端，随后进行测试/审查，最后合并。
