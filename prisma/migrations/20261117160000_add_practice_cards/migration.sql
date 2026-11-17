-- CreateTable
CREATE TABLE "PracticeCardProfile" (
    "userId" TEXT NOT NULL,
    "dailyGoal" INTEGER NOT NULL DEFAULT 20,

    CONSTRAINT "PracticeCardProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PracticeCardAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "questionId" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "mode" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeCardAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeReviewCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classId" TEXT,
    "questionIds" INTEGER[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PracticeCardAttempt_userId_createdAt_idx" ON "PracticeCardAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeCardAttempt_classId_createdAt_idx" ON "PracticeCardAttempt"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeCardAttempt_userId_questionId_idx" ON "PracticeCardAttempt"("userId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeCardAttempt_userId_requestId_key" ON "PracticeCardAttempt"("userId", "requestId");

-- CreateIndex
CREATE INDEX "PracticeReviewCard_userId_dueAt_idx" ON "PracticeReviewCard"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeReviewCard_userId_questionId_key" ON "PracticeReviewCard"("userId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeChallenge_classId_finishedAt_correctCount_idx" ON "PracticeChallenge"("classId", "finishedAt", "correctCount");

-- CreateIndex
CREATE INDEX "PracticeChallenge_userId_startedAt_idx" ON "PracticeChallenge"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "PracticeCardProfile" ADD CONSTRAINT "PracticeCardProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeCardAttempt" ADD CONSTRAINT "PracticeCardAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeCardAttempt" ADD CONSTRAINT "PracticeCardAttempt_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeReviewCard" ADD CONSTRAINT "PracticeReviewCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeChallenge" ADD CONSTRAINT "PracticeChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeChallenge" ADD CONSTRAINT "PracticeChallenge_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
