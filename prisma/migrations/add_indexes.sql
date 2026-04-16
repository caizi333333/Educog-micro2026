-- 优化用户活动查询
CREATE INDEX IF NOT EXISTS idx_user_activity_user_action ON "UserActivity"("userId", "action", "createdAt" DESC);

-- 优化学习进度查询
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_status ON "LearningProgress"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_learning_progress_module ON "LearningProgress"("moduleId", "chapterId");

-- 优化测验查询
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_user_date ON "QuizAttempt"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_quiz_score ON "QuizAttempt"("quizId", "score" DESC);

-- 优化实验记录查询
CREATE INDEX IF NOT EXISTS idx_user_experiment_user_status ON "UserExperiment"("userId", "status");
CREATE INDEX IF NOT EXISTS idx_user_experiment_completed ON "UserExperiment"("completedAt" DESC) WHERE "completedAt" IS NOT NULL;

-- 优化成就查询
CREATE INDEX IF NOT EXISTS idx_user_achievement_user_category ON "UserAchievement"("userId", "category");
CREATE INDEX IF NOT EXISTS idx_user_achievement_unlocked ON "UserAchievement"("unlockedAt" DESC);

-- 优化积分交易查询
CREATE INDEX IF NOT EXISTS idx_points_transaction_user_date ON "UserPointsTransaction"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_points_transaction_type ON "UserPointsTransaction"("type");

-- 复合索引优化连接查询
CREATE INDEX IF NOT EXISTS idx_session_user_token ON "Session"("userId", "token", "expiresAt");
CREATE INDEX IF NOT EXISTS idx_learning_path_user_status ON "LearningPath"("userId", "status");