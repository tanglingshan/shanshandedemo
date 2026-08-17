-- CreateTable
CREATE TABLE "image_generation_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negative_prompt" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "quality" TEXT,
    "style" TEXT,
    "reference_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "revised_prompt" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_generation_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_generation_images" (
    "id" TEXT NOT NULL,
    "history_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "provider_url" TEXT,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "data" BYTEA,
    "revised_prompt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_generation_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "image_generation_histories_request_id_key" ON "image_generation_histories"("request_id");
CREATE INDEX "image_generation_histories_user_id_created_at_idx" ON "image_generation_histories"("user_id", "created_at" DESC);
CREATE INDEX "image_generation_histories_user_id_status_created_at_idx" ON "image_generation_histories"("user_id", "status", "created_at" DESC);
CREATE INDEX "image_generation_histories_status_created_at_idx" ON "image_generation_histories"("status", "created_at" ASC);
CREATE UNIQUE INDEX "image_generation_images_history_id_ordinal_key" ON "image_generation_images"("history_id", "ordinal");
CREATE INDEX "image_generation_images_history_id_ordinal_idx" ON "image_generation_images"("history_id", "ordinal");

-- AddForeignKey
ALTER TABLE "image_generation_histories" ADD CONSTRAINT "image_generation_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "image_generation_images" ADD CONSTRAINT "image_generation_images_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "image_generation_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
