# API Contract

Base path: `/api`

## Auth

### POST `/auth/register`
Request:
- `email`
- `password`
- `confirmPassword`

Response:
- user summary

### POST `/auth/login`
Request:
- `email`
- `password`

Response:
- user summary
- session cookie set by server

### POST `/auth/logout`
Response:
- session cleared

### GET `/auth/me`
Response:
- current user summary or `401`

## Dashboard

### GET `/hot-items`
Query:
- `page`
- `pageSize`
- `source`
- `sort`
- `keyword`
- `from`
- `to`
- `importanceLevel`

Response:
- paged hot item list

### GET `/hot-items/:id`
Response:
- hot item detail
- AI analysis detail
- source traces

### GET `/stats/overview`
Response:
- today count
- source count
- analyzed count
- high-importance count
- latest collect time

### GET `/sources`
Response:
- enabled sources and labels

### GET `/health`
Response:
- service health and version

## Response Shape
Standardize all JSON responses as:
- `success`
- `data`
- `message`
- `errorCode`

## Error Cases
- `401` unauthenticated
- `403` forbidden
- `404` not found
- `422` validation error
- `500` internal error
