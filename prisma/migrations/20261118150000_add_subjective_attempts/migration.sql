-- CreateTable
CREATE TABLE "SubjectiveAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "draft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectiveAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubjectiveAttempt_userId_idx" ON "SubjectiveAttempt"("userId");

-- CreateIndex
CREATE INDEX "SubjectiveAttempt_userId_questionId_idx" ON "SubjectiveAttempt"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "SubjectiveAttempt" ADD CONSTRAINT "SubjectiveAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
