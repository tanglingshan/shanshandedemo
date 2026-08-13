# Socket Events

## Client to Server

### `dashboard:join`
Payload:
- `userId`
- `filters`

### `dashboard:leave`
Payload:
- `userId`

### `hot-items:subscribe`
Payload:
- `keywords`
- `sources`

### `hot-items:unsubscribe`
Payload:
- `keywords`

## Server to Client

### `server:ready`
Payload:
- `timestamp`

### `hot-item:new`
Payload:
- `hotItem`

### `hot-item:update`
Payload:
- `hotItem`

### `hot-item:batch`
Payload:
- `items`

### `stats:update`
Payload:
- `overview`

### `collector:run-status`
Payload:
- `sourceCode`
- `status`
- `startedAt`
- `finishedAt`

### `server:error`
Payload:
- `message`
- `code`
