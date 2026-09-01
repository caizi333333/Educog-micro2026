-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "studentId" TEXT,
    "class" TEXT,
    "grade" TEXT,
    "major" TEXT,
    "teacherId" TEXT,
    "creationRequestKey" TEXT,
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "title" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "courseName" TEXT,
    "semester" TEXT,
    "teacherId" TEXT,
    "creationRequestKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "eventType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moduleId" TEXT,
    "chapterId" TEXT,
    "experimentId" TEXT,
    "quizId" TEXT,
    "duration" INTEGER,
    "progress" INTEGER,
    "clientTime" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExperiment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "score" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeSpent" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCode" TEXT,
    "results" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "answers" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "points" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "awardedBy" TEXT,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modules" TEXT NOT NULL,
    "currentModule" INTEGER NOT NULL DEFAULT 0,
    "totalModules" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT,
    "moduleId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "bookmarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "courseScore" DOUBLE PRECISION,
    "examScore" DOUBLE PRECISION,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "certificateNo" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPointsTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPointsTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modulesCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "chapter" INTEGER NOT NULL,
    "description" TEXT,
    "graphNodeId" TEXT,
    "parentId" TEXT,
    "resources" JSONB,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliedIn" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationRequirement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standardVersion" TEXT NOT NULL DEFAULT '2024',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorPoint" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "graduationRequirementId" TEXT NOT NULL,
    "subIndex" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "achievementThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseObjective" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "indicatorPointId" TEXT NOT NULL,
    "supportWeight" DOUBLE PRECISION NOT NULL,
    "semester" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentLink" (
    "id" TEXT NOT NULL,
    "courseObjectiveId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "assessmentTargetId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "chapter" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseObjectiveAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseObjectiveId" TEXT NOT NULL,
    "semester" TEXT,
    "classId" TEXT,
    "weightedScoreSum" DOUBLE PRECISION NOT NULL,
    "weightedMaxSum" DOUBLE PRECISION NOT NULL,
    "achievementDegree" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "breakdown" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseObjectiveAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationRequirementAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "indicatorPointId" TEXT NOT NULL,
    "semester" TEXT,
    "classId" TEXT,
    "achievementDegree" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "contributingObjectives" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraduationRequirementAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CQIReport" (
    "id" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "classId" TEXT,
    "title" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetCode" TEXT,
    "averageAchievement" DOUBLE PRECISION,
    "passRate" DOUBLE PRECISION,
    "totalStudents" INTEGER NOT NULL DEFAULT 0,
    "passedStudents" INTEGER NOT NULL DEFAULT 0,
    "weakPoints" TEXT,
    "strengths" TEXT,
    "improvementMeasures" TEXT,
    "previousMeasures" TEXT,
    "previousAchievement" DOUBLE PRECISION,
    "achievementChange" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CQIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CQIActionItem" (
    "id" TEXT NOT NULL,
    "cqiReportId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CQIActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "User_creationRequestKey_key" ON "User"("creationRequestKey");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_totalPoints_idx" ON "User"("totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroup_inviteCode_key" ON "ClassGroup"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClassGroup_creationRequestKey_key" ON "ClassGroup"("creationRequestKey");

-- CreateIndex
CREATE INDEX "ClassGroup_teacherId_idx" ON "ClassGroup"("teacherId");

-- CreateIndex
CREATE INDEX "ClassGroup_status_idx" ON "ClassGroup"("status");

-- CreateIndex
CREATE INDEX "ClassGroup_name_idx" ON "ClassGroup"("name");

-- CreateIndex
CREATE INDEX "ClassEnrollment_userId_idx" ON "ClassEnrollment"("userId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_classId_idx" ON "ClassEnrollment"("classId");

-- CreateIndex
CREATE INDEX "ClassEnrollment_status_idx" ON "ClassEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassEnrollment_classId_userId_key" ON "ClassEnrollment"("classId", "userId");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_idx" ON "LearningEvent"("userId");

-- CreateIndex
CREATE INDEX "LearningEvent_classId_idx" ON "LearningEvent"("classId");

-- CreateIndex
CREATE INDEX "LearningEvent_eventType_idx" ON "LearningEvent"("eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_targetType_targetId_idx" ON "LearningEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "LearningEvent_createdAt_idx" ON "LearningEvent"("createdAt");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_eventType_idx" ON "LearningEvent"("userId", "eventType");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_createdAt_idx" ON "LearningEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_idx" ON "UserActivity"("userId");

-- CreateIndex
CREATE INDEX "UserActivity_action_idx" ON "UserActivity"("action");

-- CreateIndex
CREATE INDEX "UserActivity_createdAt_idx" ON "UserActivity"("createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_action_idx" ON "UserActivity"("userId", "action");

-- CreateIndex
CREATE INDEX "UserActivity_userId_action_createdAt_idx" ON "UserActivity"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "UserExperiment_userId_idx" ON "UserExperiment"("userId");

-- CreateIndex
CREATE INDEX "UserExperiment_experimentId_idx" ON "UserExperiment"("experimentId");

-- CreateIndex
CREATE INDEX "UserExperiment_status_idx" ON "UserExperiment"("status");

-- CreateIndex
CREATE INDEX "UserExperiment_userId_status_idx" ON "UserExperiment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserExperiment_userId_experimentId_key" ON "UserExperiment"("userId", "experimentId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_idx" ON "QuizAttempt"("userId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");

-- CreateIndex
CREATE INDEX "QuizAttempt_score_idx" ON "QuizAttempt"("score");

-- CreateIndex
CREATE INDEX "QuizAttempt_createdAt_idx" ON "QuizAttempt"("createdAt");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_completedAt_idx" ON "QuizAttempt"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_category_idx" ON "UserAchievement"("category");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_category_idx" ON "UserAchievement"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "LearningPath_userId_idx" ON "LearningPath"("userId");

-- CreateIndex
CREATE INDEX "LearningPath_status_idx" ON "LearningPath"("status");

-- CreateIndex
CREATE INDEX "LearningProgress_userId_idx" ON "LearningProgress"("userId");

-- CreateIndex
CREATE INDEX "LearningProgress_pathId_idx" ON "LearningProgress"("pathId");

-- CreateIndex
CREATE INDEX "LearningProgress_status_idx" ON "LearningProgress"("status");

-- CreateIndex
CREATE INDEX "LearningProgress_userId_chapterId_idx" ON "LearningProgress"("userId", "chapterId");

-- CreateIndex
CREATE INDEX "LearningProgress_userId_status_idx" ON "LearningProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningProgress_userId_moduleId_chapterId_key" ON "LearningProgress"("userId", "moduleId", "chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateNo_key" ON "Certificate"("certificateNo");

-- CreateIndex
CREATE INDEX "Certificate_userId_idx" ON "Certificate"("userId");

-- CreateIndex
CREATE INDEX "Certificate_type_idx" ON "Certificate"("type");

-- CreateIndex
CREATE INDEX "Certificate_certificateNo_idx" ON "Certificate"("certificateNo");

-- CreateIndex
CREATE INDEX "UserPointsTransaction_userId_idx" ON "UserPointsTransaction"("userId");

-- CreateIndex
CREATE INDEX "UserPointsTransaction_type_idx" ON "UserPointsTransaction"("type");

-- CreateIndex
CREATE INDEX "UserPointsTransaction_createdAt_idx" ON "UserPointsTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_key" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserProgress_userId_idx" ON "UserProgress"("userId");

-- CreateIndex
CREATE INDEX "UserProgress_lastActiveDate_idx" ON "UserProgress"("lastActiveDate");

-- CreateIndex
CREATE INDEX "KnowledgeNode_chapter_idx" ON "KnowledgeNode"("chapter");

-- CreateIndex
CREATE INDEX "KnowledgeNode_level_idx" ON "KnowledgeNode"("level");

-- CreateIndex
CREATE INDEX "KnowledgeNode_parentId_idx" ON "KnowledgeNode"("parentId");

-- CreateIndex
CREATE INDEX "KnowledgeNode_graphNodeId_idx" ON "KnowledgeNode"("graphNodeId");

-- CreateIndex
CREATE INDEX "AchievementAuditLog_userId_createdAt_idx" ON "AchievementAuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AchievementAuditLog_achievementId_idx" ON "AchievementAuditLog"("achievementId");

-- CreateIndex
CREATE INDEX "AchievementAuditLog_action_idx" ON "AchievementAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationRequirement_code_key" ON "GraduationRequirement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationRequirement_index_key" ON "GraduationRequirement"("index");

-- CreateIndex
CREATE INDEX "GraduationRequirement_index_idx" ON "GraduationRequirement"("index");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorPoint_code_key" ON "IndicatorPoint"("code");

-- CreateIndex
CREATE INDEX "IndicatorPoint_code_idx" ON "IndicatorPoint"("code");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorPoint_graduationRequirementId_subIndex_key" ON "IndicatorPoint"("graduationRequirementId", "subIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CourseObjective_code_key" ON "CourseObjective"("code");

-- CreateIndex
CREATE INDEX "CourseObjective_indicatorPointId_idx" ON "CourseObjective"("indicatorPointId");

-- CreateIndex
CREATE INDEX "CourseObjective_isActive_idx" ON "CourseObjective"("isActive");

-- CreateIndex
CREATE INDEX "AssessmentLink_courseObjectiveId_idx" ON "AssessmentLink"("courseObjectiveId");

-- CreateIndex
CREATE INDEX "AssessmentLink_assessmentType_assessmentTargetId_idx" ON "AssessmentLink"("assessmentType", "assessmentTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentLink_courseObjectiveId_assessmentType_assessmentT_key" ON "AssessmentLink"("courseObjectiveId", "assessmentType", "assessmentTargetId");

-- CreateIndex
CREATE INDEX "CourseObjectiveAchievement_userId_idx" ON "CourseObjectiveAchievement"("userId");

-- CreateIndex
CREATE INDEX "CourseObjectiveAchievement_courseObjectiveId_idx" ON "CourseObjectiveAchievement"("courseObjectiveId");

-- CreateIndex
CREATE INDEX "CourseObjectiveAchievement_passed_idx" ON "CourseObjectiveAchievement"("passed");

-- CreateIndex
CREATE INDEX "CourseObjectiveAchievement_userId_courseObjectiveId_idx" ON "CourseObjectiveAchievement"("userId", "courseObjectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseObjectiveAchievement_userId_courseObjectiveId_semeste_key" ON "CourseObjectiveAchievement"("userId", "courseObjectiveId", "semester", "classId");

-- CreateIndex
CREATE INDEX "GraduationRequirementAchievement_userId_idx" ON "GraduationRequirementAchievement"("userId");

-- CreateIndex
CREATE INDEX "GraduationRequirementAchievement_indicatorPointId_idx" ON "GraduationRequirementAchievement"("indicatorPointId");

-- CreateIndex
CREATE INDEX "GraduationRequirementAchievement_passed_idx" ON "GraduationRequirementAchievement"("passed");

-- CreateIndex
CREATE UNIQUE INDEX "GraduationRequirementAchievement_userId_indicatorPointId_se_key" ON "GraduationRequirementAchievement"("userId", "indicatorPointId", "semester", "classId");

-- CreateIndex
CREATE INDEX "CQIReport_semester_idx" ON "CQIReport"("semester");

-- CreateIndex
CREATE INDEX "CQIReport_reportType_idx" ON "CQIReport"("reportType");

-- CreateIndex
CREATE INDEX "CQIReport_classId_idx" ON "CQIReport"("classId");

-- CreateIndex
CREATE INDEX "CQIReport_status_idx" ON "CQIReport"("status");

-- CreateIndex
CREATE INDEX "CQIActionItem_cqiReportId_idx" ON "CQIActionItem"("cqiReportId");

-- CreateIndex
CREATE INDEX "CQIActionItem_status_idx" ON "CQIActionItem"("status");

-- AddForeignKey
ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExperiment" ADD CONSTRAINT "UserExperiment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPointsTransaction" ADD CONSTRAINT "UserPointsTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorPoint" ADD CONSTRAINT "IndicatorPoint_graduationRequirementId_fkey" FOREIGN KEY ("graduationRequirementId") REFERENCES "GraduationRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseObjective" ADD CONSTRAINT "CourseObjective_indicatorPointId_fkey" FOREIGN KEY ("indicatorPointId") REFERENCES "IndicatorPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentLink" ADD CONSTRAINT "AssessmentLink_courseObjectiveId_fkey" FOREIGN KEY ("courseObjectiveId") REFERENCES "CourseObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseObjectiveAchievement" ADD CONSTRAINT "CourseObjectiveAchievement_courseObjectiveId_fkey" FOREIGN KEY ("courseObjectiveId") REFERENCES "CourseObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationRequirementAchievement" ADD CONSTRAINT "GraduationRequirementAchievement_indicatorPointId_fkey" FOREIGN KEY ("indicatorPointId") REFERENCES "IndicatorPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CQIActionItem" ADD CONSTRAINT "CQIActionItem_cqiReportId_fkey" FOREIGN KEY ("cqiReportId") REFERENCES "CQIReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
