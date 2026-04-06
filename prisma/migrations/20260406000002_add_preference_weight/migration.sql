-- Add preferenceWeight to UserPreferences (default 0.3, range 0.0–1.0)
-- Controls how strongly learned topic/source weights influence feed ranking
ALTER TABLE "UserPreferences" ADD COLUMN "preferenceWeight" REAL NOT NULL DEFAULT 0.3;
