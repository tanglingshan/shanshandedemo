-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "poll_interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hot_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "canonical_url" TEXT,
    "source_code" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_content_hash" TEXT,
    "summary" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hot_score" INTEGER NOT NULL DEFAULT 0,
    "relevance_score" DOUBLE PRECISION,
    "importance_level" TEXT NOT NULL DEFAULT 'normal',
    "analysis_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hot_item_sources" (
    "id" TEXT NOT NULL,
    "hot_item_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "source_item_id" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_title" TEXT NOT NULL,
    "raw_summary" TEXT,
    "raw_payload" JSONB,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hot_item_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "hot_item_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "factuality_score" DOUBLE PRECISION,
    "relevance_score" DOUBLE PRECISION,
    "importance_level" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analysis_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collector_runs" (
    "id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "items_fetched" INTEGER NOT NULL DEFAULT 0,
    "items_inserted" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sources_code_key" ON "sources"("code");

-- CreateIndex
CREATE UNIQUE INDEX "hot_items_canonical_url_key" ON "hot_items"("canonical_url");

-- CreateIndex
CREATE INDEX "hot_items_published_at_idx" ON "hot_items"("published_at");

-- CreateIndex
CREATE INDEX "hot_items_hot_score_idx" ON "hot_items"("hot_score");

-- CreateIndex
CREATE UNIQUE INDEX "hot_items_source_code_source_item_id_key" ON "hot_items"("source_code", "source_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "hot_item_sources_source_code_source_item_id_key" ON "hot_item_sources"("source_code", "source_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_analyses_hot_item_id_key" ON "ai_analyses"("hot_item_id");

-- AddForeignKey
ALTER TABLE "hot_item_sources" ADD CONSTRAINT "hot_item_sources_hot_item_id_fkey" FOREIGN KEY ("hot_item_id") REFERENCES "hot_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_hot_item_id_fkey" FOREIGN KEY ("hot_item_id") REFERENCES "hot_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
