-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "category" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "sentimentScore" REAL NOT NULL DEFAULT 0,
    "aiSummary" TEXT,
    "aiBullets" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TopStory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "articleIds" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "positiveRatio" REAL NOT NULL DEFAULT 0.4,
    "neutralRatio" REAL NOT NULL DEFAULT 0.4,
    "negativeRatio" REAL NOT NULL DEFAULT 0.2,
    "enabledCategories" TEXT NOT NULL DEFAULT 'technology,science,business,world,positive',
    "refreshIntervalMins" INTEGER NOT NULL DEFAULT 60,
    "moodPreset" TEXT NOT NULL DEFAULT 'balanced',
    "avoidTopics" TEXT NOT NULL DEFAULT '',
    "hiddenSources" TEXT NOT NULL DEFAULT '',
    "sessionSize" INTEGER NOT NULL DEFAULT 15,
    "depthMode" TEXT NOT NULL DEFAULT 'skim',
    "enabledSources" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "lastRefreshed" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArticleFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SourceWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "lastAdjusted" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_url_key" ON "Article"("url");

-- CreateIndex
CREATE INDEX "ArticleFeedback_articleId_idx" ON "ArticleFeedback"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceWeight_source_key" ON "SourceWeight"("source");
