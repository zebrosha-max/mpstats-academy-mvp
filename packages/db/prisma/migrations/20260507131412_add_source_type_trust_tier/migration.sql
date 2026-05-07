-- AlterTable
ALTER TABLE "content_chunk" ADD COLUMN "source_type" TEXT NOT NULL DEFAULT 'academy_audio';
ALTER TABLE "content_chunk" ADD COLUMN "trust_tier" SMALLINT NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "content_chunk_source_type_idx" ON "content_chunk"("source_type");

-- CreateIndex
CREATE INDEX "content_chunk_trust_tier_idx" ON "content_chunk"("trust_tier");
