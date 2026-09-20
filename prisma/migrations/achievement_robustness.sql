-- Achievement system robustness: CHECK constraints
-- Run after `prisma db push` has created the new columns/model.

ALTER TABLE "User"
  ADD CONSTRAINT "totalPoints_non_negative" CHECK ("totalPoints" >= 0);

ALTER TABLE "UserPointsTransaction"
  ADD CONSTRAINT "points_non_zero" CHECK ("points" != 0);

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "achievement_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100);

ALTER TABLE "UserAchievement"
  ADD CONSTRAINT "achievement_points_non_negative" CHECK ("points" >= 0);
