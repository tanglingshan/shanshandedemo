# 数据库设计

## 数据表

### users（用户）

- `id`
- `email`
- `password_hash`
- `display_name`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

索引：

- `email` 唯一索引

### sources（数据源）

- `id`
- `code`（`hackernews`、`bing`、`bilibili`）
- `name`
- `type`
- `enabled`
- `poll_interval_minutes`
- `source_url`
- `created_at`
- `updated_at`

索引：

- `code` 唯一索引

### hot_items（热点）

- `id`
- `title`
- `canonical_url`
- `source_code`
- `source_item_id`
- `published_at`
- `collected_at`
- `raw_content_hash`
- `summary`
- `tags`
- `hot_score`
- `relevance_score`
- `importance_level`
- `analysis_status`
- `created_at`
- `updated_at`

索引：

- `source_code + source_item_id` 唯一索引
- `canonical_url`（有值时）唯一索引
- `published_at` 索引
- `hot_score` 索引

### hot_item_sources（热点来源追踪）

- `id`
- `hot_item_id`
- `source_code`
- `source_item_id`
- `source_url`
- `raw_title`
- `raw_summary`
- `raw_payload`
- `collected_at`

索引：

- `source_code + source_item_id` 唯一索引

### ai_analyses（AI 分析结果）

- `id`
- `hot_item_id`
- `provider`
- `model`
- `prompt_version`
- `factuality_score`
- `relevance_score`
- `importance_level`
- `summary`
- `tags`
- `analysis_payload`
- `created_at`

索引：

- `hot_item_id` 唯一索引

### collector_runs（采集运行记录）

- `id`
- `source_code`
- `status`
- `started_at`
- `finished_at`
- `items_fetched`
- `items_inserted`
- `items_updated`
- `items_skipped`
- `error_message`
- `created_at`

## Session 存储

`express-session` 使用 PostgreSQL 持久化 Session。Session 表由基础设施管理，不属于业务领域模型。
