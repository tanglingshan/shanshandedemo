# 前端最小界面范围

仓库：`hot-monitor-web`

## 页面

- `LoginPage`
- `RegisterPage`
- `DashboardPage`

## 仪表盘布局

- `AppShell`
- `Sidebar`
- `TopBar`
- `OverviewCards`
- `FiltersBar`
- `HotItemTable`
- `HotItemDetailDrawer`
- `SocketStatusBadge`
- `AuthGuard`

## 共享 UI 单元

- `Button`
- `Input`
- `Select`
- `Badge`
- `Table`
- `EmptyState`
- `LoadingState`
- `ErrorState`
- `Toast`

## 最小数据流

- 加载当前用户
- 加载概览统计
- 加载热点列表
- 建立 Socket 连接
- 收到推送后追加新热点

## 样式规则

采用浅色仪表盘和高密度信息布局，仅使用普通 CSS，不添加营销展示区（Hero）。
