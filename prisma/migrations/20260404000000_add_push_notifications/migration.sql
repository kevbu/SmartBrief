-- Add IMAP and session fields to AppState (if not already present from dev iterations)
ALTER TABLE "AppState" ADD COLUMN "lastImapPoll" DATETIME;
ALTER TABLE "AppState" ADD COLUMN "lastOpenedAt" DATETIME;

-- Add breaking-news detection fields to AppState
ALTER TABLE "AppState" ADD COLUMN "lastBreakingCheck" DATETIME;
ALTER TABLE "AppState" ADD COLUMN "vapidPublic" TEXT;
ALTER TABLE "AppState" ADD COLUMN "vapidPrivate" TEXT;

-- Add push notification fields to UserPreferences
ALTER TABLE "UserPreferences" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPreferences" ADD COLUMN "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserPreferences" ADD COLUMN "quietHoursStart" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "UserPreferences" ADD COLUMN "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00';

-- Add severity and breaking-news fields to Article
ALTER TABLE "Article" ADD COLUMN "severity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Article" ADD COLUMN "isCriticalBreaking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Article" ADD COLUMN "criticalPushedAt" DATETIME;

-- CreateTable for push subscriptions
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
