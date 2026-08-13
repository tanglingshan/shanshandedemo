# Database Design

## Tables

### users
- `id`
- `email`
- `password_hash`
- `display_name`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

Indexes:
- unique on `email`

### sources
- `id`
- `code` (`hackernews`, `bing`, `bilibili`)
- `name`
- `type`
- `enabled`
- `poll_interval_minutes`
- `source_url`
- `created_at`
- `updated_at`

Indexes:
- unique on `code`

### hot_items
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

Indexes:
- unique on `source_code + source_item_id`
- unique on `canonical_url` when present
- index on `published_at`
- index on `hot_score`

### hot_item_sources
- `id`
- `hot_item_id`
- `source_code`
- `source_item_id`
- `source_url`
- `raw_title`
- `raw_summary`
- `raw_payload`
- `collected_at`

Indexes:
- unique on `source_code + source_item_id`

### ai_analyses
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

Indexes:
- unique on `hot_item_id`

### collector_runs
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

## Session Store
Use PostgreSQL-backed session storage for `express-session`. The session table is infrastructure-managed and not part of the business domain model.
