-- Add readAt timestamp to Article so recap can query by actual read time
-- rather than by fetchedAt (when the article was fetched from RSS).
-- Nullable: articles that have never been opened have no readAt.
ALTER TABLE "Article" ADD COLUMN "readAt" DATETIME;

-- Index to support recap queries: WHERE readAt >= ? AND readAt IS NOT NULL
CREATE INDEX "Article_readAt_idx" ON "Article"("readAt");
