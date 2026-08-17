# Socket 事件

## 客户端到服务端

### `dashboard:join`

负载：

- `userId`
- `filters`

### `dashboard:leave`

负载：

- `userId`

### `hot-items:subscribe`

负载：

- `keywords`
- `sources`

### `hot-items:unsubscribe`

负载：

- `keywords`

## 服务端到客户端

### `server:ready`

负载：

- `timestamp`

### `hot-item:new`

负载：

- `hotItem`

### `hot-item:update`

负载：

- `hotItem`

### `hot-item:batch`

负载：

- `items`

### `stats:update`

负载：

- `overview`

### `collector:run-status`

负载：

- `sourceCode`
- `status`
- `startedAt`
- `finishedAt`

### `server:error`

负载：

- `message`
- `code`
