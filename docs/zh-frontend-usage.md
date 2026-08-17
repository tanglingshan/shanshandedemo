# 前端使用说明

本文档说明 `hot-monitor-web` 前端项目如何运行、如何切换演示数据和真实后端数据。

## 1. 项目位置

```text
./hot-monitor-web
```

## 2. 技术栈

- React 19
- Vite
- Node.js `>=22.0.0`
- JavaScript
- 普通 CSS
- Socket.io Client
- Vitest

## 3. 安装依赖

```bash
cd hot-monitor-web
npm install
```

## 4. 启动开发服务

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:5173/
```

## 5. 默认演示模式

前端默认使用 mock 数据，不需要后端即可体验。

配置文件：

```text
hot-monitor-web/.env.example
```

关键配置：

```env
VITE_USE_MOCKS=true
```

含义：

- `true`：使用本地演示数据。
- `false`：请求真实后端接口。

演示数据位置：

```text
hot-monitor-web/src/data/mockData.js
```

## 6. 切换真实后端

复制环境变量文件：

```bash
copy .env.example .env
```

然后修改 `.env`：

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_USE_MOCKS=false
```

注意：

- 后端必须已经启动。
- 后端必须允许当前前端地址跨域访问。
- 后端需要 Session Cookie，所以请求会自动携带 `credentials: include`。

## 7. 页面说明

### 登录页

用于邮箱密码登录。

### 注册页

用于邮箱密码注册。

### 仪表盘页

包含：

- 左侧导航。
- 顶部用户信息和刷新按钮。
- 数据概览卡片。
- 来源筛选。
- 关键词搜索。
- 排序选择。
- 热点表格。
- 热点详情抽屉。
- 新热点实时提示。

## 8. 构建生产版本

```bash
npm run build
```

构建产物：

```text
hot-monitor-web/dist
```

本地预览：

```bash
npm run preview
```

## 9. 测试

```bash
npm test
```

当前测试主要验证 mock API 合同。

## 10. 常见问题

### 页面显示的是演示数据吗？

如果 `VITE_USE_MOCKS=true`，就是演示数据。

### 为什么真实后端没有数据？

检查：

- 前端是否设置 `VITE_USE_MOCKS=false`。
- 后端是否启动。
- 后端数据库是否已迁移。
- 后端是否已经完成采集任务。
- `OPENAI_API_KEY` 是否配置。

### 登录后刷新页面回到登录页？

真实后端模式下请检查：

- 后端 Session 是否可用。
- Cookie 是否被浏览器保存。
- 前端和后端跨域配置是否正确。
