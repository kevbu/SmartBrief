-- Add TopicWeight table (parallel to SourceWeight) for topic-based feed ranking
CREATE TABLE "TopicWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "lastAdjusted" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "TopicWeight_topic_key" ON "TopicWeight"("topic");

-- Add FeedbackSignal table for explicit and implicit learning signals
CREATE TABLE "FeedbackSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "source" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes to support 90-day decay queries and topic/source weight lookups
CREATE INDEX "FeedbackSignal_topic_createdAt_idx" ON "FeedbackSignal"("topic", "createdAt");
CREATE INDEX "FeedbackSignal_source_createdAt_idx" ON "FeedbackSignal"("source", "createdAt");
CREATE INDEX "FeedbackSignal_action_createdAt_idx" ON "FeedbackSignal"("action", "createdAt");

-- Add learningEnabled toggle to UserPreferences (default on)
ALTER TABLE "UserPreferences" ADD COLUMN "learningEnabled" BOOLEAN NOT NULL DEFAULT true;
